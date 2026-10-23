import {
  ChatEventType,
  ChatRequestSchema,
  type ChatDoneEvent,
  type ChatEvent,
  type Citation,
} from '@notebooklm/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, apiFetchResponse } from '@/lib/api-client';
import { readSseStream } from '@/lib/sse';

const INVALID_QUESTION_MESSAGE = 'Bitte gib eine Frage mit höchstens 4.000 Zeichen ein.';
const STREAM_BROKEN_MESSAGE =
  'Die Antwort wurde unerwartet unterbrochen. Bitte stelle die Frage erneut.';

export type ChatStreamStatus = 'idle' | 'streaming' | 'done' | 'aborted' | 'error';

export interface ChatStreamState {
  status: ChatStreamStatus;
  /** The question of the current or last answer, so it can be shown before it is stored. */
  question: string | null;
  /** The answer text collected so far. */
  text: string;
  /** `null` until the `citations` event arrives; the markers stay unresolved until then. */
  citations: Citation[] | null;
  /** Set once the API has stored the answer. */
  messageId: string | null;
  model: string | null;
  /** German text, ready for display. */
  error: string | null;
}

export interface UseChatStreamOptions {
  /** Called once the answer is stored, e.g. to refresh the message history. */
  onDone?: (event: ChatDoneEvent) => void;
}

export interface UseChatStreamResult extends ChatStreamState {
  send: (question: string, model?: string) => void;
  /** Aborts a running answer; the API then cancels the model request and stores nothing. */
  stop: () => void;
}

const INITIAL_STATE: ChatStreamState = {
  status: 'idle',
  question: null,
  text: '',
  citations: null,
  messageId: null,
  model: null,
  error: null,
};

function chatPath(notebookId: string): string {
  return `/notebooks/${encodeURIComponent(notebookId)}/chat`;
}

function applyEvent(state: ChatStreamState, event: ChatEvent): ChatStreamState {
  switch (event.type) {
    case ChatEventType.TOKEN:
      return { ...state, text: state.text + event.text };
    case ChatEventType.CITATIONS:
      return { ...state, citations: event.citations };
    case ChatEventType.DONE:
      return { ...state, status: 'done', messageId: event.messageId, model: event.model };
    case ChatEventType.ERROR:
      return { ...state, status: 'error', error: event.message };
  }
}

function toErrorMessage(error: unknown): string {
  // ApiError carries the API's German message, e.g. for 409 (no ready source) or 429 (limit).
  return error instanceof ApiError ? error.message : STREAM_BROKEN_MESSAGE;
}

/** Streams the answer to a question about the active sources of a notebook. */
export function useChatStream(
  notebookId: string,
  options: UseChatStreamOptions = {},
): UseChatStreamResult {
  const [state, setState] = useState<ChatStreamState>(INITIAL_STATE);
  const controllerRef = useRef<AbortController | null>(null);
  // Kept in a ref so a new callback on every render does not change `send`.
  const onDoneRef = useRef(options.onDone);
  useEffect(() => {
    onDoneRef.current = options.onDone;
  });

  // Leaving the page aborts the stream, so the model request is cancelled as well.
  useEffect(() => () => controllerRef.current?.abort(), []);

  const stop = useCallback(() => {
    const controller = controllerRef.current;
    if (!controller) {
      return;
    }
    controllerRef.current = null;
    controller.abort();
    setState((current) => ({ ...current, status: 'aborted' }));
  }, []);

  const send = useCallback(
    (question: string, model?: string) => {
      const request = ChatRequestSchema.safeParse({ question, model });
      if (!request.success) {
        setState({ ...INITIAL_STATE, status: 'error', question, error: INVALID_QUESTION_MESSAGE });
        return;
      }

      // Only one answer streams at a time; a new question replaces the running one.
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      setState({ ...INITIAL_STATE, status: 'streaming', question: request.data.question });

      void (async () => {
        let finished = false;
        try {
          const response = await apiFetchResponse(chatPath(notebookId), {
            method: 'POST',
            body: request.data,
            signal: controller.signal,
          });
          await readSseStream(response, (event) => {
            // Events still buffered after an abort belong to an answer nobody reads anymore.
            if (controller.signal.aborted || finished) {
              return;
            }
            setState((current) => applyEvent(current, event));
            if (event.type === ChatEventType.DONE) {
              finished = true;
              onDoneRef.current?.(event);
            } else if (event.type === ChatEventType.ERROR) {
              finished = true;
            }
          });
          if (!finished && !controller.signal.aborted) {
            // The connection closed without `done`: the answer was not stored.
            setState((current) => ({ ...current, status: 'error', error: STREAM_BROKEN_MESSAGE }));
          }
        } catch (error) {
          // `stop`, a newer question or the unmount already decided what to show.
          if (controller.signal.aborted) {
            return;
          }
          setState((current) => ({ ...current, status: 'error', error: toErrorMessage(error) }));
        } finally {
          if (controllerRef.current === controller) {
            controllerRef.current = null;
          }
        }
      })();
    },
    [notebookId],
  );

  return { ...state, send, stop };
}
