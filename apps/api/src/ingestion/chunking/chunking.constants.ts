/**
 * Chunking parameters (PE-13). Named constants instead of environment
 * variables: changing them requires re-ingesting all sources anyway, so they
 * belong to the code, not to a deployment.
 *
 * Lengths are counted in characters, not tokens, so no model-specific
 * tokenizer is needed (apps/api/CLAUDE.md "sources und ingestion").
 */

/** Upper bound for the length of a chunk, overlap included. */
export const CHUNK_SIZE = 3000;

/** Target length of the text a chunk repeats from the end of its predecessor. */
export const CHUNK_OVERLAP = 400;
