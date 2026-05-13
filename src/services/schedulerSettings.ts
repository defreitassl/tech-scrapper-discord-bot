import { SchedulerSettings } from '@prisma/client';
import { prisma } from '../lib/prisma';

export const DEFAULT_SCHEDULER_SETTINGS_ID = 'default';
export const DEFAULT_SCHEDULER_TIMEZONE = 'America/Sao_Paulo';
export const DAILY_LIMIT_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
export const AVAILABLE_SEND_TIMES = [
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
  '18:00',
  '19:00',
  '20:00',
  '21:00',
] as const;

const DEFAULT_DAILY_LIMIT = 5;

export type SchedulerSettingsUpdateInput = {
  enabled: boolean;
  dailyLimit: number;
  timezone: string;
  sendTimes: string[];
};

export async function getSchedulerSettings(): Promise<SchedulerSettings> {
  const settings = await prisma.schedulerSettings.findUnique({
    where: { id: DEFAULT_SCHEDULER_SETTINGS_ID },
  });

  if (settings) {
    return settings;
  }

  return prisma.schedulerSettings.create({
    data: {
      id: DEFAULT_SCHEDULER_SETTINGS_ID,
      dailyLimit: DEFAULT_DAILY_LIMIT,
      timezone: DEFAULT_SCHEDULER_TIMEZONE,
      sendTimes: [],
    },
  });
}

export async function updateSchedulerSettings(input: SchedulerSettingsUpdateInput): Promise<SchedulerSettings> {
  const normalizedInput = normalizeSchedulerSettingsInput(input);

  return prisma.schedulerSettings.upsert({
    where: { id: DEFAULT_SCHEDULER_SETTINGS_ID },
    create: {
      id: DEFAULT_SCHEDULER_SETTINGS_ID,
      enabled: normalizedInput.enabled,
      dailyLimit: normalizedInput.dailyLimit,
      timezone: normalizedInput.timezone,
      sendTimes: normalizedInput.sendTimes,
    },
    update: {
      enabled: normalizedInput.enabled,
      dailyLimit: normalizedInput.dailyLimit,
      timezone: normalizedInput.timezone,
      sendTimes: normalizedInput.sendTimes,
    },
  });
}

export function normalizeSchedulerSettings(settings: SchedulerSettings): SchedulerSettings {
  const normalized = normalizeSchedulerSettingsInput(settings);

  return {
    ...settings,
    dailyLimit: normalized.dailyLimit,
    timezone: normalized.timezone,
    sendTimes: normalized.sendTimes,
  };
}

export function normalizeSchedulerSettingsInput(input: SchedulerSettingsUpdateInput): SchedulerSettingsUpdateInput {
  const dailyLimit = normalizeDailyLimit(input.dailyLimit);

  return {
    enabled: input.enabled,
    dailyLimit,
    timezone: DEFAULT_SCHEDULER_TIMEZONE,
    sendTimes: normalizeSendTimes(input.sendTimes, dailyLimit),
  };
}

export function countSendTimeSlots(sendTimes: string[]): Map<string, number> {
  return sendTimes.reduce((slots, sendTime) => {
    slots.set(sendTime, (slots.get(sendTime) ?? 0) + 1);
    return slots;
  }, new Map<string, number>());
}

export function validateSchedulerSettingsInput(input: SchedulerSettingsUpdateInput): string | null {
  if (!isAllowedDailyLimit(input.dailyLimit)) {
    return 'Escolha uma quantidade de vagas por dia entre 1 e 10.';
  }

  if (input.timezone !== DEFAULT_SCHEDULER_TIMEZONE) {
    return `Timezone invalido. O sistema usa ${DEFAULT_SCHEDULER_TIMEZONE}.`;
  }

  if (input.sendTimes.length !== input.dailyLimit) {
    return 'Escolha um horario para cada vaga do dia.';
  }

  const invalidTime = input.sendTimes.find((sendTime) => !isAllowedSendTime(sendTime));

  if (invalidTime) {
    return `Horario invalido: ${invalidTime}. Escolha um horario entre 09:00 e 21:00.`;
  }

  return null;
}

export function isAllowedDailyLimit(value: number): boolean {
  return DAILY_LIMIT_OPTIONS.some((option) => option === value);
}

export function isAllowedSendTime(value: string): boolean {
  return AVAILABLE_SEND_TIMES.some((option) => option === value);
}

function normalizeDailyLimit(value: number): number {
  return isAllowedDailyLimit(value) ? value : DEFAULT_DAILY_LIMIT;
}

function normalizeSendTimes(sendTimes: string[], dailyLimit: number): string[] {
  const validSendTimes = sendTimes.filter(isAllowedSendTime).slice(0, dailyLimit);
  const normalizedSendTimes = [...validSendTimes];

  while (normalizedSendTimes.length < dailyLimit) {
    normalizedSendTimes.push(AVAILABLE_SEND_TIMES[normalizedSendTimes.length % AVAILABLE_SEND_TIMES.length]);
  }

  return normalizedSendTimes;
}
