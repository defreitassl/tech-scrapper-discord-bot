import type { CollectedJob } from '../providers/types';
import { classifyJobDomain } from '../services/jobDomainClassifier';
import { evaluateCollectedJobQuality } from '../services/jobQualityFilter';
import { evaluateJobPriority } from '../services/jobPriority';

type Sample = {
  title: string;
  shortDescription: string;
};

const SAMPLES: Sample[] = [
  {
    title: 'Estágio em Direito Societário',
    shortDescription: 'Atuação com rotinas jurídicas societárias, contratos e apoio ao time de advocacia.',
  },
  {
    title: 'Estágio em Marketing de Performance',
    shortDescription: 'Apoio em campanhas de mídia paga, conteúdo e análise de performance marketing.',
  },
  {
    title: 'Estágio em Afiliados e Parcerias',
    shortDescription: 'Contato com parceiros, agências, afiliados e acompanhamento comercial.',
  },
  {
    title: 'Estágio em Suporte Técnico',
    shortDescription: 'Atendimento de chamados, suporte de TI, help desk e apoio técnico aos usuários.',
  },
  {
    title: 'Estágio em Desenvolvimento Front-end',
    shortDescription: 'Desenvolvimento front-end com React, JavaScript, HTML e CSS em produto web.',
  },
  {
    title: 'QA Junior',
    shortDescription: 'Testes de software, quality assurance, automação de testes e análise de bugs.',
  },
];

function main(): void {
  const diagnostics = SAMPLES.map((sample) => {
    const job = buildSampleJob(sample);
    const domain = classifyJobDomain(job);
    const quality = evaluateCollectedJobQuality(job);
    const priority = evaluateJobPriority(job);

    return {
      title: sample.title,
      domain: domain.domain,
      techMatches: domain.techMatches,
      nonTechMatches: domain.nonTechMatches,
      qualityAccepted: quality.accepted,
      qualityReasons: quality.reasons,
      priority: priority.priority,
      priorityScore: priority.score,
    };
  });

  console.log(JSON.stringify({ generatedAt: new Date().toISOString(), diagnostics }, null, 2));
}

function buildSampleJob(sample: Sample): CollectedJob {
  return {
    title: sample.title,
    company: 'Empresa exemplo',
    location: 'Remoto',
    modality: 'Remoto',
    level: 'Estágio',
    stacks: null,
    salaryRange: null,
    shortDescription: sample.shortDescription,
    rawText: `${sample.shortDescription} Candidate-se em https://example.com/vagas.`,
    url: 'https://example.com/vagas',
    source: 'diagnostic',
    collectedAt: new Date(),
  };
}

main();
