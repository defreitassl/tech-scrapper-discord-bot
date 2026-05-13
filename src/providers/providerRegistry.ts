import { mockJobsProvider } from './mockJobs.provider';
import type { JobSourceProvider } from './types';

export const activeJobProviders: JobSourceProvider[] = [mockJobsProvider];
