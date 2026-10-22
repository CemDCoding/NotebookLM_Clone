import { describe, expect, it } from 'vitest';
import {
  CHAT_QUESTION_MAX_LENGTH,
  CITATION_EXCERPT_MAX_LENGTH,
  ChatCitationsEventSchema,
  ChatDoneEventSchema,
  ChatErrorEventSchema,
  ChatEventSchema,
  ChatEventType,
  ChatRequestSchema,
  ChatStreamErrorCode,
  ChatTokenEventSchema,
  CitationSchema,
  MessageListResponseSchema,
  MessageRoleSchema,
  MessageSchema,
  StoredCitationSchema,
} from './index';

const stored = {
  n: 1,
  sourceId: '7b1e2c3d-4f5a-4b6c-8d7e-9f0a1b2c3d4e',
  chunkId: 'c2a4e6f8-1b3d-4f5a-8c7e-9d0b1a2c3e4f',
  page: 3,
};

const available = {
  ...stored,
  available: true,
  sourceTitle: 'Handbuch.pdf',
  excerpt: 'Der Antrag ist bis zum 31. März zu stellen.',
  content: 'Der Antrag ist bis zum 31. März zu stellen. Danach verfällt der Anspruch.',
};

const deleted = { ...stored, available: false };

const message = {
  id: '3f6c1f0e-8b2a-4c1d-9e57-2a4b6d8f0a11',
  role: 'assistant',
  content: 'Die Frist endet am 31. März [1].',
  model: 'mistral-small-latest',
  citations: [available],
  createdAt: '2026-10-22T10:00:00.000Z',
};

describe('ChatRequestSchema', () => {
  it('accepts a question with and without a model', () => {
    expect(ChatRequestSchema.parse({ question: 'Wann endet die Frist?' })).toEqual({
      question: 'Wann endet die Frist?',
    });
    expect(
      ChatRequestSchema.safeParse({ question: 'Wann?', model: 'ollama:llama3.2' }).success,
    ).toBe(true);
  });

  it('trims the question and enforces 1 to 4,000 characters', () => {
    expect(CHAT_QUESTION_MAX_LENGTH).toBe(4_000);
    const parse = (question: string) => ChatRequestSchema.safeParse({ question });
    expect(ChatRequestSchema.parse({ question: '  Wann?  ' }).question).toBe('Wann?');
    expect(parse('').success).toBe(false);
    expect(parse(' \n\t ').success).toBe(false);
    expect(parse('a'.repeat(4_000)).success).toBe(true);
    expect(parse('a'.repeat(4_001)).success).toBe(false);
  });

  it('leaves the model whitelist to the API but rejects empty or oversized ids', () => {
    expect(ChatRequestSchema.safeParse({ question: 'x', model: 'unknown-model' }).success).toBe(
      true,
    );
    expect(ChatRequestSchema.safeParse({ question: 'x', model: '' }).success).toBe(false);
    expect(ChatRequestSchema.safeParse({ question: 'x', model: 'a'.repeat(201) }).success).toBe(
      false,
    );
    expect(ChatRequestSchema.safeParse({ question: 'x', model: 42 }).success).toBe(false);
  });

  it('rejects a missing question', () => {
    expect(ChatRequestSchema.safeParse({ model: 'mistral-small-latest' }).success).toBe(false);
  });
});

describe('StoredCitationSchema', () => {
  it('accepts a reference with and without a page', () => {
    expect(StoredCitationSchema.parse(stored)).toEqual(stored);
    expect(StoredCitationSchema.safeParse({ ...stored, page: null }).success).toBe(true);
  });

  it('drops any resolved text so only references are stored (PE-08)', () => {
    expect(StoredCitationSchema.parse(available)).toEqual(stored);
  });

  it('rejects non-positive numbers and pages and invalid ids', () => {
    expect(StoredCitationSchema.safeParse({ ...stored, n: 0 }).success).toBe(false);
    expect(StoredCitationSchema.safeParse({ ...stored, n: 1.5 }).success).toBe(false);
    expect(StoredCitationSchema.safeParse({ ...stored, page: 0 }).success).toBe(false);
    expect(StoredCitationSchema.safeParse({ ...stored, sourceId: 'abc' }).success).toBe(false);
    expect(StoredCitationSchema.safeParse({ ...stored, chunkId: 'abc' }).success).toBe(false);
  });
});

describe('CitationSchema', () => {
  it('accepts an available and a deleted citation', () => {
    expect(CitationSchema.parse(available)).toEqual(available);
    expect(CitationSchema.parse(deleted)).toEqual(deleted);
  });

  it('caps the excerpt at 300 characters but not the full section', () => {
    expect(CITATION_EXCERPT_MAX_LENGTH).toBe(300);
    const long = 'a'.repeat(3_000);
    expect(CitationSchema.safeParse({ ...available, excerpt: 'a'.repeat(300) }).success).toBe(true);
    expect(CitationSchema.safeParse({ ...available, excerpt: 'a'.repeat(301) }).success).toBe(
      false,
    );
    expect(CitationSchema.safeParse({ ...available, content: long }).success).toBe(true);
  });

  it('requires title, excerpt and content when available', () => {
    expect(CitationSchema.safeParse({ ...stored, available: true }).success).toBe(false);
  });

  it('strips source text from a deleted citation', () => {
    expect(CitationSchema.parse({ ...available, available: false })).toEqual(deleted);
  });

  it('rejects a missing or non-boolean availability', () => {
    expect(CitationSchema.safeParse(stored).success).toBe(false);
    expect(CitationSchema.safeParse({ ...available, available: 'true' }).success).toBe(false);
  });
});

describe('chat SSE events', () => {
  const token = { type: 'token', text: 'Die Frist ' };
  const citations = { type: 'citations', citations: [available, deleted] };
  const done = { type: 'done', messageId: message.id, model: 'mistral-small-latest' };
  const error = {
    type: 'error',
    code: 'STREAM_FAILED',
    message: 'Die Antwort konnte nicht erzeugt werden.',
  };

  it('names the four events', () => {
    expect(ChatEventType).toEqual({
      TOKEN: 'token',
      CITATIONS: 'citations',
      DONE: 'done',
      ERROR: 'error',
    });
  });

  it('parses each event with its own schema', () => {
    expect(ChatTokenEventSchema.parse(token)).toEqual(token);
    expect(ChatCitationsEventSchema.parse(citations)).toEqual(citations);
    expect(ChatDoneEventSchema.parse(done)).toEqual(done);
    expect(ChatErrorEventSchema.parse(error)).toEqual(error);
  });

  it('parses each event through the union and keeps its type', () => {
    for (const event of [token, citations, done, error]) {
      expect(ChatEventSchema.parse(event)).toEqual(event);
    }
  });

  it('rejects an unknown or missing type', () => {
    expect(ChatEventSchema.safeParse({ type: 'ping' }).success).toBe(false);
    expect(ChatEventSchema.safeParse({ type: 'TOKEN', text: 'x' }).success).toBe(false);
    expect(ChatEventSchema.safeParse({ text: 'x' }).success).toBe(false);
  });

  it('rejects a known type with the payload of another', () => {
    expect(ChatEventSchema.safeParse({ ...done, type: 'token' }).success).toBe(false);
    expect(ChatEventSchema.safeParse({ ...token, type: 'done' }).success).toBe(false);
  });

  it('accepts an empty citation list', () => {
    expect(ChatEventSchema.safeParse({ type: 'citations', citations: [] }).success).toBe(true);
  });

  it('rejects an invalid message id and an empty model in done', () => {
    expect(ChatDoneEventSchema.safeParse({ ...done, messageId: 'abc' }).success).toBe(false);
    expect(ChatDoneEventSchema.safeParse({ ...done, model: '' }).success).toBe(false);
  });

  it('accepts every stream error code and rejects others', () => {
    for (const code of Object.values(ChatStreamErrorCode)) {
      expect(ChatErrorEventSchema.safeParse({ ...error, code }).success).toBe(true);
    }
    expect(ChatErrorEventSchema.safeParse({ ...error, code: 'LIMIT_EXCEEDED' }).success).toBe(
      false,
    );
    expect(ChatErrorEventSchema.safeParse({ ...error, message: '' }).success).toBe(false);
  });
});

describe('MessageSchema', () => {
  it('accepts an answer and a question without model and citations', () => {
    expect(MessageSchema.parse(message)).toEqual(message);
    const question = { ...message, role: 'user', model: null, citations: [] };
    expect(MessageSchema.safeParse(question).success).toBe(true);
  });

  it('accepts exactly the roles user and assistant', () => {
    expect(MessageRoleSchema.options).toEqual(['user', 'assistant']);
    expect(MessageSchema.safeParse({ ...message, role: 'system' }).success).toBe(false);
  });

  it('accepts deleted citations in the history', () => {
    expect(MessageSchema.safeParse({ ...message, citations: [deleted] }).success).toBe(true);
  });

  it('rejects stored references without availability, an invalid id and a non-ISO date', () => {
    expect(MessageSchema.safeParse({ ...message, citations: [stored] }).success).toBe(false);
    expect(MessageSchema.safeParse({ ...message, id: 'abc' }).success).toBe(false);
    expect(MessageSchema.safeParse({ ...message, createdAt: 'today' }).success).toBe(false);
  });

  it('requires model to be present, even when null', () => {
    const withoutModel: Partial<typeof message> = { ...message };
    delete withoutModel.model;
    expect(MessageSchema.safeParse(withoutModel).success).toBe(false);
  });
});

describe('MessageListResponseSchema', () => {
  it('accepts an empty and a filled history', () => {
    expect(MessageListResponseSchema.safeParse({ messages: [] }).success).toBe(true);
    expect(MessageListResponseSchema.safeParse({ messages: [message] }).success).toBe(true);
  });

  it('rejects a history containing an invalid message', () => {
    expect(MessageListResponseSchema.safeParse({ messages: [{ id: 'x' }] }).success).toBe(false);
  });
});
