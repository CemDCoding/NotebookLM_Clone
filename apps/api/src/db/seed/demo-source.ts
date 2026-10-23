import { readFileSync } from 'node:fs';
import { join } from 'node:path';
// Imported from the file, not the barrel, which would also load the PDF parser.
import { contentTypeFor } from '../../sources/file-validation/detect-file-type';
import type { DemoSampleSource } from './demo-seed';

export const DEMO_SOURCE_TITLE = 'Einführung in Quellenchat';

// Next to this file in src/; the seed always runs from source under tsx.
const DEMO_SOURCE_PATH = join(__dirname, 'demo-source.md');

/** The self-written sample text of the demo notebook (PE-17). */
export function loadDemoSource(): DemoSampleSource {
  return {
    type: 'markdown',
    title: DEMO_SOURCE_TITLE,
    contentType: contentTypeFor('markdown'),
    content: readFileSync(DEMO_SOURCE_PATH),
  };
}
