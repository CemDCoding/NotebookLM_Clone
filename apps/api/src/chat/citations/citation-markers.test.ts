import { describe, expect, it } from 'vitest';
import { extractCitationNumbers, stripCitationMarkers } from './citation-markers';

describe('extractCitationNumbers', () => {
  it('finds single markers in order of appearance', () => {
    expect(extractCitationNumbers('Erstens [2]. Zweitens [1].')).toEqual([2, 1]);
  });

  it('reads adjacent markers as separate citations', () => {
    expect(extractCitationNumbers('Beide stimmen überein [1][2].')).toEqual([1, 2]);
  });

  it('reads comma and semicolon lists inside one marker', () => {
    expect(extractCitationNumbers('Laut [1, 2] und [3;4] sowie [ 5 ,6 ].')).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
  });

  it('returns each number once', () => {
    expect(extractCitationNumbers('A [1]. B [2]. C [1][2]. D [2, 1].')).toEqual([1, 2]);
  });

  it('keeps numbers without a chunk for mapCitations to reject', () => {
    expect(extractCitationNumbers('Erfunden [99].')).toEqual([99]);
  });

  it('ignores brackets that are no citation markers', () => {
    expect(
      extractCitationNumbers('Ein Link [hier](x), ein Array [a, b], leer [] und [1a].'),
    ).toEqual([]);
  });

  it('returns nothing for an answer without citations', () => {
    expect(extractCitationNumbers('Dazu enthalten die Quellen keine Angaben.')).toEqual([]);
  });

  it('gives the same result when called repeatedly', () => {
    const text = 'Aussage [1].';
    expect(extractCitationNumbers(text)).toEqual([1]);
    expect(extractCitationNumbers(text)).toEqual([1]);
  });
});

describe('stripCitationMarkers', () => {
  it('removes markers together with the whitespace before them', () => {
    expect(stripCitationMarkers('Aussage [1]. Weitere Aussage [2][3] und [1, 4].')).toBe(
      'Aussage. Weitere Aussage und.',
    );
  });

  it('leaves text without markers unchanged', () => {
    expect(stripCitationMarkers('Ein Link [hier](x) bleibt.')).toBe('Ein Link [hier](x) bleibt.');
  });
});
