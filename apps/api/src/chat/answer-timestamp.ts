/**
 * The `created_at` of an answer: the moment it was completed, but always at
 * least one millisecond after its question. Both rows are written in one
 * statement, so the column default would give them the same value and leave
 * their order in the history to chance.
 */
export function answerTimestamp(questionAt: Date, now: Date = new Date()): Date {
  return new Date(Math.max(now.getTime(), questionAt.getTime() + 1));
}
