import { gupyProvider } from './gupy.provider';
import { githubJobsProvider } from './githubJobs.provider';
import { himalayasProvider } from './himalayas.provider';
import { jobicyProvider } from './jobicy.provider';
import { programathorProvider } from './programathor.provider';
import { remotarProvider } from './remotar.provider';
import { remoteOkProvider } from './remoteOk.provider';
import { remotiveProvider } from './remotive.provider';
import { solidesProvider } from './solides.provider';
import type { JobSourceProvider } from './types';

const publicApiJobProviders: JobSourceProvider[] = [
  himalayasProvider,
  jobicyProvider,
  remoteOkProvider,
  remotiveProvider,
];

// Coleta agendada: fontes principais e seguras do MVP.
export const automaticJobProviders: JobSourceProvider[] = [
  githubJobsProvider,
  ...publicApiJobProviders,
  remotarProvider,
  gupyProvider,
  programathorProvider,
  solidesProvider,
];

// Botao "Coletar vagas": hoje usa a mesma lista do agendamento.
export const manualJobProviders: JobSourceProvider[] = automaticJobProviders;
