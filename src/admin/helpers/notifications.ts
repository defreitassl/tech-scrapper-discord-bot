import type { Response } from 'express';

export type NoticeType = 'success' | 'error' | 'warning' | 'info' | 'loading';

export type AdminNotice = {
  message: string;
  type: NoticeType;
};

const noticeTypes: NoticeType[] = ['success', 'error', 'warning', 'info', 'loading'];

export function getNoticeFromQuery(query: {
  message?: unknown;
  error?: unknown;
  noticeType?: unknown;
}): AdminNotice | undefined {
  if (typeof query.error === 'string') {
    return {
      message: query.error,
      type: 'error',
    };
  }

  if (typeof query.message !== 'string') {
    return undefined;
  }

  return {
    message: query.message,
    type: parseNoticeType(query.noticeType),
  };
}

export function redirectWithNotice(
  response: Response,
  path: string,
  message: string,
  type: NoticeType = 'success',
): void {
  const url = new URL(path, 'http://admin.local');

  url.searchParams.set('message', message);
  url.searchParams.set('noticeType', type);

  response.redirect(`${url.pathname}${url.search}`);
}

function parseNoticeType(value: unknown): NoticeType {
  if (typeof value === 'string' && noticeTypes.includes(value as NoticeType)) {
    return value as NoticeType;
  }

  return 'success';
}
