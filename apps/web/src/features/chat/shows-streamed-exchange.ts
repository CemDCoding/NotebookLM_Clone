import type { Message } from '@notebooklm/shared';
import type { ChatStreamState } from './use-chat-stream';

/**
 * Whether the question and answer of the stream are shown after the history.
 *
 * A finished answer stays visible until the refetched history contains it, so it neither
 * disappears for the duration of the refetch nor shows up twice. Aborted and failed answers are
 * never stored and stay visible until the next question. `dismissed` hides the exchange after
 * the history was cleared, since a cleared history will never contain it.
 */
export function showsStreamedExchange(
  stream: Pick<ChatStreamState, 'status' | 'messageId'>,
  history: readonly Message[] | undefined,
  dismissed: boolean,
): boolean {
  if (stream.status === 'idle' || dismissed) {
    return false;
  }
  if (stream.status === 'done') {
    return !history?.some((message) => message.id === stream.messageId);
  }
  return true;
}
