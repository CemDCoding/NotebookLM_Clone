import { describe, expect, it } from 'vitest';
import { answerTimestamp } from './answer-timestamp';

const question = new Date('2026-10-23T10:00:00.000Z');

describe('answerTimestamp', () => {
  it('is the completion time when that is later than the question', () => {
    const now = new Date('2026-10-23T10:00:05.000Z');
    expect(answerTimestamp(question, now)).toEqual(now);
  });

  it('is one millisecond after the question when completed in the same millisecond', () => {
    expect(answerTimestamp(question, question).getTime()).toBe(question.getTime() + 1);
  });

  it('stays after the question even if the clock went backwards', () => {
    const earlier = new Date('2026-10-23T09:59:59.000Z');
    expect(answerTimestamp(question, earlier).getTime()).toBe(question.getTime() + 1);
  });
});
