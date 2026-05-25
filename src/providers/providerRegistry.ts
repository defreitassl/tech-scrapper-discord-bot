import { ashbyProvider } from './ashby.provider';
import { greenhouseProvider } from './greenhouse.provider';
import { gupyProvider } from './gupy.provider';
import { githubJobsProvider } from './githubJobs.provider';
import { himalayasProvider } from './himalayas.provider';
import { jobicyProvider } from './jobicy.provider';
import { leverProvider } from './lever.provider';
import { mockJobsProvider } from './mockJobs.provider';
import { programathorProvider } from './programathor.provider';
import { remotarProvider } from './remotar.provider';
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
export const atsJobProviders: JobSourceProvider[] = [greenhouseProvider, leverProvider, ashbyProvider];
export const experimentalJobProviders: JobSourceProvider[] = [gupyProvider, programathorProvider];
export const realJobProviders: JobSourceProvider[] = [githubJobsProvider, ...externalJobProviders, remotarProvider];
export const activeJobProviders: JobSourceProvider[] = [...testJobProviders, ...realJobProviders, ...atsJobProviders];
