'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { useSources } from '@/features/sources/use-sources';
import { chatAvailability, type SourcesState } from './chat-availability';
import { ChatInput } from './chat-input';
import { CitationPanelProvider } from './citations/citation-panel-provider';
import { ClearHistoryDialog } from './clear-history-dialog';
import { MessageList } from './message-list';
import { ModelPicker } from './model-picker';
import { useMessages, useModels } from './queries';
import { chatKeys } from './query-keys';
import { showsStreamedExchange } from './shows-streamed-exchange';
import { useChatStream } from './use-chat-stream';

interface ChatPanelProps {
  notebookId: string;
}

function toSourcesState(sources: ReturnType<typeof useSources>): SourcesState {
  // A failed poll keeps the last list, which still tells whether a question can be asked.
  if (sources.data) {
    return { status: 'success', sources: sources.data };
  }
  return { status: sources.isError ? 'error' : 'pending' };
}

/** Right column of the notebook view: history, question field, model picker and clearing. */
export function ChatPanel({ notebookId }: ChatPanelProps) {
  const headingId = useId();
  const queryClient = useQueryClient();
  const history = useMessages(notebookId);
  const models = useModels();
  // Same query as the source column; TanStack Query fetches it only once.
  const sources = useSources(notebookId);
  const stream = useChatStream(notebookId, {
    onDone: () => void queryClient.invalidateQueries({ queryKey: chatKeys.messages(notebookId) }),
  });

  const [selectedModel, setSelectedModel] = useState<string>();
  // Counts the questions sent, so clearing the history can hide the exchange shown at that time.
  const [runId, setRunId] = useState(0);
  const [clearedRunId, setClearedRunId] = useState<number | null>(null);

  const modelId = selectedModel ?? models.data?.find((model) => model.isDefault)?.id;
  const isStreaming = stream.status === 'streaming';
  const showStream = showsStreamedExchange(stream, history.data, clearedRunId === runId);
  const hasMessages = (history.data?.length ?? 0) > 0 || showStream;

  function handleSend(question: string) {
    setRunId((current) => current + 1);
    // Without a loaded model list the API answers with its default model.
    stream.send(question, modelId);
  }

  return (
    <CitationPanelProvider>
      <section
        aria-labelledby={headingId}
        className="sticky top-6 flex h-[calc(100dvh-13rem)] min-h-[32rem] flex-col rounded-xl border bg-card"
      >
        <div className="flex items-center justify-between gap-3 border-b px-6 py-3">
          <h2 id={headingId} className="font-heading text-lg font-medium">
            Chat
          </h2>
          {/* Clearing during a stream would race the answer being stored right after. */}
          <ClearHistoryDialog
            notebookId={notebookId}
            disabled={!hasMessages || isStreaming}
            onCleared={() => setClearedRunId(runId)}
          />
        </div>

        <MessageList history={history} stream={stream} showStream={showStream} runId={runId} />

        <div className="border-t p-4">
          <ChatInput
            availability={chatAvailability(toSourcesState(sources))}
            isStreaming={isStreaming}
            onSend={handleSend}
            onStop={stream.stop}
          >
            <ModelPicker
              models={models.data}
              isError={models.isError}
              value={modelId}
              onValueChange={setSelectedModel}
              disabled={isStreaming}
            />
          </ChatInput>
        </div>
      </section>
    </CitationPanelProvider>
  );
}
