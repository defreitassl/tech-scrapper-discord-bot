import { CollectionSchedulerSettings, JobPost, JobStatus, SchedulerSettings } from '@prisma/client';
import {
  DEFAULT_COLLECTION_SCHEDULER_TIMEZONE,
  getDefaultCollectionSchedulerSettings,
  normalizeCollectionSchedulerSettings,
} from '../../services/collectionSchedulerSettings';
import {
  AVAILABLE_SEND_TIMES,
  DEFAULT_SCHEDULER_TIMEZONE,
  normalizeSchedulerSettings,
} from '../../services/schedulerSettings';
import { statuses } from './status';

export type JobFormData = {
  title: string | null;
  company: string | null;
  location: string | null;
  modality: string | null;
  level: string | null;
  stacks: string | null;
  salaryRange: string | null;
  shortDescription: string | null;
  url: string | null;
  source: string | null;
  rawText: string | null;
  readyText: string | null;
  useAi: boolean;
  status: JobStatus;
};

export type ScheduleFormData = {
  enabled: boolean;
  dailyLimit: number;
  timezone: string;
  sendTimes: string[];
};

export type CollectionScheduleFormData = {
  enabled: boolean;
  frequency: string;
  weekdays: string[];
  collectTime: string;
  timezone: string;
};

export function parseJobForm(body: unknown): JobFormData {
  return {
    title: optionalText(body, 'title'),
    company: optionalText(body, 'company'),
    location: optionalText(body, 'location'),
    modality: optionalText(body, 'modality'),
    level: optionalText(body, 'level'),
    stacks: optionalText(body, 'stacks'),
    salaryRange: optionalText(body, 'salaryRange'),
    shortDescription: optionalText(body, 'shortDescription'),
    url: optionalText(body, 'url'),
    source: optionalText(body, 'source'),
    rawText: optionalText(body, 'rawText'),
    readyText: optionalText(body, 'readyText'),
    useAi: fieldValue(body, 'useAi') === 'on',
    status: parseStatus(fieldValue(body, 'status')),
  };
}

export function parseScheduleSettingsForm(body: unknown): ScheduleFormData {
  return {
    enabled: fieldValue(body, 'enabled') === 'on',
    dailyLimit: Number(fieldValue(body, 'dailyLimit')),
    timezone: DEFAULT_SCHEDULER_TIMEZONE,
    sendTimes: fieldValues(body, 'sendTimes'),
  };
}

export function parseCollectionScheduleSettingsForm(body: unknown): CollectionScheduleFormData {
  return {
    enabled: fieldValue(body, 'enabled') === 'on',
    frequency: fieldValue(body, 'frequency'),
    weekdays: fieldValues(body, 'weekdays'),
    collectTime: fieldValue(body, 'collectTime'),
    timezone: DEFAULT_COLLECTION_SCHEDULER_TIMEZONE,
  };
}

export function optionalText(body: unknown, field: string): string | null {
  const value = fieldValue(body, field).trim();
  return value.length > 0 ? value : null;
}

export function fieldValue(body: unknown, field: string): string {
  if (!body || typeof body !== 'object') {
    return '';
  }

  const value = (body as Record<string, unknown>)[field];

  if (typeof value !== 'string') {
    return '';
  }

  return value;
}

export function fieldValues(body: unknown, field: string): string[] {
  if (!body || typeof body !== 'object') {
    return [];
  }

  const value = (body as Record<string, unknown>)[field];

  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }

  if (typeof value === 'string') {
    return [value];
  }

  return [];
}

export function parseStatus(value: string): JobStatus {
  if (statuses.includes(value as JobStatus)) {
    return value as JobStatus;
  }

  return JobStatus.PENDING;
}

export function scheduleFormFromSettings(settings?: SchedulerSettings): ScheduleFormData {
  const normalizedSettings = settings ? normalizeSchedulerSettings(settings) : null;

  return {
    enabled: normalizedSettings?.enabled ?? false,
    dailyLimit: normalizedSettings?.dailyLimit ?? 5,
    timezone: normalizedSettings?.timezone ?? DEFAULT_SCHEDULER_TIMEZONE,
    sendTimes: normalizedSettings?.sendTimes ?? AVAILABLE_SEND_TIMES.slice(0, 5),
  };
}

export function collectionScheduleFormFromSettings(
  settings?: CollectionSchedulerSettings,
): CollectionScheduleFormData {
  const defaults = getDefaultCollectionSchedulerSettings();
  const normalizedSettings = settings ? normalizeCollectionSchedulerSettings(settings) : null;

  return {
    enabled: normalizedSettings?.enabled ?? defaults.enabled,
    frequency: normalizedSettings?.frequency ?? defaults.frequency,
    weekdays: normalizedSettings?.weekdays ?? defaults.weekdays,
    collectTime: normalizedSettings?.collectTime ?? defaults.collectTime,
    timezone: normalizedSettings?.timezone ?? defaults.timezone,
  };
}

export function formFromJob(job?: JobPost): JobFormData {
  return {
    title: job?.title ?? null,
    company: job?.company ?? null,
    location: job?.location ?? null,
    modality: job?.modality ?? null,
    level: job?.level ?? null,
    stacks: job?.stacks ?? null,
    salaryRange: job?.salaryRange ?? null,
    shortDescription: job?.shortDescription ?? null,
    url: job?.url ?? null,
    source: job?.source ?? null,
    rawText: job?.rawText ?? null,
    readyText: job?.readyText ?? null,
    useAi: job?.useAi ?? true,
    status: job?.status ?? JobStatus.PENDING,
  };
}
