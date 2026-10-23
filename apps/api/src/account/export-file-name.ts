/**
 * The download name of a data export, with the public app name (CLAUDE.md
 * section 1) and the UTC date of `exportedAt`, e.g.
 * `quellenchat-export-2026-10-23.json`.
 */
export function exportFileName(exportedAt: string): string {
  return `quellenchat-export-${exportedAt.slice(0, 10)}.json`;
}
