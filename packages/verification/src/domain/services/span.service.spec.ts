import { describe, expect, it } from 'vitest';

import { spanCalculationOf } from './span.service.js';

/*
 * The sample design the acceptance contract works the rule on (PROJE44,
 * Sumqayıt, Novxanı bağ massivi 3873D): axes 1—2—3 at 4000 and 4400, axes
 * A—B—C—D—E at 2400, 5200, 2800 and 4000, a built-up area of 130.2 m², and
 * general notes that say the dimensions are in centimetres although every
 * figure on the plans is millimetres.
 */
const SAMPLE = '1—2 4000; 2—3 4400; A—B 2400; B—C 5200; C—D 2800; D—E 4000';

describe('spanCalculationOf', () => {
  it('takes the longest span of each chain and the longest of the two', () => {
    const calculation = spanCalculationOf(SAMPLE, '130.2 m²');

    expect(calculation?.longest).toBeCloseTo(5.2, 9);
    expect(
      calculation?.chains.map(chain => [
        chain.chain,
        `${chain.longest.from}—${chain.longest.to}`,
        chain.longest.length,
      ]),
    ).toEqual([
      ['Numbered', '2—3', 4.4],
      ['Lettered', 'B—C', 5.2],
    ]);
  });

  it('lists every span of a chain in axis order', () => {
    const lettered = spanCalculationOf(SAMPLE, '130.2 m²')?.chains.find(
      chain => chain.chain === 'Lettered',
    );

    expect(lettered?.spans.map(span => [span.from, span.to])).toEqual([
      ['A', 'B'],
      ['B', 'C'],
      ['C', 'D'],
      ['D', 'E'],
    ]);
  });

  /*
   * The contract's own trap: the studio runs from axis A to axis C, 7600 mm,
   * with axis B between — the span is 5200. And the overall chain is the width
   * of the house, which on any house exceeds six metres.
   */
  it('sets aside a room and an overall dimension that cross an axis', () => {
    const calculation = spanCalculationOf(
      `${SAMPLE}; A—C 7600; 1—3 8400; A—E 14400`,
      '130.2 m²',
    );

    expect(calculation?.longest).toBeCloseTo(5.2, 9);
    expect(calculation?.setAside).toEqual([
      'A—C 7600',
      '1—3 8400',
      'A—E 14400',
    ]);
  });

  it('keeps an entry between two axes where nothing names an axis between them', () => {
    expect(spanCalculationOf('A—C 7600; 1—2 4000', null)?.longest).toBeCloseTo(
      7.6,
      9,
    );
  });

  describe('the unit of a bare figure', () => {
    it('is the one that makes the footprint the built-up area', () => {
      const calculation = spanCalculationOf(SAMPLE, '130.2 m²');

      expect(calculation?.unit).toBe('mm');
      expect(calculation?.unitBasis).toBe('BuiltUpArea');
    });

    // A technical inventory dimensions its plans in centimetres: 1380 × 1265
    // is a footprint of 174.6 m², which the passport states.
    it('is centimetres where the footprint says so, however large the figures', () => {
      const calculation = spanCalculationOf(
        'A—B 400; B—C 865; 1—2 460; 2—3 920',
        '174.6 m²',
      );

      expect(calculation?.unit).toBe('cm');
      expect(calculation?.longest).toBeCloseTo(9.2, 9);
    });

    it('is millimetres for a large figure where no area decides it', () => {
      const calculation = spanCalculationOf(SAMPLE, null);

      expect(calculation?.unit).toBe('mm');
      expect(calculation?.unitBasis).toBe('Assumed');
      expect(calculation?.longest).toBeCloseTo(5.2, 9);
    });

    it('is left to the rule where no unit makes the footprint the area', () => {
      expect(spanCalculationOf(SAMPLE, '9 m²')?.unitBasis).toBe('Assumed');
    });

    it('is not decided by a parcel in hectares', () => {
      expect(spanCalculationOf(SAMPLE, '0.025 ha')?.unitBasis).toBe('Assumed');
    });

    it('is the printed one where every figure carries it', () => {
      const calculation = spanCalculationOf(
        'A—B 6,00 m; B—C 5,40 m; 1—2 4,80 m; 2—3 4,80 m',
        '138 m²',
      );

      expect(calculation?.unitBasis).toBe('Printed');
      expect(calculation?.longest).toBe(6);
    });
  });

  it('reads the axes whichever way round and whatever dash they are joined by', () => {
    expect(
      spanCalculationOf('C-B 5200; 2–1 4000', null)?.chains.map(chain => [
        chain.longest.from,
        chain.longest.to,
      ]),
    ).toEqual([
      ['1', '2'],
      ['B', 'C'],
    ]);
  });

  it('reads Cyrillic axis letters', () => {
    expect(spanCalculationOf('А—Б 3000; Б—В 6300', null)?.longest).toBeCloseTo(
      6.3,
      9,
    );
  });

  // A customer's set that marks no axes came back from the reader as
  // "19400—23000 18600", which was once read as an 18.6 m span (eval/span,
  // 2026-09-24). A figure no two axes bound is not a span.
  it('states no span for a value that names no axes', () => {
    expect(spanCalculationOf('4,2', null)).toBeNull();
    expect(spanCalculationOf('6320; 5150; 3650', '175.2 m²')).toBeNull();
    expect(
      spanCalculationOf('19400—23000 18600; 23000—7800 4600', null),
    ).toBeNull();
  });

  it('reads nothing out of a value that states no length', () => {
    expect(spanCalculationOf('', null)).toBeNull();
    expect(spanCalculationOf('not stated', null)).toBeNull();
    expect(spanCalculationOf('A—B', null)).toBeNull();
  });
});
