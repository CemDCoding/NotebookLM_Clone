import { type ChatEvent, ChatEventSchema } from '@notebooklm/shared';
import type { Response } from 'express';

/**
 * Starts the SSE response (PE-20). `X-Accel-Buffering: no` keeps proxies from
 * holding tokens back, and flushing the headers right away lets the client
 * see that the request was accepted before the first token arrives.
 */
export function openEventStream(res: Response): void {
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
}

/**
 * Encodes an event as one SSE frame: its type as `event:`, the whole event
 * including `type` as JSON in `data:`, closed by a blank line. The web app
 * rejects a frame whose name differs from its type (`apps/web/src/lib/sse.ts`).
 * Every event is checked against the shared contract first, so the API never
 * sends one the client would refuse. JSON contains no raw line breaks, so the
 * data always fits on one line.
 */
export function toSseFrame(event: ChatEvent): string {
  const checked = ChatEventSchema.parse(event);
  return `event: ${checked.type}\ndata: ${JSON.stringify(checked)}\n\n`;
}
