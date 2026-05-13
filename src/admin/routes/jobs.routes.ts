import express from 'express';
import { JobPost, JobStatus } from '@prisma/client';
import { logger } from '../../lib/logger';
import { prisma } from '../../lib/prisma';
import { generateJobMessage } from '../../services/aiMessageGenerator';
import { checkJobDuplicate } from '../../services/jobDeduplication';
import { publishPendingJobs, publishSingleJob } from '../../services/publishPendingJobs';
import { parseJobForm } from '../helpers/forms';
import { getNoticeFromQuery, redirectWithNotice } from '../helpers/notifications';
import { validateJob, validatePending } from '../helpers/validators';
import { renderLayout } from '../views/layout';
import { renderJobDetails, renderJobForm, renderJobsList } from '../views/jobs.views';

export function createJobsRouter(): express.Router {
  const router = express.Router();

  router.get('/admin/jobs', async (request, response) => {
    const jobs = await prisma.jobPost.findMany({
      orderBy: { createdAt: 'desc' },
    });

    response.send(renderJobsList(jobs, getNoticeFromQuery(request.query)));
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

    if (!job.readyText?.trim() && job.useAi) {
      try {
        const generatedMessage = await generateJobMessage(job);

        await prisma.jobPost.update({
          where: { id: job.id },
          data: { aiGeneratedText: generatedMessage },
        });

        logger.info('Mensagem gerada automaticamente com IA no cadastro da vaga.', {
          jobId: job.id,
          messageLength: generatedMessage.length,
        });

        redirectWithNotice(
          response,
          `/admin/jobs/${job.id}`,
          getJobCreatedNoticeMessage(
            'Vaga cadastrada com sucesso. A mensagem com IA foi gerada automaticamente.',
            duplicateCheck.possibleDuplicateByTitleAndCompany,
          ),
          duplicateCheck.possibleDuplicateByTitleAndCompany ? 'warning' : 'success',
        );
        return;
      } catch (error) {
        logger.error('Erro ao gerar mensagem automaticamente no cadastro. Vaga mantida como PENDING.', error, {
          jobId: job.id,
          title: job.title,
        });

        redirectWithNotice(
          response,
          `/admin/jobs/${job.id}`,
          getJobCreatedNoticeMessage(
            'Vaga cadastrada com sucesso, mas nao foi possivel gerar a mensagem com IA agora. O preview usa o template padrao e voce pode regenerar depois.',
            duplicateCheck.possibleDuplicateByTitleAndCompany,
          ),
          'warning',
        );
        return;
      }
    }

    const message = job.readyText?.trim()
      ? 'Vaga cadastrada com sucesso. Como ha texto pronto, a IA nao foi chamada automaticamente.'
      : 'Vaga cadastrada com sucesso. A IA nao foi chamada porque a opcao de usar IA esta desmarcada.';

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

  router.post('/admin/jobs/:id/pending', async (request, response) => {
    const job = await findJobOrRenderNotFound(request.params.id, response);

    if (!job) {
      return;
    }

    const error = validatePending(job);

    if (error) {
      response.status(400).send(renderJobDetails(job, { notice: { message: error, type: 'error' } }));
      return;
    }

    await prisma.jobPost.update({
      where: { id: job.id },
      data: { status: JobStatus.PENDING },
    });
    logger.info('Vaga aprovada para envio no admin.', {
      jobId: job.id,
      title: job.title,
    });

    redirectWithNotice(response, `/admin/jobs/${job.id}`, 'Vaga marcada como pronta para envio.');
  });

  router.post('/admin/jobs/:id/generate-ai-message', async (request, response) => {
    const job = await findJobOrRenderNotFound(request.params.id, response);

    if (!job) {
      return;
    }

    try {
      logger.info('Geracao manual de mensagem com IA iniciada pelo admin.', {
        jobId: job.id,
        title: job.title,
      });
      const generatedMessage = await generateJobMessage(job);

      await prisma.jobPost.update({
        where: { id: job.id },
        data: { aiGeneratedText: generatedMessage },
      });

      logger.info('Mensagem gerada manualmente com IA e salva.', {
        jobId: job.id,
        messageLength: generatedMessage.length,
      });

      redirectWithNotice(response, `/admin/jobs/${job.id}`, 'Mensagem com IA gerada com sucesso.');
    } catch (error) {
      logger.error('Erro ao gerar mensagem com IA pelo admin.', error, {
        jobId: job.id,
        title: job.title,
      });
      redirectWithNotice(
        response,
        `/admin/jobs/${job.id}`,
        'Erro ao gerar IA. Verifique os dados da vaga e tente novamente.',
        'error',
      );
    }
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

  router.post('/admin/jobs/:id/archive', async (request, response) => {
    const job = await findJobOrRenderNotFound(request.params.id, response);

    if (!job) {
      return;
    }

    await prisma.jobPost.update({
      where: { id: job.id },
      data: { status: JobStatus.ARCHIVED },
    });
    logger.info('Vaga arquivada no admin.', {
      jobId: job.id,
      title: job.title,
    });

    redirectWithNotice(response, '/admin/jobs', 'Vaga arquivada.');
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
