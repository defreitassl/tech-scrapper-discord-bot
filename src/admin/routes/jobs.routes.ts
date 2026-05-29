import express from 'express';
import { JobPost, JobStatus } from '@prisma/client';
import { logger } from '../../lib/logger';
import { prisma } from '../../lib/prisma';
import { checkJobDuplicate } from '../../services/jobDeduplication';
import { publishPendingJobs, publishSingleJob } from '../../services/publishPendingJobs';
import { runRealJobCollection } from '../../services/scheduledCollector';
import { manualJobProviders } from '../../providers/providerRegistry';
import { parseJobForm } from '../helpers/forms';
import { getNoticeFromQuery, redirectWithNotice } from '../helpers/notifications';
import { buildCompactCollectionNotice } from '../helpers/providerSummary';
import { validateJob } from '../helpers/validators';
import { renderLayout } from '../views/layout';
import { renderJobDetails, renderJobForm, renderJobsList, type JobsByStatus } from '../views/jobs.views';

export function createJobsRouter(): express.Router {
  const router = express.Router();

  router.get('/admin/jobs', async (request, response) => {
    const jobs = await prisma.jobPost.findMany({
      orderBy: { createdAt: 'desc' },
    });

    response.send(renderJobsList(groupJobsByStatus(jobs), getNoticeFromQuery(request.query)));
  });

  router.get('/admin/jobs/new', (_request, response) => {
    response.send(renderJobForm({ title: 'Nova vaga', action: '/admin/jobs' }));
  });

  router.post('/admin/jobs', async (request, response) => {
    const form = parseJobForm(request.body);
    const createData = {
      ...form,
      status: JobStatus.PENDING,
    };
    const error = validateJob(createData);

    if (error) {
      response.status(400).send(renderJobForm({ title: 'Nova vaga', action: '/admin/jobs', form: createData, error }));
      return;
    }

    const duplicateCheck = await checkJobDuplicate(createData);

    if (duplicateCheck.duplicateByUrl) {
      logger.info('Cadastro de vaga duplicada por URL bloqueado no admin.', {
        existingJobId: duplicateCheck.duplicateByUrl.id,
        url: createData.url,
      });

      redirectWithNotice(
        response,
        `/admin/jobs/${duplicateCheck.duplicateByUrl.id}`,
        'Esta vaga ja existe no sistema.',
        'warning',
      );
      return;
    }

    const job = await prisma.jobPost.create({ data: createData });
    logger.info('Vaga criada no admin.', {
      jobId: job.id,
      title: job.title,
      status: job.status,
      useAi: job.useAi,
      possibleDuplicateJobId: duplicateCheck.possibleDuplicateByTitleAndCompany?.id,
    });

    const message = job.readyText?.trim()
      ? 'Vaga cadastrada com sucesso. Como ha texto pronto, ele sera usado no envio.'
      : job.useAi
        ? 'Vaga cadastrada com sucesso. A mensagem sera gerada com IA somente no momento do envio.'
        : 'Vaga cadastrada com sucesso. O envio usara o template deterministico.';

    redirectWithNotice(
      response,
      `/admin/jobs/${job.id}`,
      getJobCreatedNoticeMessage(message, duplicateCheck.possibleDuplicateByTitleAndCompany),
      duplicateCheck.possibleDuplicateByTitleAndCompany ? 'warning' : 'success',
    );
  });

  router.post('/admin/jobs/publish-pending', async (_request, response) => {
    try {
      logger.info('Publicacao manual de vagas pendentes iniciada pelo admin.');
      const result = await publishPendingJobs();
      const message = `Publicacao concluida. Encontradas: ${result.total}. Enviadas: ${result.sent}. Erros: ${result.failed}.`;
      const noticeType = result.failed > 0 ? 'warning' : result.sent > 0 ? 'success' : 'info';

      redirectWithNotice(response, '/admin/jobs', message, noticeType);
    } catch (error) {
      logger.error('Erro ao publicar vagas pendentes pelo admin.', error);
      redirectWithNotice(response, '/admin/jobs', 'Erro ao enviar vagas pendentes.', 'error');
    }
  });

  router.post('/admin/jobs/collect-all', async (_request, response) => {
    try {
      logger.info('Coleta manual unificada de vagas iniciada pelo admin.');
      const collectionResult = await runRealJobCollection('manual', manualJobProviders);

      if (collectionResult.skipped || !collectionResult.summary) {
        redirectWithNotice(
          response,
          '/admin/jobs',
          'Coleta ignorada porque outra coleta ja esta em execucao.',
          'warning',
        );
        return;
      }

      const result = collectionResult.summary;
      const message = buildCompactCollectionNotice(result);
      const noticeType = result.errors.length > 0 ? 'warning' : result.approvedAsPending > 0 ? 'success' : 'info';

      redirectWithNotice(response, '/admin/jobs', message, noticeType);
    } catch (error) {
      logger.error('Erro ao executar coleta manual unificada pelo admin.', error);
      redirectWithNotice(response, '/admin/jobs', 'Erro ao coletar vagas.', 'error');
    }
  });

  router.get('/admin/jobs/:id', async (request, response) => {
    const job = await findJobOrRenderNotFound(request.params.id, response);

    if (!job) {
      return;
    }

    response.send(
      renderJobDetails(job, {
        notice: getNoticeFromQuery(request.query),
      }),
    );
  });

  router.get('/admin/jobs/:id/edit', async (request, response) => {
    const job = await findJobOrRenderNotFound(request.params.id, response);

    if (!job) {
      return;
    }

    response.send(renderJobForm({ title: 'Editar vaga', action: `/admin/jobs/${job.id}`, job }));
  });

  router.post('/admin/jobs/:id', async (request, response) => {
    const job = await findJobOrRenderNotFound(request.params.id, response);

    if (!job) {
      return;
    }

    const form = parseJobForm(request.body);
    const error = validateJob(form, job.aiGeneratedText);

    if (error) {
      response.status(400).send(
        renderJobForm({
          title: 'Editar vaga',
          action: `/admin/jobs/${job.id}`,
          job,
          form,
          error,
        }),
      );
      return;
    }

    await prisma.jobPost.update({
      where: { id: job.id },
      data: form,
    });
    logger.info('Vaga atualizada no admin.', {
      jobId: job.id,
      title: form.title,
      status: form.status,
      useAi: form.useAi,
    });

    response.redirect(`/admin/jobs/${job.id}`);
  });

  router.post('/admin/jobs/:id/publish', async (request, response) => {
    const job = await findJobOrRenderNotFound(request.params.id, response);

    if (!job) {
      return;
    }

    const result = await publishSingleJob(job);
    const noticeType = result.status === 'sent' ? 'success' : result.status === 'skipped' ? 'warning' : 'error';

    redirectWithNotice(response, `/admin/jobs/${job.id}`, result.message, noticeType);
  });

  router.post('/admin/jobs/:id/delete', async (request, response) => {
    const job = await findJobOrRenderNotFound(request.params.id, response);

    if (!job) {
      return;
    }

    if (job.status === JobStatus.SENT) {
      redirectWithNotice(
        response,
        `/admin/jobs/${job.id}`,
        'Esta vaga ja foi enviada e nao pode ser excluida pelo painel.',
        'warning',
      );
      return;
    }

    await prisma.jobPost.delete({
      where: { id: job.id },
    });
    logger.info('Vaga excluida no admin.', {
      jobId: job.id,
      title: job.title,
      status: job.status,
    });

    redirectWithNotice(response, '/admin/jobs', 'Vaga excluida com sucesso.');
  });

  return router;
}

async function findJobOrRenderNotFound(id: string, response: express.Response): Promise<JobPost | null> {
  const job = await prisma.jobPost.findUnique({ where: { id } });

  if (!job) {
    response.status(404).send(renderLayout('Vaga nao encontrada', '<p>Vaga nao encontrada.</p>'));
    return null;
  }

  return job;
}

function getJobCreatedNoticeMessage(message: string, possibleDuplicate: { id: string } | null): string {
  if (!possibleDuplicate) {
    return message;
  }

  return 'Possivel duplicata detectada: ja existe uma vaga com mesmo titulo e empresa.';
}

function groupJobsByStatus(jobs: JobPost[]): JobsByStatus {
  return {
    pending: jobs.filter((job) => job.status === JobStatus.PENDING),
    history: jobs.filter((job) => job.status === JobStatus.SENT || job.status === JobStatus.ERROR),
  };
}
