export type AdminEventType = 'collection' | 'publish' | 'system';
export type AdminEventStatus = 'started' | 'progress' | 'success' | 'warning' | 'error' | 'skipped';

export type AdminEvent = {
  id: string;
  type: AdminEventType;
  status: AdminEventStatus;
  title: string;
  message: string;
  details?: Record<string, unknown>;
  createdAt: string;
};

type AdminEventInput = Omit<AdminEvent, 'id' | 'createdAt'>;
type AdminEventListener = (event: AdminEvent) => void;

const MAX_RECENT_EVENTS = 30;
const listeners = new Set<AdminEventListener>();
const recentEvents: AdminEvent[] = [];

let nextEventId = 1;

export function publishAdminEvent(input: AdminEventInput): AdminEvent {
  const event: AdminEvent = {
    id: String(nextEventId),
    createdAt: new Date().toISOString(),
    ...input,
  };

  nextEventId += 1;
  recentEvents.unshift(event);

  if (recentEvents.length > MAX_RECENT_EVENTS) {
    recentEvents.pop();
  }

  for (const listener of listeners) {
    listener(event);
  }

  return event;
}

export function getRecentAdminEvents(): AdminEvent[] {
  return [...recentEvents].reverse();
}

export function subscribeToAdminEvents(listener: AdminEventListener): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}
