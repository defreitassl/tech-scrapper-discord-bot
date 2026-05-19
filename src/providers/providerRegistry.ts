import { githubJobsProvider } from './githubJobs.provider';
import { mockJobsProvider } from './mockJobs.provider';
import type { JobSourceProvider } from './types';

export const testJobProviders: JobSourceProvider[] = [mockJobsProvider];
export const realJobProviders: JobSourceProvider[] = [githubJobsProvider];
export const activeJobProviders: JobSourceProvider[] = [...testJobProviders, ...realJobProviders];
