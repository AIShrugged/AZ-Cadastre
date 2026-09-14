import { TitleDocumentRightConflictException } from '../exceptions/index.js';

import { DocumentType } from './document-type.vo.js';
import { FieldKey } from './field.vo.js';

/*
 * The provision of Article 8 a case of first registration falls under, and what
 * each provision asks the package to hold (ADR-0025).
 *
 * The customer's acceptance contract ("reference implementation", v1.2) decides
 * a case on six figures and nothing else: when the house was built, how many
 * storeys it has above ground, how tall it is, its longest span, what right the
 * applicant holds over the land and what the land is designated for. The
 * provision those six select is what decides which papers the package must
 * carry — so the required set is no longer one flat list the profile states up
 * front, but a table the case is read into.
 *
 * Imports nothing at runtime from `verification-profile.vo.ts`, which imports
 * this file: the profile is a static built at import time, and a cycle in which
 * either side needed the other's classes before they existed would take the
 * process down on start-up depending on which module was loaded first.
 */

// The right the applicant holds over the land, as the acceptance contract
// classes it: ownership on one side, and everything short of ownership — a
// lease, a right of use — on the other. The contract never tells lease from use
// apart; a provision that accepts one accepts the other.
export const LAND_RIGHTS = ['Ownership', 'LeaseOrUse'] as const;
export type LandRight = (typeof LAND_RIGHTS)[number];

// What the land is designated for. Only one distinction decides anything:
// whether the plot is meant for a dwelling.
export const LAND_PURPOSES = ['Residential', 'Other'] as const;
export type LandPurpose = (typeof LAND_PURPOSES)[number];

// The six figures, named once, in the order the acceptance contract's decision
// table prints its columns.
export const CASE_PARAMETERS = [
  'builtYear',
  'storeys',
  'height',
  'span',
  'landRight',
  'purpose',
] as const;
export type CaseParameterKey = (typeof CASE_PARAMETERS)[number];

/*
 * The six figures as the engine could establish them. Null is a figure nobody
 * could state, and it is never a guess: a provision whose rule turns on it does
 * not answer (see `ProvisionRule.evaluate`).
 */
export type CaseParameters = {
  readonly builtYear: number | null;
  readonly storeys: number | null;
  // Metres, from ±0.000 to the underside of the top storey's covering (UPCC 80.1).
  readonly height: number | null;
  // Metres: the longest span of the building.
  readonly span: number | null;
  readonly landRight: LandRight | null;
  readonly purpose: LandPurpose | null;
};

// ─── Declarations ────────────────────────────────────────────────────────────

/*
 * One group of papers a provision asks for: any one of them answers it. A
 * provision's groups are all required, each on its own — the contract's "every
 * row is mandatory (AND); where a row names two documents, one of them is
 * enough (OR)".
 */
export type RequirementDeclaration = {
  readonly anyOf: readonly string[];
  /*
   * A group the policy asks the package for only up to a year, because from
   * then on the same fact reaches the registry through an integration instead
   * of on paper: the notification of construction is a letter before 06.2025
   * and an entry in the Urban Planning Committee's system after it. Written as
   * a year — inclusive bottom, exclusive top, as every bound in a profile is —
   * because the year is all the intake declares (ADR-0025).
   */
  readonly onlyBuiltBefore?: number;
};

/*
 * One row of the decision table: the conditions the six figures must meet for
 * the provision to apply, and what it then asks for. A condition left out is a
 * figure this provision does not turn on, and a figure it does not turn on
 * decides nothing about it — unread or not.
 */
export type ProvisionRuleDeclaration = {
  // The provision as the Law numbers it: "8.0.9.1.1".
  readonly provision: string;
  readonly description: string;
  // Years. Inclusive at the bottom, exclusive at the top.
  readonly builtFrom?: number;
  readonly builtBefore?: number;
  // Inclusive, as the contract writes them: "≤ 3 storeys", "≤ 12 m", "≤ 6 m".
  readonly storeysAtMost?: number;
  readonly heightAtMost?: number;
  // Exclusive: "> 12 m", the other side of the same line.
  readonly heightAbove?: number;
  readonly spanAtMost?: number;
  readonly landRights?: readonly LandRight[];
  readonly purposes?: readonly LandPurpose[];
  /*
   * The class of title document this provision rests on, where it names one:
   * 8.0.9.1.2 is registered on an ownership document and 8.0.9.1.1 on a lease or
   * use document, and a title of the other class does not found the case. Null
   * where the provision accepts either — 8.0.9.2, 8.0.10.1 and 8.0.10.2.
   */
  readonly titleRight?: LandRight;
  readonly requires: readonly RequirementDeclaration[];
};

/*
 * A paper that can be the title to the land — the document confirming the right
 * over the plot, which every provision asks for (Article 10.2.1) — and the window
 * of dates it is a title in.
 *
 * One paper may be listed under two items of the Decree with two windows — a
 * land allocation decision is point 1.4 up to 2006 and point 2.2 between 1991 and
 * 1995 — and a document is a title if any of its items admits its date.
 */
export type TitleDocumentDeclaration = {
  // The item of Decree No. 439 or of Article 8 that names the paper, or "MQS"
  // for the extract the registry retrieves itself (Article 12.1).
  readonly item: string;
  readonly type: string;
  // The right its kind confers, or null for a paper whose kind confers none —
  // the order allotting a parcel, whose own words say which right it grants
  // (ADR-0026).
  readonly landRight: LandRight | null;
  // The field of that document type the date of issue is read off.
  readonly dateField: string;
  // ISO dates. Inclusive at the bottom, exclusive at the top; null is open.
  readonly issuedFrom: string | null;
  readonly issuedBefore: string | null;
};

export type ProvisionsDeclaration = {
  readonly key: string;
  readonly description: string;
  // Where each figure is printed, as [document type key, field key], in the
  // order the papers are believed. The year is taken from what the office
  // declared at intake first and only then off these (ADR-0025).
  readonly builtIn: readonly (readonly [string, string])[];
  readonly storeys: readonly (readonly [string, string])[];
  readonly height: readonly (readonly [string, string])[];
  readonly span: readonly (readonly [string, string])[];
  readonly purpose: readonly (readonly [string, string])[];
  // Where the right is printed in words, for a package whose title document
  // is not among its papers. A title document that is here decides the right by
  // its class, before any of these is read.
  readonly landRight: readonly (readonly [string, string])[];
  readonly titleDocuments: readonly TitleDocumentDeclaration[];
  // In declaration order; the first rule whose conditions all hold applies.
  readonly rules: readonly ProvisionRuleDeclaration[];
};

// ─── Specs ───────────────────────────────────────────────────────────────────

// A place a figure is printed: a document type and a field of it.
export type FigureAt = {
  readonly type: DocumentType;
  readonly key: FieldKey;
};

function figuresAt(
  pairs: readonly (readonly [string, string])[],
): readonly FigureAt[] {
  return pairs.map(([type, key]) => ({
    type: DocumentType.create(type),
    key: FieldKey.create(key),
  }));
}

export class Requirement {
  readonly #anyOf: readonly DocumentType[];

  private constructor(
    anyOf: readonly DocumentType[],
    public readonly onlyBuiltBefore: number | null,
  ) {
    this.#anyOf = [...anyOf];
  }

  static of(declaration: RequirementDeclaration): Requirement {
    return new Requirement(
      declaration.anyOf.map(type => DocumentType.create(type)),
      declaration.onlyBuiltBefore ?? null,
    );
  }

  get anyOf(): readonly DocumentType[] {
    return this.#anyOf;
  }

  /*
   * Whether the policy asks the package for this group, for a case built in
   * this year. Null where it turns on a year nobody could state: the engine does
   * not guess which side of the line an unread year falls on, and a report that
   * asked for the letter in that case would be asking on a guess.
   */
  appliesTo(builtYear: number | null): boolean | null {
    if (this.onlyBuiltBefore === null) return true;
    if (builtYear === null) return null;

    return builtYear < this.onlyBuiltBefore;
  }

  answeredBy(types: readonly DocumentType[]): boolean {
    return this.#anyOf.some(wanted => types.some(type => type.equals(wanted)));
  }
}

// How one condition of a rule came out: it holds, it does not, or the figure it
// turns on could not be stated.
export type ConditionOutcome = {
  readonly parameter: CaseParameterKey;
  readonly holds: boolean | null;
};

export type RuleEvaluation = {
  readonly rule: ProvisionRule;
  readonly conditions: readonly ConditionOutcome[];
  // A condition that does not hold rules the provision out, whatever the rest
  // would have said.
  readonly excluded: boolean;
  // Nothing rules it out and every condition was decided.
  readonly holds: boolean;
};

export class ProvisionRule {
  readonly #landRights: readonly LandRight[] | null;
  readonly #purposes: readonly LandPurpose[] | null;
  readonly #requirements: readonly Requirement[];

  private constructor(
    private readonly declaration: ProvisionRuleDeclaration,
    requirements: readonly Requirement[],
  ) {
    this.#landRights = declaration.landRights
      ? [...declaration.landRights]
      : null;
    this.#purposes = declaration.purposes ? [...declaration.purposes] : null;
    this.#requirements = [...requirements];
  }

  static of(declaration: ProvisionRuleDeclaration): ProvisionRule {
    return new ProvisionRule(
      declaration,
      declaration.requires.map(requirement => Requirement.of(requirement)),
    );
  }

  get provision(): string {
    return this.declaration.provision;
  }

  get description(): string {
    return this.declaration.description;
  }

  get titleRight(): LandRight | null {
    return this.declaration.titleRight ?? null;
  }

  get requirements(): readonly Requirement[] {
    return this.#requirements;
  }

  /*
   * How the six figures stand against this rule, condition by condition.
   *
   * One outcome per figure the rule turns on, and none for a figure it does not:
   * "8.0.10.1 applies to anything built from 2013" says nothing about the height,
   * and an unread height must not make it undecided.
   */
  evaluate(parameters: CaseParameters): RuleEvaluation {
    const d = this.declaration;
    const conditions: ConditionOutcome[] = [];
    const judge = (
      parameter: CaseParameterKey,
      asks: boolean,
      measure: number | string | null,
      holds: () => boolean,
    ): void => {
      if (!asks) return;
      conditions.push({ parameter, holds: measure === null ? null : holds() });
    };

    const year = parameters.builtYear;
    judge(
      'builtYear',
      d.builtFrom !== undefined || d.builtBefore !== undefined,
      year,
      () =>
        (d.builtFrom === undefined || year! >= d.builtFrom) &&
        (d.builtBefore === undefined || year! < d.builtBefore),
    );
    judge(
      'storeys',
      d.storeysAtMost !== undefined,
      parameters.storeys,
      () => parameters.storeys! <= d.storeysAtMost!,
    );
    judge(
      'height',
      d.heightAtMost !== undefined || d.heightAbove !== undefined,
      parameters.height,
      () =>
        (d.heightAtMost === undefined ||
          parameters.height! <= d.heightAtMost) &&
        (d.heightAbove === undefined || parameters.height! > d.heightAbove),
    );
    judge(
      'span',
      d.spanAtMost !== undefined,
      parameters.span,
      () => parameters.span! <= d.spanAtMost!,
    );
    judge('landRight', this.#landRights !== null, parameters.landRight, () =>
      this.#landRights!.includes(parameters.landRight!),
    );
    judge('purpose', this.#purposes !== null, parameters.purpose, () =>
      this.#purposes!.includes(parameters.purpose!),
    );

    const excluded = conditions.some(condition => condition.holds === false);

    return {
      rule: this,
      conditions,
      excluded,
      holds: !excluded && conditions.every(condition => condition.holds),
    };
  }

  // The conditions as one line of an audit message, so a reader can see which
  // row of the table was applied without opening the profile.
  get conditions(): string {
    const d = this.declaration;
    const said = [
      d.builtFrom !== undefined && `built ${d.builtFrom} or later`,
      d.builtBefore !== undefined && `built before ${d.builtBefore}`,
      d.storeysAtMost !== undefined && `at most ${d.storeysAtMost} storeys`,
      d.heightAtMost !== undefined && `at most ${d.heightAtMost} m tall`,
      d.heightAbove !== undefined && `taller than ${d.heightAbove} m`,
      d.spanAtMost !== undefined && `spans of at most ${d.spanAtMost} m`,
      this.#landRights && `land held in ${this.#landRights.join(' or ')}`,
      this.#purposes && `land designated ${this.#purposes.join(' or ')}`,
    ].filter(Boolean);

    return said.length > 0 ? said.join(', ') : 'any case';
  }
}

/*
 * What the table made of a case.
 *
 * Three answers and not a provision-or-null, because the two ways of not having
 * one are told to an inspector differently: a figure nobody could read leaves
 * several provisions open, and the report names them; a case no row of the
 * table covers is a case the Law does not register this way, and the report says
 * that instead.
 */
export type ProvisionDecision =
  | {
      readonly outcome: 'Determined';
      readonly provision: ProvisionRule;
      readonly evaluations: readonly RuleEvaluation[];
    }
  | {
      readonly outcome: 'Ambiguous';
      readonly candidates: readonly ProvisionRule[];
      // The figures whose reading would settle it.
      readonly undecidedOn: readonly CaseParameterKey[];
      readonly evaluations: readonly RuleEvaluation[];
    }
  | {
      readonly outcome: 'Undetermined';
      readonly evaluations: readonly RuleEvaluation[];
    };

export type ProvisionOutcome = ProvisionDecision['outcome'];

// A span of dates a reading is known to fall in: one day for a full date, a
// whole year for a year written on its own. ISO strings.
export type DateSpan = {
  readonly first: string;
  readonly last: string;
};

export class TitleDocumentEntry {
  private constructor(
    public readonly item: string,
    public readonly type: DocumentType,
    public readonly landRight: LandRight | null,
    public readonly dateField: FieldKey,
    public readonly issuedFrom: string | null,
    public readonly issuedBefore: string | null,
  ) {}

  static of(declaration: TitleDocumentDeclaration): TitleDocumentEntry {
    return new TitleDocumentEntry(
      declaration.item,
      DocumentType.create(declaration.type),
      declaration.landRight,
      FieldKey.create(declaration.dateField),
      declaration.issuedFrom,
      declaration.issuedBefore,
    );
  }

  get isBoundedByDate(): boolean {
    return this.issuedFrom !== null || this.issuedBefore !== null;
  }

  /*
   * Whether a document dated within this span is a title under this item.
   *
   * Null where the date could not be read, and null where only a year was and
   * the window's edge falls inside that year: whether a decision of 1995 was
   * taken before or after 19 December is not something a year says.
   */
  admits(dated: DateSpan | null): boolean | null {
    if (!this.isBoundedByDate) return true;
    if (dated === null) return null;

    if (this.issuedFrom !== null && dated.last < this.issuedFrom) return false;
    if (this.issuedBefore !== null && dated.first >= this.issuedBefore) {
      return false;
    }

    const straddles =
      (this.issuedFrom !== null && dated.first < this.issuedFrom) ||
      (this.issuedBefore !== null && dated.last >= this.issuedBefore);

    return straddles ? null : true;
  }

  // The window as one line of an audit message.
  get window(): string {
    if (this.issuedFrom !== null && this.issuedBefore !== null) {
      return `from ${this.issuedFrom} to before ${this.issuedBefore}`;
    }
    if (this.issuedFrom !== null) return `from ${this.issuedFrom}`;
    if (this.issuedBefore !== null) return `before ${this.issuedBefore}`;

    return 'of any date';
  }
}

export class ProvisionsSpec {
  readonly #titleDocuments: readonly TitleDocumentEntry[];
  readonly #rules: readonly ProvisionRule[];

  private constructor(
    public readonly key: string,
    public readonly description: string,
    public readonly builtIn: readonly FigureAt[],
    public readonly storeys: readonly FigureAt[],
    public readonly height: readonly FigureAt[],
    public readonly span: readonly FigureAt[],
    public readonly purpose: readonly FigureAt[],
    public readonly landRight: readonly FigureAt[],
    titleDocuments: readonly TitleDocumentEntry[],
    rules: readonly ProvisionRule[],
  ) {
    this.#titleDocuments = [...titleDocuments];
    this.#rules = [...rules];
  }

  static of(declaration: ProvisionsDeclaration): ProvisionsSpec {
    const entries = declaration.titleDocuments.map(entry =>
      TitleDocumentEntry.of(entry),
    );

    ProvisionsSpec.guardOneRightPerType(entries);

    return new ProvisionsSpec(
      declaration.key,
      declaration.description,
      figuresAt(declaration.builtIn),
      figuresAt(declaration.storeys),
      figuresAt(declaration.height),
      figuresAt(declaration.span),
      figuresAt(declaration.purpose),
      figuresAt(declaration.landRight),
      entries,
      declaration.rules.map(rule => ProvisionRule.of(rule)),
    );
  }

  // The right a title document confers is read off its type, so a type listed
  // under two items must confer the same right under both: otherwise the class
  // of the case would depend on which item somebody read first. Checked at
  // import time, like every other promise a profile makes about itself.
  private static guardOneRightPerType(
    entries: readonly TitleDocumentEntry[],
  ): void {
    for (const entry of entries) {
      const other = entries.find(
        candidate =>
          candidate.type.equals(entry.type) &&
          candidate.landRight !== entry.landRight,
      );

      if (other) {
        throw new TitleDocumentRightConflictException(entry.type.value, [
          entry.item,
          other.item,
        ]);
      }
    }
  }

  get titleDocuments(): readonly TitleDocumentEntry[] {
    return this.#titleDocuments;
  }

  get rules(): readonly ProvisionRule[] {
    return this.#rules;
  }

  // Every type that can be the title to the land, each once, in the order the
  // table lists them.
  get titleTypes(): readonly DocumentType[] {
    return this.#titleDocuments
      .map(entry => entry.type)
      .filter(
        (type, index, all) =>
          all.findIndex(other => other.equals(type)) === index,
      );
  }

  isTitle(type: DocumentType): boolean {
    return this.#titleDocuments.some(entry => entry.type.equals(type));
  }

  entriesFor(type: DocumentType): readonly TitleDocumentEntry[] {
    return this.#titleDocuments.filter(entry => entry.type.equals(type));
  }

  rightConferredBy(type: DocumentType): LandRight | null {
    return this.entriesFor(type)[0]?.landRight ?? null;
  }

  ruleFor(provision: string): ProvisionRule | null {
    return this.#rules.find(rule => rule.provision === provision) ?? null;
  }

  /*
   * Which provision the case falls under.
   *
   * The table is read top to bottom and the first row whose conditions all hold
   * applies — the contract's hit policy FIRST, which is what lets 8.0.10.1 be
   * the fallback for everything built from 2013 that the notification procedure
   * does not cover. A row a figure rules out is skipped. A row that turns on a
   * figure nobody could state is neither applied nor skipped: it stays a
   * candidate, and so does every open row after it up to the first that holds,
   * because the unread figure could have made any of them the first.
   */
  decide(parameters: CaseParameters): ProvisionDecision {
    const evaluations = this.#rules.map(rule => rule.evaluate(parameters));
    const open = evaluations.filter(evaluation => !evaluation.excluded);

    if (open.length === 0) return { outcome: 'Undetermined', evaluations };

    const candidates: RuleEvaluation[] = [];

    for (const evaluation of open) {
      candidates.push(evaluation);
      if (evaluation.holds) break;
    }

    const [only] = candidates;

    if (candidates.length === 1 && only?.holds) {
      return { outcome: 'Determined', provision: only.rule, evaluations };
    }

    const undecidedOn = CASE_PARAMETERS.filter(parameter =>
      candidates.some(candidate =>
        candidate.conditions.some(
          condition =>
            condition.parameter === parameter && condition.holds === null,
        ),
      ),
    );

    return {
      outcome: 'Ambiguous',
      candidates: candidates.map(candidate => candidate.rule),
      undecidedOn,
      evaluations,
    };
  }
}
