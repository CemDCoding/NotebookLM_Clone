import type { MessageRole } from '@notebooklm/shared';
import { stripCitationMarkers } from '../citations';
import { NO_SOURCES_NOTE, SYSTEM_REMINDER, SYSTEM_RULES } from './system-prompt';

/** How many earlier messages of the notebook's chat the prompt includes (apps/api/CLAUDE.md "chat"). */
export const HISTORY_MESSAGE_LIMIT = 6;

/**
 * A retrieved section as the prompt needs it. Defined here rather than taken
 * from retrieval, so prompt and citations stay independent of its row format.
 */
export interface PromptChunk {
  sourceId: string;
  chunkId: string;
  title: string;
  /** Null for text, Markdown and pasted sources. */
  page: number | null;
  content: string;
}

/** An earlier message of the chat, as stored in `messages`. */
export interface HistoryMessage {
  role: MessageRole;
  content: string;
}

/** A message in the format of OpenAI-compatible chat completions. */
export interface PromptMessage {
  role: 'system' | MessageRole;
  content: string;
}

export interface BuildPromptInput {
  /** In retrieval order; the chunk at index i is cited as `[i + 1]`. */
  chunks: readonly PromptChunk[];
  /** Earlier messages, oldest first, without the current question. */
  history: readonly HistoryMessage[];
  question: string;
}

// An opening or closing `source` or `sources` tag, in any case and with any
// whitespace, e.g. `</source>`, `< /SOURCE >` or `<sources>`.
const SOURCE_TAG = /<(?=\s*\/?\s*sources?\b)/gi;

/**
 * Builds the messages for a chat completion (apps/api/CLAUDE.md "chat"):
 * a system message with the rules, the numbered source blocks and a short
 * reminder of the rules, then the last HISTORY_MESSAGE_LIMIT messages of the
 * chat, then the question.
 *
 * Sources are the only untrusted text inside the system message. They are
 * declared as data, and no source can close its block or open a new one, so
 * an injected instruction always stays inside its own block
 * (CLAUDE.md section 7 "Prompt-Injection-Schutz").
 */
export function buildPrompt({ chunks, history, question }: BuildPromptInput): PromptMessage[] {
  const system = [SYSTEM_RULES, renderSources(chunks), SYSTEM_REMINDER].join('\n\n');
  return [
    { role: 'system', content: system },
    ...history.slice(-HISTORY_MESSAGE_LIMIT).map(toPromptMessage),
    { role: 'user', content: question },
  ];
}

function renderSources(chunks: readonly PromptChunk[]): string {
  if (chunks.length === 0) {
    return `<sources>\n${NO_SOURCES_NOTE}\n</sources>`;
  }
  const blocks = chunks.map((chunk, index) => renderSource(chunk, index + 1));
  return `<sources>\n${blocks.join('\n')}\n</sources>`;
}

function renderSource(chunk: PromptChunk, n: number): string {
  const page = chunk.page === null ? '' : ` page="${chunk.page}"`;
  const title = escapeAttribute(chunk.title);
  return `<source n="${n}" title="${title}"${page}>\n${neutralizeSourceTags(chunk.content)}\n</source>`;
}

function toPromptMessage({ role, content }: HistoryMessage): PromptMessage {
  return { role, content: role === 'assistant' ? stripCitationMarkers(content) : content };
}

/**
 * Makes a title safe inside a double-quoted attribute. Line breaks and other
 * control characters become spaces, so the opening tag stays on one line.
 */
function escapeAttribute(value: string): string {
  return value
    .replace(/[\p{Cc}\s]+/gu, ' ')
    .trim()
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

/**
 * Escapes the `<` of every `source` tag in a chunk, so `</source>` in a
 * document reads as text instead of ending the block. All other text stays
 * as it is, so quotes the model takes from it remain exact.
 */
function neutralizeSourceTags(content: string): string {
  return content.replace(SOURCE_TAG, '&lt;');
}
