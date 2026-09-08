/*
 * ─────────────────────────────────────────────────────────────────────────────
 *  ⚠  PROVISIONAL. NOT CONFIRMED BY THE CUSTOMER. NOT FIT FOR REAL DECISIONS.  ⚠
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Every number and every paper named in this file is a placeholder. We asked
 * the customer for the height thresholds, for the years, and for what each set
 * of supporting documents actually contains. The answer was "do as you see
 * fit"; no norm, no article and no circular was given to work from.
 *
 * Inventing the content of a norm is not a technical mistake to make — a wrong
 * threshold sends an applicant away for papers they do not need, or registers a
 * building on papers it needed and did not have. So the invented part lives
 * here, on its own, and the mechanism that reads it lives in
 * `verification-profile.vo.ts` and the aggregate. Replacing this table is one
 * file and no logic: whoever arrives with the real requirements changes the
 * rows below and nothing else.
 *
 * What has to be learned before this is real:
 *
 *  1. The thresholds. Which height, in metres, separates the cases, and whether
 *     the norm speaks in metres at all rather than in storeys.
 *  2. The years. Which dates the branch turns on, and which date on which paper
 *     is the one that counts — the year the building was completed, the year
 *     the land was allotted, or the year the design was approved. This table
 *     reads the design approval and falls back to the allotment order, which is
 *     a guess about what "year" means here, not a rule.
 *  3. The sets. What each band actually asks the applicant to bring, in the
 *     office's own words, so the report names the paper the applicant will be
 *     asked for at the counter.
 *  4. Whether a band can be decided at all when only the height is known. The
 *     bands below that state no year answer whatever year is read, including
 *     none — which is a choice this table makes and a real norm may not.
 */

// Not exported as a type from here: the shape belongs to the profile, and a
// table that could name its own shape would be a second place to change.
import type { SupportingDocumentsDeclaration } from './verification-profile.vo.js';

export const UNCONFIRMED_SUPPORTING_DOCUMENTS: SupportingDocumentsDeclaration =
  {
    key: 'building_supporting_documents',
    description:
      'Which supporting documents a first state registration of an individual ' +
      'residential house needs, by how tall the building is and what year it ' +
      'is dated by. Provisional: no confirmed requirement stands behind it.',
    // Read off the sketch design, which is the paper that describes the
    // building rather than the plot it stands on.
    height: [['sketch_project', 'building_height']],
    // The design's approval first, the allotment order second: both are dates
    // the package states about the building coming to be, and neither is the
    // completion date, which no paper of this profile carries.
    builtIn: [
      ['sketch_project', 'approval_date'],
      ['disposal_order', 'issue_date'],
    ],
    bands: [
      {
        key: 'low_rise_recent',
        description:
          'A low house dated by a recent year: the papers a current build is ' +
          'expected to have produced on its way up.',
        heightFrom: null,
        heightBelow: 12,
        builtFrom: 2010,
        builtBefore: null,
        documents: [
          'Construction notification acknowledged by the executive authority',
          'Technical passport of the building',
          'Statements of connection to water, gas and electricity',
        ],
      },
      {
        key: 'low_rise_legacy',
        description:
          'A low house dated by a year before the notification regime: the ' +
          'papers that stand in for a permit nobody issued at the time.',
        heightFrom: null,
        heightBelow: 12,
        builtFrom: null,
        builtBefore: 2010,
        documents: [
          'Technical passport of the building',
          'Archival statement that the building stood at this address',
          'Statement of the owner as to when the building was completed',
        ],
      },
      {
        key: 'mid_rise',
        description:
          'A house tall enough to have needed a permit, whatever year it is ' +
          'dated by.',
        heightFrom: 12,
        heightBelow: 25,
        builtFrom: null,
        builtBefore: null,
        documents: [
          'Construction permit',
          'Act of commissioning',
          'Technical passport of the building',
          'Structural expert opinion',
        ],
      },
      {
        key: 'high_rise',
        description:
          'A house tall enough to have needed the design itself examined by ' +
          'the state, whatever year it is dated by.',
        heightFrom: 25,
        heightBelow: null,
        builtFrom: null,
        builtBefore: null,
        documents: [
          'Construction permit',
          'Act of commissioning',
          'State expert opinion on the design',
          'Fire safety conclusion',
          'Technical passport of the building',
        ],
      },
    ],
  };
