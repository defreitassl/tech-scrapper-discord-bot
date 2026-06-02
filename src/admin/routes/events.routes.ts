import express from 'express';
import { getRecentAdminEvents, subscribeToAdminEvents } from '../../services/adminEvents';

export function createEventsRouter(): express.Router {
  const router = express.Router();

  router.get('/admin/events', (request, response) => {
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
    });

    response.write('event: connected\n');
    response.write('data: {"status":"ok"}\n\n');

    for (const event of getRecentAdminEvents()) {
      response.write(`data: ${JSON.stringify(event)}\n\n`);
    }

    const unsubscribe = subscribeToAdminEvents((event) => {
      response.write(`data: ${JSON.stringify(event)}\n\n`);
    });

    request.on('close', unsubscribe);
  });

  return router;
}
