import type { JobSourceProvider } from './types';

export const mockJobsProvider: JobSourceProvider = {
  name: 'mock',
  async collect() {
    const collectedAt = new Date();

    return [
      {
        title: 'Estagio em Desenvolvimento Front-end',
        company: 'Estudio Pixel Verde',
        location: 'Remoto - Brasil',
        modality: 'Remoto',
        level: 'Estagio',
        stacks: 'HTML, CSS, JavaScript, React',
        salaryRange: 'Bolsa de R$ 1.400',
        shortDescription:
          'Apoio na construcao de interfaces web, ajustes visuais e pequenas melhorias em componentes para produtos digitais.',
        rawText:
          'Estagio em Desenvolvimento Front-end na Estudio Pixel Verde. Atividades: apoiar a construcao de interfaces web, revisar componentes e colaborar com o time de produto. Requisitos: HTML, CSS, JavaScript e nocao de React.',
        url: 'https://example.local/jobs/mock-front-end-intern',
        source: 'mock',
        collectedAt,
      },
      {
        title: 'Desenvolvedor(a) Junior',
        company: 'Nuvem Dados',
        location: 'Belo Horizonte - MG',
        modality: 'Hibrido',
        level: 'Junior',
        stacks: 'TypeScript, Node.js, PostgreSQL',
        salaryRange: null,
        shortDescription:
          'Vaga para atuar em manutencao de APIs, correcoes de bugs e pequenas entregas acompanhadas por pessoas mais experientes.',
        rawText:
          'Desenvolvedor(a) Junior na Nuvem Dados em Belo Horizonte. Atuacao hibrida com APIs em Node.js, TypeScript e PostgreSQL. Perfil iniciante com vontade de aprender e trabalhar em equipe.',
        url: 'https://example.local/jobs/mock-junior-developer',
        source: 'mock',
        collectedAt,
      },
      {
        title: 'Suporte Tecnico Junior',
        company: 'Conecta Escola',
        location: 'Contagem - MG',
        modality: 'Presencial',
        level: 'Junior',
        stacks: 'Atendimento, Redes, Windows, Linux',
        salaryRange: null,
        shortDescription:
          'Atendimento a usuarios, triagem de chamados e apoio na configuracao de equipamentos e acessos internos.',
        rawText:
          'Suporte Tecnico Junior na Conecta Escola. Responsabilidades: atender usuarios, registrar chamados, configurar computadores e apoiar demandas basicas de rede. Desejavel conhecimento inicial em Windows, Linux e redes.',
        url: 'https://example.local/jobs/mock-junior-support',
        source: 'mock',
        collectedAt,
      },
    ];
  },
};
