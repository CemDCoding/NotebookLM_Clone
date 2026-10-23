import type { Citation } from '@notebooklm/shared';
import { describe, expect, it } from 'vitest';
import { processCitations } from './process-citations';

function citation(n: number): Citation {
  return {
    n,
    available: true,
    sourceId: '00000000-0000-4000-8000-000000000001',
    chunkId: `00000000-0000-4000-8000-00000000000${n}`,
    page: n,
    sourceTitle: `Quelle ${n}`,
    excerpt: `Auszug ${n}`,
    content: `Abschnitt ${n}`,
  };
}

describe('processCitations', () => {
  describe('while streaming (no citations yet)', () => {
    it('keeps every marker as a pending segment', () => {
      expect(processCitations('Die Erde ist rund [1]. Sie dreht sich [7].', null)).toEqual([
        { kind: 'text', text: 'Die Erde ist rund ' },
        { kind: 'pending', text: '[1]' },
        { kind: 'text', text: '. Sie dreht sich ' },
        { kind: 'pending', text: '[7]' },
        { kind: 'text', text: '.' },
      ]);
    });

    it('keeps grouped markers as one pending segment', () => {
      expect(processCitations('Beides [1, 2]', null)).toEqual([
        { kind: 'text', text: 'Beides ' },
        { kind: 'pending', text: '[1, 2]' },
      ]);
    });

    it('keeps semicolon lists and spaced markers as pending segments', () => {
      expect(processCitations('A [3;4] B [ 5 ,6 ]', null)).toEqual([
        { kind: 'text', text: 'A ' },
        { kind: 'pending', text: '[3;4]' },
        { kind: 'text', text: ' B ' },
        { kind: 'pending', text: '[ 5 ,6 ]' },
      ]);
    });

    it('leaves an unfinished marker at the end of the stream as text', () => {
      expect(processCitations('Gleich kommt [1', null)).toEqual([
        { kind: 'text', text: 'Gleich kommt [1' },
      ]);
    });
  });

  describe('with citations', () => {
    it('turns valid numbers into citation segments', () => {
      const first = citation(1);
      expect(processCitations('Die Erde ist rund [1].', [first])).toEqual([
        { kind: 'text', text: 'Die Erde ist rund ' },
        { kind: 'citation', citation: first },
        { kind: 'text', text: '.' },
      ]);
    });

    it('removes invalid numbers together with the space in front of them', () => {
      expect(processCitations('Die Erde ist rund [99]. Ende [42] hier.', [citation(1)])).toEqual([
        { kind: 'text', text: 'Die Erde ist rund. Ende hier.' },
      ]);
    });

    it('removes every marker when the answer has no valid citation', () => {
      expect(processCitations('Erfunden [1] und [2].', [])).toEqual([
        { kind: 'text', text: 'Erfunden und.' },
      ]);
    });

    it('keeps the valid part of a group and drops duplicates', () => {
      const first = citation(1);
      const second = citation(2);
      expect(processCitations('Beides [2, 99, 1, 2].', [first, second])).toEqual([
        { kind: 'text', text: 'Beides ' },
        { kind: 'citation', citation: second },
        { kind: 'citation', citation: first },
        { kind: 'text', text: '.' },
      ]);
    });

    it('splits lists separated by semicolons', () => {
      const third = citation(3);
      const fourth = citation(4);
      expect(processCitations('Beides [3;4].', [third, fourth])).toEqual([
        { kind: 'text', text: 'Beides ' },
        { kind: 'citation', citation: third },
        { kind: 'citation', citation: fourth },
        { kind: 'text', text: '.' },
      ]);
    });

    it('accepts spaces inside the brackets and around separators', () => {
      const fifth = citation(5);
      const sixth = citation(6);
      expect(processCitations('Beides [ 5 ,6 ].', [fifth, sixth])).toEqual([
        { kind: 'text', text: 'Beides ' },
        { kind: 'citation', citation: fifth },
        { kind: 'citation', citation: sixth },
        { kind: 'text', text: '.' },
      ]);
    });

    it('handles adjacent markers', () => {
      const first = citation(1);
      const second = citation(2);
      expect(processCitations('Satz [1][3][2]', [first, second])).toEqual([
        { kind: 'text', text: 'Satz ' },
        { kind: 'citation', citation: first },
        { kind: 'citation', citation: second },
      ]);
    });

    it('never removes a line break in front of an invalid marker', () => {
      expect(processCitations('Zeile\n[5] weiter', [])).toEqual([
        { kind: 'text', text: 'Zeile\n weiter' },
      ]);
    });

    it('resolves citations of deleted sources as well', () => {
      const deleted: Citation = {
        n: 3,
        available: false,
        sourceId: '00000000-0000-4000-8000-000000000003',
        chunkId: '00000000-0000-4000-8000-000000000033',
        page: null,
      };
      expect(processCitations('Alt [3]', [deleted])).toEqual([
        { kind: 'text', text: 'Alt ' },
        { kind: 'citation', citation: deleted },
      ]);
    });

    it('leaves text without markers unchanged', () => {
      expect(processCitations('Keine Zitate hier.', [citation(1)])).toEqual([
        { kind: 'text', text: 'Keine Zitate hier.' },
      ]);
    });
  });
});
