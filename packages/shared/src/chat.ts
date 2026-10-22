import { z } from 'zod';

export const CHAT_QUESTION_MAX_LENGTH = 4_000;

// Bounds the model id only against oversized input; whether the model is
// allowed is decided by the API's model registry (CLAUDE.md section 6).
export const MODEL_ID_MAX_LENGTH = 200;

export const CITATION_EXCERPT_MAX_LENGTH = 300;

// Trim before the length checks so a whitespace-only question counts as empty.
export const ChatRequestSchema = z.object({
  question: z.string().trim().min(1).max(CHAT_QUESTION_MAX_LENGTH),
  model: z.string().min(1).max(MODEL_ID_MAX_LENGTH).optional(),
});

// What `messages.citations` stores: references only, never source text, so
// deleting a source leaves nothing of it behind (PE-08). `page` is null for
// text, Markdown and pasted sources.
export const StoredCitationSchema = z.object({
  n: z.number().int().positive(),
  sourceId: z.uuid(),
  chunkId: z.uuid(),
  page: z.number().int().positive().nullable(),
});

// A stored citation resolved live when sending and when loading the history.
// The full section is included so the side panel needs no endpoint (PE-09).
// A deleted source or chunk resolves to `available: false` ("Quelle gelöscht").
export const CitationSchema = z.discriminatedUnion('available', [
  StoredCitationSchema.extend({
    available: z.literal(true),
    sourceTitle: z.string(),
    excerpt: z.string().max(CITATION_EXCERPT_MAX_LENGTH),
    content: z.string(),
  }),
  StoredCitationSchema.extend({
    available: z.literal(false),
  }),
]);

// SSE event names. Each frame carries the name in its `event:` line and the
// complete event object, including `type`, as JSON in its `data:` line.
export const ChatEventType = {
  TOKEN: 'token',
  CITATIONS: 'citations',
  DONE: 'done',
  ERROR: 'error',
} as const;

export type ChatEventType = (typeof ChatEventType)[keyof typeof ChatEventType];

// Errors after the stream has started. Errors before it (404, 409, 429) are
// regular HTTP responses following `ErrorResponseSchema`.
export const ChatStreamErrorCode = {
  // The model provider failed or is overloaded; another model may work.
  MODEL_UNAVAILABLE: 'MODEL_UNAVAILABLE',
  STREAM_FAILED: 'STREAM_FAILED',
} as const;

export type ChatStreamErrorCode = (typeof ChatStreamErrorCode)[keyof typeof ChatStreamErrorCode];

export const ChatTokenEventSchema = z.object({
  type: z.literal(ChatEventType.TOKEN),
  text: z.string(),
});

export const ChatCitationsEventSchema = z.object({
  type: z.literal(ChatEventType.CITATIONS),
  citations: z.array(CitationSchema),
});

export const ChatDoneEventSchema = z.object({
  type: z.literal(ChatEventType.DONE),
  messageId: z.uuid(),
  model: z.string().min(1),
});

export const ChatErrorEventSchema = z.object({
  type: z.literal(ChatEventType.ERROR),
  code: z.enum(ChatStreamErrorCode),
  message: z.string().min(1),
});

export const ChatEventSchema = z.discriminatedUnion('type', [
  ChatTokenEventSchema,
  ChatCitationsEventSchema,
  ChatDoneEventSchema,
  ChatErrorEventSchema,
]);

export const MessageRoleSchema = z.enum(['user', 'assistant']);

// `model` is null for questions; only answers record the model that wrote them.
export const MessageSchema = z.object({
  id: z.uuid(),
  role: MessageRoleSchema,
  content: z.string(),
  model: z.string().nullable(),
  citations: z.array(CitationSchema),
  createdAt: z.iso.datetime(),
});

export const MessageListResponseSchema = z.object({
  messages: z.array(MessageSchema),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type StoredCitation = z.infer<typeof StoredCitationSchema>;
export type Citation = z.infer<typeof CitationSchema>;
export type ChatTokenEvent = z.infer<typeof ChatTokenEventSchema>;
export type ChatCitationsEvent = z.infer<typeof ChatCitationsEventSchema>;
export type ChatDoneEvent = z.infer<typeof ChatDoneEventSchema>;
export type ChatErrorEvent = z.infer<typeof ChatErrorEventSchema>;
export type ChatEvent = z.infer<typeof ChatEventSchema>;
export type MessageRole = z.infer<typeof MessageRoleSchema>;
export type Message = z.infer<typeof MessageSchema>;
export type MessageListResponse = z.infer<typeof MessageListResponseSchema>;
