/**
 * A permanent failure of a source's content, such as a PDF without a text
 * layer. Retrying cannot help, so the worker marks the source as `failed`
 * right away instead of letting pg-boss try again.
 *
 * `message` is stored as the source's `error` and shown in the UI: it must be
 * German, displayable text and must never quote the document's content.
 */
export class IngestionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
