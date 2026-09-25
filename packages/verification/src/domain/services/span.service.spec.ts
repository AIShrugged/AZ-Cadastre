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
    expect(
      spanCalculationOf('A—C 7600; 1—2 4000', '30.4 m²')?.longest,
    ).toBeCloseTo(7.6, 9);
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

    // Assumed is a guess, and a guess is not a figure to decide a case on: the
    // reading is kept and the calculation states no span (COMM-160).
    it('is millimetres for a large figure where no area decides it, and states no span', () => {
      const calculation = spanCalculationOf(SAMPLE, null);

      expect(calculation?.unit).toBe('mm');
      expect(calculation?.unitBasis).toBe('Assumed');
      expect(calculation?.longest).toBeNull();
      expect(calculation?.refusedFor).toBe('UnitUnchecked');
    });

    it('is left to the rule where no unit makes the footprint the area', () => {
      expect(spanCalculationOf(SAMPLE, '9 m²')?.unitBasis).toBe('Assumed');
    });

    it('is not decided by a parcel in hectares', () => {
      expect(spanCalculationOf(SAMPLE, '0.025 ha')?.unitBasis).toBe('Assumed');
    });

    /*
     * A design states its footprint as its sides as often as as a figure. The
     * production case this was written for carried "10.8 x 16.1 = 174.48 m²",
     * and the first number on that line is a side: read as the area it made
     * 174 m² into 10.8 (COMM-160).
     */
    it('is decided by the area a line works out, not by the first figure on it', () => {
      const calculation = spanCalculationOf(
        'A—B 400; B—C 865; 1—2 460; 2—3 920',
        '10.8 x 16.1 = 174.6 m²',
      );

      expect(calculation?.unit).toBe('cm');
      expect(calculation?.unitBasis).toBe('BuiltUpArea');
    });

    // A line that only multiplies states no area: taking a side for the
    // footprint would decide the unit of every chain wrongly, and silently.
    it('is not decided by a line that states the sides and no total', () => {
      expect(spanCalculationOf(SAMPLE, '10.8 x 16.1')?.unitBasis).toBe(
        'Assumed',
      );
      expect(spanCalculationOf(SAMPLE, '10,8 × 16,1 м')?.unitBasis).toBe(
        'Assumed',
      );
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
    expect(
      spanCalculationOf('А—Б 3000; Б—В 6300; 1—2 4000; 2—3 4000', '74.4 m²')
        ?.longest,
    ).toBeCloseTo(6.3, 9);
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

  /*
   * The checks the reading is put to before it is a figure (COMM-160). A case
   * was decided on production as `Determined 8.0.10.2` on a 0.545 m span: the
   * reader was shown a plan that marks no axes, numbered the gaps between the
   * rooms itself, and the figures were centimetres read as millimetres. Each of
   * these would have stopped it on its own.
   */
  describe('the checks a reading has to pass', () => {
    // The chain the production case was decided on, off sheet 22 of the
    // Əliyeva Əsmər set: one direction, no lettered axes, centimetres.
    const INVENTED =
      '1—2 360; 2—3 540; 3—4 375; 4—5 440; 5—6 545; 6—7 130; ' +
      '7—8 375; 8—9 440; 9—10 545; 10—11 130';

    it('states no span for the chain the production case was decided on', () => {
      const calculation = spanCalculationOf(
        INVENTED,
        '10.8 x 16.1 = 174.48 m²',
      );

      expect(calculation?.longest).toBeNull();
      expect(calculation?.refusedFor).toBe('OneChain');
    });

    // A building is framed in both directions; axes in one of them is half a
    // reading, and the half that leaves the unit unchecked.
    it('states no span where only one chain was read', () => {
      expect(
        spanCalculationOf('1—2 4000; 2—3 4400', '130.2 m²')?.refusedFor,
      ).toBe('OneChain');
    });

    it('states no span where the spacings do not add up to the overall dimension of their chain', () => {
      const calculation = spanCalculationOf(
        SAMPLE,
        '130.2 m²',
        '1—3 8400; A—E 21000',
      );

      expect(calculation?.longest).toBeNull();
      expect(calculation?.refusedFor).toBe('ChainUnlikeOverall');
    });

    // The overall dimension is printed over the axes on one set and over the
    // outer faces on another — 8800 against 8400 — and both are the same chain.
    it('takes the overall dimension of the sample design, walls or no walls', () => {
      expect(
        spanCalculationOf(SAMPLE, '130.2 m²', '1—3 8800; A—E 14800')?.longest,
      ).toBeCloseTo(5.2, 9);
    });

    // A chain no overall dimension names is not checked: this is a check the
    // design offers or does not.
    it('checks only the chains an overall dimension names', () => {
      expect(
        spanCalculationOf(SAMPLE, '130.2 m²', '1—3 8400')?.longest,
      ).toBeCloseTo(5.2, 9);
      expect(spanCalculationOf(SAMPLE, '130.2 m²', '')?.longest).toBeCloseTo(
        5.2,
        9,
      );
    });

    it('states no span where the chains are not the built-up area the design states', () => {
      const calculation = spanCalculationOf(SAMPLE, '9 m²');

      expect(calculation?.longest).toBeNull();
      expect(calculation?.refusedFor).toBe('FootprintUnlikeArea');
    });

    it('states no span where nothing decides the unit', () => {
      expect(spanCalculationOf(SAMPLE, null)?.refusedFor).toBe('UnitUnchecked');
    });

    it('states no span for a result no span is the length of', () => {
      // 0.9 m and 40 m between axes, both confirmed by an area that agrees
      // with them: the figures hang together and are still not spans.
      expect(spanCalculationOf('A—B 0.9 m; 1—2 0.8 m', null)?.refusedFor).toBe(
        'Implausible',
      );
      expect(spanCalculationOf('A—B 40 m; 1—2 35 m', null)?.refusedFor).toBe(
        'Implausible',
      );
    });

    // The regression minimum: the design the contract works its rule on passes
    // every check and still answers 5.2 m off axes B—C.
    it('lets the sample design through', () => {
      const calculation = spanCalculationOf(
        SAMPLE,
        '130.2 m²',
        '1—3 8400; A—E 14400',
      );

      expect(calculation?.refusedFor).toBeNull();
      expect(calculation?.longest).toBeCloseTo(5.2, 9);
    });
  });
});
