import { JobPost, JobStatus, SchedulerSettings } from '@prisma/client';
import { prisma } from '../lib/prisma';

export type SchedulerDailyUsage = {
  sentToday: number;
  remainingToday: number;
  dayStart: Date;
  dayEnd: Date;
};

export async function getSchedulerDailyUsage(
  settings: Pick<SchedulerSettings, 'dailyLimit' | 'timezone'>,
  date = new Date(),
): Promise<SchedulerDailyUsage> {
  const { start, end } = getZonedDayBounds(date, settings.timezone);
  const sentToday = await countSentJobsToday(settings.timezone, date);

  return {
    sentToday,
    remainingToday: Math.max(settings.dailyLimit - sentToday, 0),
    dayStart: start,
    dayEnd: end,
  };
}

export async function countSentJobsToday(timeZone: string, date = new Date()): Promise<number> {
  const { start, end } = getZonedDayBounds(date, timeZone);

  return prisma.jobPost.count({
    where: {
      status: JobStatus.SENT,
      sentAt: {
        gte: start,
        lt: end,
      },
    },
  });
}

export async function getUpcomingPendingJobs(limit = 5): Promise<JobPost[]> {
  return prisma.jobPost.findMany({
    where: { status: JobStatus.PENDING },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });
}

export function getZonedDayBounds(date: Date, timeZone: string): { start: Date; end: Date } {
  const parts = getDatePartsInTimeZone(date, timeZone);
  const start = zonedTimeToUtc(parts.year, parts.month, parts.day, 0, 0, 0, timeZone);
  const endLocalDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1, 0, 0, 0));
  const endParts = {
    year: endLocalDate.getUTCFullYear(),
    month: endLocalDate.getUTCMonth() + 1,
    day: endLocalDate.getUTCDate(),
  };
  const end = zonedTimeToUtc(endParts.year, endParts.month, endParts.day, 0, 0, 0, timeZone);

  return { start, end };
}

function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
): Date {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const zonedParts = getDateTimePartsInTimeZone(utcGuess, timeZone);
  const zonedAsUtc = Date.UTC(
    zonedParts.year,
    zonedParts.month - 1,
    zonedParts.day,
    zonedParts.hour,
    zonedParts.minute,
    zonedParts.second,
  );
  const offset = zonedAsUtc - utcGuess.getTime();

  return new Date(utcGuess.getTime() - offset);
}

function getDatePartsInTimeZone(date: Date, timeZone: string): { year: number; month: number; day: number } {
  const parts = getDateTimePartsInTimeZone(date, timeZone);

  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
  };
}

function getDateTimePartsInTimeZone(
  date: Date,
  timeZone: string,
): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const values = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  const hour = Number(values.hour);

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: hour === 24 ? 0 : hour,
    minute: Number(values.minute),
    second: Number(values.second),
  };
}
