import express from 'express';
import { JobPost, JobStatus } from '@prisma/client';
import { logger } from '../../lib/logger';
import { prisma } from '../../lib/prisma';
import { generateJobMessage } from '../../services/aiMessageGenerator';
import { checkJobDuplicate } from '../../services/jobDeduplication';
import { publishPendingJobs, publishSingleJob } from '../../services/publishPendingJobs';
import { runRealJobCollection } from '../../services/scheduledCollector';
import { atsJobProviders, externalJobProviders } from '../../providers/providerRegistry';
import { githubJobsProvider } from '../../providers/githubJobs.provider';
import { gupyProvider } from '../../providers/gupy.provider';
import { mockJobsProvider } from '../../providers/mockJobs.provider';
import { programathorProvider } from '../../providers/programathor.provider';
import { remotarProvider } from '../../providers/remotar.provider';
import { runJobProviders } from '../../providers/providerRunner';
import { parseJobForm } from '../helpers/forms';
import { getNoticeFromQuery, redirectWithNotice } from '../helpers/notifications';
import {
  buildGithubCollectionNotice,
  buildGupyCollectionNotice,
  buildProgramathorCollectionNotice,
  buildProviderCollectionNotice,
  buildRemotarCollectionNotice,
} from '../helpers/providerSummary';
import { validateJob, validatePending } from '../helpers/validators';
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

  router.post('/admin/jobs/collect', async (_request, response) => {
    try {
      logger.info('Coleta manual de vagas de teste iniciada pelo admin.');
      const result = await runJobProviders([mockJobsProvider]);
      const message = `Coleta concluida: ${result.createdJobs} novas vagas, ${result.ignoredDuplicates} duplicatas ignoradas.`;
      const noticeType = result.errors.length > 0 ? 'warning' : result.createdJobs > 0 ? 'success' : 'info';

      redirectWithNotice(response, '/admin/jobs', message, noticeType);
    } catch (error) {
      logger.error('Erro ao coletar vagas de teste pelo admin.', error);
      redirectWithNotice(response, '/admin/jobs', 'Erro ao coletar vagas de teste.', 'error');
    }
  });

  router.post('/admin/jobs/collect-github', async (_request, response) => {
    try {
      logger.info('Coleta manual de vagas GitHub iniciada pelo admin.');
      const collectionResult = await runRealJobCollection('manual', [githubJobsProvider]);

      if (collectionResult.skipped || !collectionResult.summary) {
        redirectWithNotice(
          response,
          '/admin/jobs',
          'Coleta GitHub ignorada porque outra coleta ja esta em execucao.',
          'warning',
        );
        return;
      }

      const result = collectionResult.summary;
      const message = buildGithubCollectionNotice(result);
      const noticeType = result.errors.length > 0 ? 'warning' : result.createdJobs > 0 ? 'success' : 'info';

      redirectWithNotice(response, '/admin/jobs', message, noticeType);
    } catch (error) {
      logger.error('Erro ao coletar vagas GitHub pelo admin.', error);
      redirectWithNotice(response, '/admin/jobs', 'Erro ao coletar vagas GitHub.', 'error');
    }
  });

  router.post('/admin/jobs/collect-external', async (_request, response) => {
    try {
      logger.info('Coleta manual de providers externos iniciada pelo admin.');
      const collectionResult = await runRealJobCollection('manual', externalJobProviders);

      if (collectionResult.skipped || !collectionResult.summary) {
        redirectWithNotice(
          response,
          '/admin/jobs',
          'Coleta externa ignorada porque outra coleta ja esta em execucao.',
          'warning',
        );
        return;
      }

      const result = collectionResult.summary;
      const message = buildProviderCollectionNotice('Coleta externa', result);
      const noticeType = result.errors.length > 0 ? 'warning' : result.createdJobs > 0 ? 'success' : 'info';

      redirectWithNotice(response, '/admin/jobs', message, noticeType);
    } catch (error) {
      logger.error('Erro ao coletar providers externos pelo admin.', error);
      redirectWithNotice(response, '/admin/jobs', 'Erro ao coletar fontes externas.', 'error');
    }
  });

  router.post('/admin/jobs/collect-ats', async (_request, response) => {
    try {
      logger.info('Coleta manual de providers ATS publicos iniciada pelo admin.');
      const collectionResult = await runRealJobCollection('manual', atsJobProviders);

      if (collectionResult.skipped || !collectionResult.summary) {
        redirectWithNotice(
          response,
          '/admin/jobs',
          'Coleta ATS ignorada porque outra coleta ja esta em execucao.',
          'warning',
        );
        return;
      }

      const result = collectionResult.summary;
      const message = buildProviderCollectionNotice('Coleta ATS', result);
      const noticeType = result.errors.length > 0 ? 'warning' : result.createdJobs > 0 ? 'success' : 'info';

      redirectWithNotice(response, '/admin/jobs', message, noticeType);
    } catch (error) {
      logger.error('Erro ao coletar providers ATS pelo admin.', error);
      redirectWithNotice(response, '/admin/jobs', 'Erro ao coletar ATS publicos.', 'error');
    }
  });

  router.post('/admin/jobs/collect-gupy', async (_request, response) => {
    try {
      logger.info('Coleta manual experimental Gupy iniciada pelo admin.');
      const collectionResult = await runRealJobCollection('manual', [gupyProvider]);

      if (collectionResult.skipped || !collectionResult.summary) {
        redirectWithNotice(
          response,
          '/admin/jobs',
          'Coleta Gupy ignorada porque outra coleta ja esta em execucao.',
          'warning',
        );
        return;
      }

      const result = collectionResult.summary;
      const message = buildGupyCollectionNotice(result);
      const noticeType = result.errors.length > 0 ? 'warning' : result.createdJobs > 0 ? 'success' : 'info';

      redirectWithNotice(response, '/admin/jobs', message, noticeType);
    } catch (error) {
      logger.error('Erro ao coletar Gupy pelo admin.', error);
      redirectWithNotice(response, '/admin/jobs', 'Erro ao coletar Gupy.', 'error');
    }
  });

  router.post('/admin/jobs/collect-programathor', async (_request, response) => {
    try {
      logger.info('Coleta manual experimental Programathor iniciada pelo admin.');
      const collectionResult = await runRealJobCollection('manual', [programathorProvider]);

      if (collectionResult.skipped || !collectionResult.summary) {
        redirectWithNotice(
          response,
          '/admin/jobs',
          'Coleta Programathor ignorada porque outra coleta ja esta em execucao.',
          'warning',
        );
        return;
      }

      const result = collectionResult.summary;
      const message = buildProgramathorCollectionNotice(result);
      const noticeType = result.errors.length > 0 ? 'warning' : result.createdJobs > 0 ? 'success' : 'info';

      redirectWithNotice(response, '/admin/jobs', message, noticeType);
    } catch (error) {
      logger.error('Erro ao coletar Programathor pelo admin.', error);
      redirectWithNotice(response, '/admin/jobs', 'Erro ao coletar Programathor.', 'error');
    }
  });

  router.post('/admin/jobs/collect-remotar', async (_request, response) => {
    try {
      logger.info('Coleta manual Remotar iniciada pelo admin.');
      const collectionResult = await runRealJobCollection('manual', [remotarProvider]);

      if (collectionResult.skipped || !collectionResult.summary) {
        redirectWithNotice(
          response,
          '/admin/jobs',
          'Coleta Remotar ignorada porque outra coleta ja esta em execucao.',
          'warning',
        );
        return;
      }

      const result = collectionResult.summary;
      const message = buildRemotarCollectionNotice(result);
      const noticeType = result.errors.length > 0 ? 'warning' : result.createdJobs > 0 ? 'success' : 'info';

      redirectWithNotice(response, '/admin/jobs', message, noticeType);
    } catch (error) {
      logger.error('Erro ao coletar Remotar pelo admin.', error);
      redirectWithNotice(response, '/admin/jobs', 'Erro ao coletar Remotar.', 'error');
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

  router.post('/admin/jobs/:id/prepare', async (request, response) => {
    const job = await findJobOrRenderNotFound(request.params.id, response);

    if (!job) {
      return;
    }

    if (job.status === JobStatus.SENT || job.status === JobStatus.ARCHIVED) {
      redirectWithNotice(
        response,
        `/admin/jobs/${job.id}`,
        'Esta vaga ja foi enviada ou arquivada e nao pode ser preparada para a fila.',
        'warning',
      );
      return;
    }

    try {
      logger.info('Preparacao de vaga com IA iniciada pelo admin.', {
        jobId: job.id,
        title: job.title,
        status: job.status,
      });
      const generatedMessage = await generateJobMessage(job);

      await prisma.jobPost.update({
        where: { id: job.id },
        data: {
          aiGeneratedText: generatedMessage,
          status: JobStatus.PENDING,
          useAi: true,
        },
      });

      logger.info('Vaga preparada e colocada na fila.', {
        jobId: job.id,
        previousStatus: job.status,
        nextStatus: JobStatus.PENDING,
        messageLength: generatedMessage.length,
      });

      redirectWithNotice(
        response,
        `/admin/jobs/${job.id}`,
        job.status === JobStatus.PENDING
          ? 'Mensagem com IA regenerada e vaga mantida na fila.'
          : 'Vaga preparada com IA e colocada na fila de envio.',
      );
    } catch (error) {
      logger.error('Erro ao preparar vaga com IA pelo admin.', error, {
        jobId: job.id,
        title: job.title,
        status: job.status,
      });
      redirectWithNotice(
        response,
        `/admin/jobs/${job.id}`,
        job.status === JobStatus.PENDING
          ? 'Nao foi possivel regenerar a mensagem com IA agora. A vaga foi mantida como estava.'
          : 'Nao foi possivel preparar a vaga com IA agora. A vaga foi mantida sem entrar na fila.',
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

function groupJobsByStatus(jobs: JobPost[]): JobsByStatus {
  return {
    draft: jobs.filter((job) => job.status === JobStatus.DRAFT).sort(compareDraftJobsByPriority),
    pending: jobs.filter((job) => job.status === JobStatus.PENDING),
    history: jobs.filter((job) => job.status === JobStatus.SENT || job.status === JobStatus.ERROR),
    archived: jobs.filter((job) => job.status === JobStatus.ARCHIVED),
  };
}

function compareDraftJobsByPriority(a: JobPost, b: JobPost): number {
  const priorityDifference = getPrioritySortValue(a.priority) - getPrioritySortValue(b.priority);

  if (priorityDifference !== 0) {
    return priorityDifference;
  }

  return b.createdAt.getTime() - a.createdAt.getTime();
}

function getPrioritySortValue(priority: JobPost['priority']): number {
  if (priority === 'HIGH') {
    return 0;
  }

  if (priority === 'MEDIUM') {
    return 1;
  }

  if (priority === 'LOW') {
    return 2;
  }

  return 3;
}
