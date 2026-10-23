'use client';

import { MessagesSquare, RotateCw, TriangleAlert } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toErrorMessage } from '@/features/notebooks/to-error-message';
import { AnswerBubble } from './answer-bubble';
import type { useMessages } from './queries';
import { QuestionBubble } from './question-bubble';
import { TypingIndicator } from './typing-indicator';
import type { ChatStreamState } from './use-chat-stream';

// Within this distance of the end the list keeps following new text; further up the user reads
// older messages and is not pulled down.
const STICK_TO_BOTTOM_PX = 80;

interface MessageListProps {
  history: ReturnType<typeof useMessages>;
  stream: ChatStreamState;
  showStream: boolean;
  /** Changes with every question sent, so the list scrolls to the new question. */
  runId: number;
}

/** Stored history of the notebook, followed by the question and answer currently streaming. */
export function MessageList({ history, stream, showStream, runId }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);

  function handleScroll() {
    const element = scrollRef.current;
    if (element) {
      const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
      stickToBottomRef.current = distance < STICK_TO_BOTTOM_PX;
    }
  }

  useEffect(() => {
    stickToBottomRef.current = true;
  }, [runId]);

  const messageCount = history.data?.length ?? 0;
  useEffect(() => {
    const element = scrollRef.current;
    if (element && stickToBottomRef.current) {
      element.scrollTop = element.scrollHeight;
    }
  }, [runId, messageCount, stream.text, stream.status, showStream]);

  const isEmpty = history.isSuccess && messageCount === 0 && !showStream;

  return (
    <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-6 py-6">
      {history.isPending && (
        <div role="status" aria-label="Verlauf wird geladen" className="flex flex-col gap-6">
          <Skeleton aria-hidden="true" className="ml-auto h-10 w-1/2 rounded-2xl" />
          <div aria-hidden="true" className="flex flex-col gap-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      )}

      {/* Unlike the empty state not full height: a question asked meanwhile still shows below. */}
      {history.isError && (
        <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
          <span className="flex size-12 items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 text-destructive">
            <TriangleAlert aria-hidden="true" className="size-6" />
          </span>
          <p role="alert" className="max-w-md text-sm text-muted-foreground">
            Der Chatverlauf konnte nicht geladen werden. {toErrorMessage(history.error)}
          </p>
          <Button
            variant="outline"
            onClick={() => void history.refetch()}
            disabled={history.isFetching}
          >
            <RotateCw aria-hidden="true" data-icon="inline-start" />
            Erneut versuchen
          </Button>
        </div>
      )}

      {isEmpty && (
        <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
          <span className="flex size-12 items-center justify-center rounded-xl border bg-primary-soft text-primary-soft-foreground">
            <MessagesSquare aria-hidden="true" className="size-6" />
          </span>
          <p className="font-heading text-lg font-medium">Frag deine Quellen</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Die Antworten stützen sich nur auf deine aktiven Quellen und zeigen mit Zitaten, woher
            jede Aussage stammt.
          </p>
        </div>
      )}

      {(messageCount > 0 || showStream) && (
        <ol aria-label="Chatverlauf" className="flex flex-col gap-6">
          {history.data?.map((message) =>
            message.role === 'user' ? (
              <QuestionBubble key={message.id} content={message.content} />
            ) : (
              <AnswerBubble
                key={message.id}
                content={message.content}
                citations={message.citations}
              />
            ),
          )}
          {showStream && stream.question !== null && (
            <QuestionBubble key="stream-question" content={stream.question} />
          )}
          {/* Only the streaming answer is a live region. The refetched history replaces it with
              the same text outside the region, so screen readers do not read the answer twice. */}
          {showStream && (
            <AnswerBubble
              key="stream-answer"
              live
              busy={stream.status === 'streaming'}
              content={stream.text}
              citations={stream.citations}
              aborted={stream.status === 'aborted'}
              error={stream.error}
            >
              {stream.status === 'streaming' && stream.text === '' && <TypingIndicator />}
            </AnswerBubble>
          )}
        </ol>
      )}
    </div>
  );
}
