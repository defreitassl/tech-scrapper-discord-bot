import { SchedulerSettings } from '@prisma/client';
import { prisma } from '../lib/prisma';

export const DEFAULT_SCHEDULER_SETTINGS_ID = 'default';
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

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
      sendTimes: [],
    },
  });
}

export async function updateSchedulerSettings(input: SchedulerSettingsUpdateInput): Promise<SchedulerSettings> {
  return prisma.schedulerSettings.upsert({
    where: { id: DEFAULT_SCHEDULER_SETTINGS_ID },
    create: {
      id: DEFAULT_SCHEDULER_SETTINGS_ID,
      enabled: input.enabled,
      dailyLimit: input.dailyLimit,
      timezone: input.timezone,
      sendTimes: input.sendTimes,
    },
    update: {
      enabled: input.enabled,
      dailyLimit: input.dailyLimit,
      timezone: input.timezone,
      sendTimes: input.sendTimes,
    },
  });
}

export function parseSendTimes(value: string): { sendTimes: string[]; error: string | null } {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const invalidTime = lines.find((line) => !TIME_PATTERN.test(line));

  if (invalidTime) {
    return {
      sendTimes: [],
      error: `Horario invalido: ${invalidTime}. Use o formato HH:mm, por exemplo 10:00.`,
    };
  }

  return {
    sendTimes: Array.from(new Set(lines)).sort(),
    error: null,
  };
}

export function validateSchedulerSettingsInput(input: SchedulerSettingsUpdateInput): string | null {
  if (!Number.isInteger(input.dailyLimit) || input.dailyLimit < 1) {
    return 'O limite diario precisa ser um numero inteiro maior que zero.';
  }

  if (!isValidTimeZone(input.timezone)) {
    return 'Timezone invalido. Use um identificador como America/Sao_Paulo.';
  }

  return null;
}

function isValidTimeZone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('pt-BR', { timeZone: timezone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}
