import { describe, expect, it } from 'vitest';

import { VerificationProfile } from '../../../../domain/value-objects/index.js';

import { SuggestProfileHandler } from './suggest-profile.handler.js';
import { SuggestProfileQuery } from './suggest-profile.query.js';

const handler = new SuggestProfileHandler();

function suggest(legalBasis: string | null, builtYear: number | null = null) {
  return handler.execute(new SuggestProfileQuery(legalBasis, builtYear));
}

describe('SuggestProfileHandler', () => {
  it('proposes the profile that registers a right founded on the declared ground', async () => {
    expect((await suggest('disposal_order')).profileKey).toBe('cadastre');
  });

  /*
   * A perfectly good question, answered rather than refused. "No profile
   * registers a right founded on this" is exactly what an operator asking
   * before they submit needs to hear, and a refusal would tell them the same
   * thing in a shape their screen cannot show.
   */
  it('answers with no profile, and why, for a ground nothing registers', async () => {
    const suggestion = await suggest('purchase_contract');

    expect(suggestion.profileKey).toBeNull();
    expect(suggestion.reasons[0]?.note).toContain('purchase_contract');
  });

  it('answers with no profile where the operator has declared nothing yet', async () => {
    expect((await suggest(null)).profileKey).toBeNull();
  });

  // The screen asks as soon as it has one figure: an answer on the ground alone
  // is worth more than no answer until the year arrives.
  it('answers on the ground alone', async () => {
    expect((await suggest('disposal_order', null)).profileKey).toBe('cadastre');
  });

  it('states one reason per figure the office declares, in the order it reads them', async () => {
    const suggestion = await suggest('disposal_order', 1998);

    expect(suggestion.reasons.map(reason => reason.criterion)).toEqual([
      'legalBasis',
      'builtYear',
    ]);
  });

  it('proposes only a profile this build actually ships', async () => {
    const suggestion = await suggest('disposal_order');

    expect(VerificationProfile.all.map(profile => profile.key)).toContain(
      suggestion.profileKey,
    );
  });

  it('takes no port: a profile is policy in code, so there is nothing to read', () => {
    expect(SuggestProfileHandler.length).toBe(0);
  });
});
