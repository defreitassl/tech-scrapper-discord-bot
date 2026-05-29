import { CollectionSchedulerSettings } from '@prisma/client';
import { prisma } from '../lib/prisma';

export const DEFAULT_COLLECTION_SCHEDULER_SETTINGS_ID = 'default';
export const DEFAULT_COLLECTION_SCHEDULER_TIMEZONE = 'America/Sao_Paulo';
export const COLLECTION_FREQUENCIES = ['WEEKLY_ONCE', 'WEEKLY_TWICE'] as const;
export const COLLECTION_WEEKDAYS = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
] as const;
export const AVAILABLE_COLLECTION_TIMES = ['07:00', '08:00', '09:00', '10:00', '14:00', '16:00', '18:00'] as const;

export type CollectionFrequency = (typeof COLLECTION_FREQUENCIES)[number];
export type CollectionWeekday = (typeof COLLECTION_WEEKDAYS)[number];

export type CollectionSchedulerSettingsInput = {
  enabled: boolean;
  frequency: string;
  weekdays: string[];
  collectTime: string;
  timezone: string;
};

const DEFAULT_COLLECTION_FREQUENCY: CollectionFrequency = 'WEEKLY_ONCE';
const DEFAULT_COLLECTION_WEEKDAYS: CollectionWeekday[] = ['MONDAY'];
const DEFAULT_COLLECTION_TIME = '08:00';

export async function getCollectionSchedulerSettings(): Promise<CollectionSchedulerSettings> {
  const settings = await prisma.collectionSchedulerSettings.findUnique({
    where: { id: DEFAULT_COLLECTION_SCHEDULER_SETTINGS_ID },
  });

  if (settings) {
    return settings;
  }

  const defaults = getDefaultCollectionSchedulerSettings();

  return prisma.collectionSchedulerSettings.create({
    data: {
      id: DEFAULT_COLLECTION_SCHEDULER_SETTINGS_ID,
      enabled: defaults.enabled,
      frequency: defaults.frequency,
      weekdays: defaults.weekdays,
      collectTime: defaults.collectTime,
      timezone: defaults.timezone,
    },
  });
}

export async function updateCollectionSchedulerSettings(
  input: CollectionSchedulerSettingsInput,
): Promise<CollectionSchedulerSettings> {
  const normalizedInput = normalizeCollectionSchedulerSettingsInput(input);

  return prisma.collectionSchedulerSettings.upsert({
    where: { id: DEFAULT_COLLECTION_SCHEDULER_SETTINGS_ID },
    create: {
      id: DEFAULT_COLLECTION_SCHEDULER_SETTINGS_ID,
      enabled: normalizedInput.enabled,
      frequency: normalizedInput.frequency,
      weekdays: normalizedInput.weekdays,
      collectTime: normalizedInput.collectTime,
      timezone: normalizedInput.timezone,
    },
    update: {
      enabled: normalizedInput.enabled,
      frequency: normalizedInput.frequency,
      weekdays: normalizedInput.weekdays,
      collectTime: normalizedInput.collectTime,
      timezone: normalizedInput.timezone,
    },
  });
}

export function validateCollectionSchedulerSettings(input: CollectionSchedulerSettingsInput): string | null {
  if (!isAllowedCollectionFrequency(input.frequency)) {
    return 'Escolha uma frequencia valida para a coleta.';
  }

  if (input.timezone !== DEFAULT_COLLECTION_SCHEDULER_TIMEZONE) {
    return `Timezone invalido. O sistema usa ${DEFAULT_COLLECTION_SCHEDULER_TIMEZONE}.`;
  }

  if (!isAllowedCollectionTime(input.collectTime)) {
    return 'Escolha um horario de coleta valido.';
  }

  const uniqueWeekdays = uniqueAllowedWeekdays(input.weekdays);
  const expectedWeekdayCount = input.frequency === 'WEEKLY_TWICE' ? 2 : 1;

  if (uniqueWeekdays.length !== expectedWeekdayCount) {
    return input.frequency === 'WEEKLY_TWICE'
      ? 'Escolha exatamente 2 dias diferentes para coletar duas vezes por semana.'
      : 'Escolha exatamente 1 dia para coletar uma vez por semana.';
  }

  return null;
}

export function getDefaultCollectionSchedulerSettings(): CollectionSchedulerSettingsInput {
  return {
    enabled: false,
    frequency: DEFAULT_COLLECTION_FREQUENCY,
    weekdays: DEFAULT_COLLECTION_WEEKDAYS,
    collectTime: DEFAULT_COLLECTION_TIME,
    timezone: DEFAULT_COLLECTION_SCHEDULER_TIMEZONE,
  };
}

export function normalizeCollectionSchedulerSettings(
  settings: CollectionSchedulerSettings,
): CollectionSchedulerSettings {
  const normalized = normalizeCollectionSchedulerSettingsInput(settings);

  return {
    ...settings,
    frequency: normalized.frequency,
    weekdays: normalized.weekdays,
    collectTime: normalized.collectTime,
    timezone: normalized.timezone,
  };
}

export function normalizeCollectionSchedulerSettingsInput(
  input: CollectionSchedulerSettingsInput,
): CollectionSchedulerSettingsInput {
  const frequency = isAllowedCollectionFrequency(input.frequency) ? input.frequency : DEFAULT_COLLECTION_FREQUENCY;
  const expectedWeekdayCount = frequency === 'WEEKLY_TWICE' ? 2 : 1;
  const weekdays = uniqueAllowedWeekdays(input.weekdays).slice(0, expectedWeekdayCount);

  while (weekdays.length < expectedWeekdayCount) {
    const nextWeekday = DEFAULT_COLLECTION_WEEKDAYS[weekdays.length] ?? COLLECTION_WEEKDAYS[weekdays.length];

    if (!weekdays.includes(nextWeekday)) {
      weekdays.push(nextWeekday);
    } else {
      weekdays.push(COLLECTION_WEEKDAYS.find((weekday) => !weekdays.includes(weekday)) ?? 'MONDAY');
    }
  }

  return {
    enabled: input.enabled,
    frequency,
    weekdays,
    collectTime: isAllowedCollectionTime(input.collectTime) ? input.collectTime : DEFAULT_COLLECTION_TIME,
    timezone: DEFAULT_COLLECTION_SCHEDULER_TIMEZONE,
  };
}

export function isAllowedCollectionFrequency(value: string): value is CollectionFrequency {
  return COLLECTION_FREQUENCIES.some((option) => option === value);
}

export function isAllowedCollectionTime(value: string): boolean {
  return AVAILABLE_COLLECTION_TIMES.some((option) => option === value);
}

export function isAllowedCollectionWeekday(value: string): value is CollectionWeekday {
  return COLLECTION_WEEKDAYS.some((option) => option === value);
}

function uniqueAllowedWeekdays(weekdays: string[]): CollectionWeekday[] {
  return COLLECTION_WEEKDAYS.filter((weekday) => weekdays.includes(weekday));
}
