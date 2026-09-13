import type { LandPurpose, LandRight } from '../value-objects/provision.vo.js';

/*
 * The two figures of a case that are words and not numbers: what right the
 * applicant holds over the land, and what the land is designated for — read off
 * the way a plan-scheme or a register extract words them (ADR-0025).
 *
 * Both languages, both scripts and the Latin transliteration of either, because
 * a Soviet-era title is written in Russian and a current plan in Azerbaijani,
 * and both reach the same field.
 *
 * Null where the wording names neither side, and null where it names both: a
 * line reading "mülkiyyət; icarə" states two rights, and picking one would
 * decide the provision on a coin toss.
 */

// Lower case without a locale, and the dot of a lowered "İ" dropped: the
// Azerbaijani locale would lower an English "I" to a dotless "ı" and stop
// "RESIDENTIAL" from reading as the word it is.
function folded(raw: string): string {
  return raw.normalize('NFC').toLowerCase().replaceAll('̇', '');
}

const OWNERSHIP = ['mülkiyyət', 'mulkiyyet', 'собственност', 'ownership'];

const LEASE_OR_USE = [
  'icarə',
  'icare',
  'istifadə',
  'istifade',
  'аренд',
  'пользован',
  'lease',
  'use',
];

/**
 * The right over the land, out of "Mülkiyyət hüququ", "право аренды" or "Right
 * of use". Only the two classes the acceptance contract tells apart; a lease
 * and a right of use are one answer.
 */
export function landRightIn(raw: string): LandRight | null {
  const text = folded(raw);
  const owns = OWNERSHIP.some(word => text.includes(word));
  const leases = LEASE_OR_USE.some(word =>
    word === 'use' ? /\buse\b/u.test(text) : text.includes(word),
  );

  if (owns === leases) return null;

  return owns ? 'Ownership' : 'LeaseOrUse';
}

// The words a designation for a dwelling is written in. "Həyətyanı" and
// "приусадебный" are the homestead plot beside a house, which is land for one.
const RESIDENTIAL = [
  'yaşayış',
  'yasayis',
  'həyətyanı',
  'heyetyani',
  'жил',
  'приусадеб',
  'residential',
  'dwelling',
  'housing',
];

/**
 * What the land is designated for, out of "Fərdi yaşayış tikintisi üçün
 * torpaq" or "Земли сельскохозяйственного назначения".
 *
 * Anything that is stated and is not a designation for a dwelling is `Other`:
 * the only question any provision asks of it is whether the plot is meant for a
 * house. A value carrying no letters at all states no designation and is null.
 */
export function landPurposeIn(raw: string): LandPurpose | null {
  const text = folded(raw);

  if (!/\p{L}/u.test(text)) return null;

  return RESIDENTIAL.some(word => text.includes(word))
    ? 'Residential'
    : 'Other';
}
