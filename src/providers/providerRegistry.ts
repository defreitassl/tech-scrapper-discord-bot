import { githubJobsProvider } from './githubJobs.provider';
import { himalayasProvider } from './himalayas.provider';
import { jobicyProvider } from './jobicy.provider';
import { mockJobsProvider } from './mockJobs.provider';
import { remoteOkProvider } from './remoteOk.provider';
import { remotiveProvider } from './remotive.provider';
import type { JobSourceProvider } from './types';

export const testJobProviders: JobSourceProvider[] = [mockJobsProvider];
export const externalJobProviders: JobSourceProvider[] = [
  himalayasProvider,
  jobicyProvider,
  remoteOkProvider,
  remotiveProvider,
];
export const realJobProviders: JobSourceProvider[] = [githubJobsProvider, ...externalJobProviders];
export const activeJobProviders: JobSourceProvider[] = [...testJobProviders, ...realJobProviders];
