/** Page label for a citation. Text, Markdown and pasted sources have no pages. */
export function formatPage(page: number | null): string | null {
  return page === null ? null : `Seite ${page}`;
}
