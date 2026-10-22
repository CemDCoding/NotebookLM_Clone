/**
 * Retrieval parameter (PE-13). A named constant instead of an environment
 * variable: changing it is a one-line edit and needs no new deployment setting.
 */
export const RETRIEVAL_TOP_K = 8;

/**
 * The text embedded for the vector search: the current question plus the
 * previous user question (apps/api/CLAUDE.md "retrieval"). Follow-ups such as
 * "Und der zweite Punkt?" carry no topic of their own; the previous question
 * supplies it. The current question comes last, so it stays the focus of the
 * combined text. An empty or repeated previous question adds nothing.
 */
export function buildSearchQuery(question: string, previousUserQuestion?: string): string {
  const current = question.trim();
  const previous = previousUserQuestion?.trim();
  if (!previous || previous === current) {
    return current;
  }
  return `${previous}\n${current}`;
}
