/**
 * Further steps — what this system does today and what it will grow into.
 *
 * It is content and not data: nothing on any endpoint knows about a roadmap,
 * and inventing a `/api/roadmap` to serve four paragraphs would be a service
 * built to avoid writing them down. What it must not do is drift from the
 * product — so every step that is marked `live` names a surface or a stage that
 * exists in this build, and every one that is not says what it is waiting for.
 *
 * It lives in `entities` because two places read it: the page that lists the
 * steps, and the sidebar, whose badge is the number still to come. A count
 * written twice is a count that disagrees with itself by the next release.
 *
 * The names of the outside systems are the customer's own — DİN İAMAS, the
 * cadastre register — and they are the whole content of a `planned` step: what
 * is missing is an integration nobody here can write, not a screen.
 */

/** Where a step stands. Three and not two: half of the work in a state office
 *  is a thing that runs and does not yet run over everything. */
export type StepStanding = 'live' | 'partial' | 'planned';

export type RoadmapStage = {
  readonly number: number;
  /** Dictionary key — the stage's name in the reader's language. */
  readonly key: string;
};

export type RoadmapStep = {
  readonly id: string;
  readonly stage: number;
  readonly standing: StepStanding;
  /** Dictionary keys: what the step is, and what it rests on. */
  readonly key: string;
  /** Named only where something outside this system has to answer first. */
  readonly integration?: string;
};

export const ROADMAP_STAGES: readonly RoadmapStage[] = [
  { number: 1, key: 'roadmap.stage.archive' },
  { number: 2, key: 'roadmap.stage.intake' },
  { number: 3, key: 'roadmap.stage.consistency' },
  { number: 4, key: 'roadmap.stage.decision' },
];

export const ROADMAP_STEPS: readonly RoadmapStep[] = [
  {
    id: 'archive-search',
    stage: 1,
    standing: 'live',
    key: 'roadmap.step.archive_search',
  },
  {
    id: 'case-intake',
    stage: 1,
    standing: 'live',
    key: 'roadmap.step.case_intake',
  },
  {
    id: 'case-register',
    stage: 1,
    standing: 'live',
    key: 'roadmap.step.case_register',
  },
  {
    id: 'read-packet',
    stage: 2,
    standing: 'live',
    key: 'roadmap.step.read_packet',
  },
  {
    id: 'legal-ground',
    stage: 2,
    standing: 'partial',
    key: 'roadmap.step.legal_ground',
  },
  {
    id: 'identity',
    stage: 2,
    standing: 'planned',
    key: 'roadmap.step.identity',
    integration: 'DİN İAMAS',
  },
  {
    id: 'cadastre-lookup',
    stage: 2,
    standing: 'planned',
    key: 'roadmap.step.cadastre_lookup',
    integration: 'e-emlak.gov.az',
  },
  {
    id: 'cross-checks',
    stage: 3,
    standing: 'live',
    key: 'roadmap.step.cross_checks',
  },
  {
    id: 'archive-approval',
    stage: 3,
    standing: 'live',
    key: 'roadmap.step.archive_approval',
  },
  {
    id: 'field-survey',
    stage: 3,
    standing: 'planned',
    key: 'roadmap.step.field_survey',
  },
  {
    id: 'decision',
    stage: 4,
    standing: 'planned',
    key: 'roadmap.step.decision',
  },
  {
    id: 'certificate',
    stage: 4,
    standing: 'planned',
    key: 'roadmap.step.certificate',
  },
  { id: 'portal', stage: 4, standing: 'planned', key: 'roadmap.step.portal' },
];

export const STANDING_KEY: Record<StepStanding, string> = {
  live: 'roadmap.live',
  partial: 'roadmap.partial',
  planned: 'roadmap.planned',
};

/**
 * How many steps are still to come — the sidebar's badge.
 *
 * Counted rather than written down, so the badge and the list can never
 * disagree: a step that goes live drops out of the count by being edited once.
 */
export function stepsToCome(): number {
  return ROADMAP_STEPS.filter(step => step.standing !== 'live').length;
}
