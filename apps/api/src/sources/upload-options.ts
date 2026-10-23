import type { MulterModuleOptions } from '@nestjs/platform-express';

/**
 * Multer options for source uploads (apps/api/CLAUDE.md "Body-Limits").
 * Without `storage` or `dest`, multer keeps the file in memory, which is what
 * the type check and the storage upload need. The size is limited while
 * reading: busboy stops at `fileSize` and Nest answers `413`, so an oversized
 * file is never buffered as a whole. Exactly one file and no other fields are
 * accepted, which also caps the memory a request can take through extra parts.
 */
export function uploadOptions(maxFileSizeBytes: number): MulterModuleOptions {
  return {
    limits: { fileSize: maxFileSizeBytes, files: 1, fields: 0 },
    // Browsers send non-ASCII file names (e.g. umlauts) as raw UTF-8 bytes;
    // multer's default would decode them as Latin-1 and garble the title.
    defParamCharset: 'utf8',
  };
}
