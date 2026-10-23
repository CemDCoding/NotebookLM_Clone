'use client';

import { CHAT_QUESTION_MAX_LENGTH } from '@notebooklm/shared';
import { ArrowUp, Square } from 'lucide-react';
import { useId, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { ChatAvailability } from './chat-availability';

interface ChatInputProps {
  availability: ChatAvailability;
  isStreaming: boolean;
  onSend: (question: string) => void;
  onStop: () => void;
  /** Controls next to the send button, e.g. the model picker. */
  children?: ReactNode;
}

/** Question field: Enter sends, Shift+Enter breaks the line, Stop replaces Send while streaming. */
export function ChatInput({ availability, isStreaming, onSend, onStop, children }: ChatInputProps) {
  const [question, setQuestion] = useState('');
  const reasonId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canSend = availability.canAsk && !isStreaming && question.trim() !== '';

  function submit() {
    if (!canSend) {
      return;
    }
    onSend(question);
    setQuestion('');
    // The send button turns into the stop button, so focus would otherwise fall to the page.
    textareaRef.current?.focus();
  }

  function stop() {
    onStop();
    textareaRef.current?.focus();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // While an input method composes a word, Enter confirms the word and must not send.
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) {
      return;
    }
    event.preventDefault();
    submit();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 rounded-xl border bg-background p-2 has-[textarea:disabled]:bg-muted/50 has-[textarea:focus-visible]:border-ring has-[textarea:focus-visible]:ring-3 has-[textarea:focus-visible]:ring-ring/50">
        <Textarea
          ref={textareaRef}
          aria-label="Frage"
          aria-describedby={availability.canAsk ? undefined : reasonId}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Stell eine Frage zu deinen Quellen …"
          maxLength={CHAT_QUESTION_MAX_LENGTH}
          disabled={!availability.canAsk}
          rows={2}
          className="max-h-48 min-h-12 resize-none border-0 bg-transparent px-1.5 shadow-none focus-visible:ring-0 disabled:bg-transparent"
        />
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">{children}</div>
          {isStreaming ? (
            <Button type="button" size="icon" onClick={stop} aria-label="Antwort stoppen">
              <Square aria-hidden="true" className="fill-current" />
            </Button>
          ) : (
            <Button type="submit" size="icon" disabled={!canSend} aria-label="Frage senden">
              <ArrowUp aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>
      {!availability.canAsk && (
        <p id={reasonId} className="px-1 text-sm text-muted-foreground">
          {availability.reason}
        </p>
      )}
    </form>
  );
}
