/**
 * What the register counted over the submissions of a period, in the four
 * groups the summary is read in.
 *
 * Everything here is a tally the database produced, not rows the application
 * folded: the list of submissions grows with every one the office takes in, and
 * a summary that read them to add them up would get slower every week and would
 * die quietly rather than loudly.
 *
 * The period itself is not carried here. It is what the caller asked for, and
 * the answer echoes it at the edge — the same way one page of the list echoes
 * the `limit` and `offset` it was asked for rather than the register restating
 * them.
 */
export type PackagesOverviewView = {
  // How far along the conveyor the submissions of the period are.
  readonly pipeline: TallyView;
  // What the runs made of them. Its total counts the submissions that have a
  // report, which is fewer than the pipeline's: one still being read has no
  // outcome yet.
  readonly outcomes: TallyView;
  readonly findings: FindingsOverviewView;
  // How the register answered, counted per question put to it rather than per
  // submission: a profile may ask it more than one.
  readonly archive: TallyView;
};

/**
 * One count per member of a vocabulary, with the whole beside it.
 *
 * Every member the domain names is a key, present at zero where nothing landed
 * on it: a caller rendering a fixed set of tiles must not have one of them
 * disappear because a quiet week held no failures.
 */
export type TallyView = {
  readonly total: number;
  readonly byMember: Readonly<Record<string, number>>;
};

/**
 * The findings of the period in the two groups the report keeps them in, and
 * never in one number: a shortfall held against the package, and something
 * noted for the record. That is the same rule the report's own status is
 * decided by, and the same one a row's `issuesCount` is tallied under.
 */
export type FindingsOverviewView = {
  readonly againstPackage: FindingTallyView;
  readonly observations: FindingTallyView;
};

/**
 * Findings of one group by kind, most frequent first — the order is the answer,
 * so this is a list and not a record. What happens often is a problem in the
 * process; what happens once is a problem in one envelope.
 */
export type FindingTallyView = {
  readonly total: number;
  readonly byKind: readonly FindingCountView[];
};

export type FindingCountView = {
  readonly kind: string;
  readonly count: number;
};
