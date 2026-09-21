import { DocumentType } from '../value-objects/document-type.vo.js';
import type {
  CaseParameterKey,
  CaseParameters,
  FigureAt,
  LandRight,
  ProvisionDecision,
  ProvisionRule,
  ProvisionsSpec,
} from '../value-objects/provision.vo.js';

import {
  dateSpanIn,
  heightInMetres,
  spanInMetres,
  storeysIn,
  yearIn,
} from './building-measures.service.js';
import type { ReadDocument } from './document-gaps.service.js';
import { landPurposeIn, landRightIn } from './land-title.service.js';

/*
 * Which provision of Article 8 this package's case falls under, what that
 * provision asks for and how the package answers it, and what the package's
 * title documents say about themselves (ADR-0025).
 *
 * A domain service over flat readings and not a method of the aggregate, for the
 * reason the gaps are one (COMM-80): the detail query answers the same question
 * off rows without loading the aggregate, and the report, the gaps the supply
 * operation accepts and the panel an inspector reads must be one answer.
 *
 * Worked out on every read and never stored, like the standing (ADR-0014): the
 * readings it is decided on are stored, and a second copy of a conclusion drawn
 * from them is a copy that can disagree with them.
 */

// Where a figure the case was decided on came from.
export const PARAMETER_SOURCES = [
  // Read off a sheet of a document of this package.
  'ReadOffDocument',
  // Decided by the kind of title document the package carries, not by anything
  // printed on it: a state act is an ownership document whatever its lines say.
  'TitleDocumentType',
] as const;
export type ParameterSource = (typeof PARAMETER_SOURCES)[number];

// The document, field and sheet a figure is believed from.
export type FigureReading = {
  readonly documentId: string;
  readonly documentType: string;
  // Null for a figure decided by the kind of document rather than a field of it.
  readonly fieldKey: string | null;
  readonly pageNumber: number | null;
  readonly confidence: number | null;
};

/*
 * One figure as the engine established it: the value it took, where it came
 * from, and what was stated — the words of the reading or the declared year.
 *
 * A stated value that could not be understood stays here beside a null value,
 * so a reader sees "2 mərtəbə" was read as a height and refused rather than
 * seeing that nothing was read.
 */
export type ParameterReading = {
  readonly parameter: CaseParameterKey;
  readonly source: ParameterSource | null;
  readonly stated: string | null;
  readonly from: FigureReading | null;
};

export type RequirementStanding = {
  readonly anyOf: readonly string[];
  readonly onlyBuiltBefore: number | null;
  // Whether the policy asks this package for the group: null where it turns on
  // a year nobody could state.
  readonly applies: boolean | null;
  readonly answered: boolean;
};

export type ProvisionStanding = {
  readonly provision: string;
  readonly description: string;
  readonly titleRight: LandRight | null;
  readonly requirements: readonly RequirementStanding[];
};

export type TitleDocumentStanding = {
  readonly documentId: string;
  readonly documentType: string;
  readonly landRight: LandRight;
  // The date the window is held against, where the document states one.
  readonly dated:
    | (Omit<FigureReading, 'fieldKey'> & {
        readonly fieldKey: string;
        readonly value: string;
      })
    | null;
  // Whether any item this paper is listed under admits its date. Null where the
  // date could not be read, or where only a year was and a window's edge falls
  // inside it.
  readonly withinWindow: boolean | null;
  readonly items: readonly {
    readonly item: string;
    // The window as one English line, for an audit message.
    readonly window: string;
    // The same window as dates, for a reader in their own language. ISO;
    // inclusive at the bottom, exclusive at the top, null for an open end.
    readonly issuedFrom: string | null;
    readonly issuedBefore: string | null;
    readonly admits: boolean | null;
  }[];
  /*
   * The provisions this case falls under, or would fall under on the right an
   * extract or a plan words, that rest on the other class of title — a
   * lease-or-use title beside a case of 8.0.9.1.2. Empty for a title the case
   * can stand on, for the register's own extract, and for a title outside its
   * window, which founds nothing already (ADR-0030).
   */
  readonly wrongClassFor: readonly string[];
};

export type CaseProvision = {
  readonly key: string;
  readonly parameters: CaseParameters;
  readonly readings: readonly ParameterReading[];
  readonly decision: ProvisionDecision;
  // The determined provision, or every candidate of an ambiguous case. Empty
  // where no provision covers the case.
  readonly provisions: readonly ProvisionStanding[];
  readonly titleDocuments: readonly TitleDocumentStanding[];
};

type Placed = {
  readonly document: ReadDocument;
  readonly type: DocumentType;
};

export function provisionOf(
  spec: ProvisionsSpec,
  documents: readonly ReadDocument[],
): CaseProvision {
  const placed: readonly Placed[] = documents.flatMap(document => {
    if (document.superseded || document.type === null) return [];

    const type = DocumentType.create(document.type);

    return type.isKnown ? [{ document, type }] : [];
  });

  // Off the papers alone, in the table's order, and never off what the office
  // declared at intake (ADR-0026).
  const builtYear = figure('builtYear', spec.builtIn, placed, yearIn);
  const storeys = figure('storeys', spec.storeys, placed, storeysIn);
  const height = figure('height', spec.height, placed, heightInMetres);
  const span = figure('span', spec.span, placed, spanInMetres);
  const landRight = rightOf(spec, placed);
  const purpose = figure('purpose', spec.purpose, placed, landPurposeIn);

  const parameters: CaseParameters = {
    builtYear: builtYear.value,
    storeys: storeys.value,
    height: height.value,
    span: span.value,
    landRight: landRight.value,
    purpose: purpose.value,
  };

  const decision = spec.decide(parameters);
  const types = placed.map(one => one.type);
  const worded = figure('landRight', spec.landRight, placed, landRightIn).value;
  const heldTo = [
    ...provisionsOf(decision),
    ...(worded !== null && worded !== parameters.landRight
      ? provisionsOf(spec.decide({ ...parameters, landRight: worded }))
      : []),
  ];

  return {
    key: spec.key,
    parameters,
    readings: [
      builtYear.reading,
      storeys.reading,
      height.reading,
      span.reading,
      landRight.reading,
      purpose.reading,
    ],
    decision,
    provisions: provisionsOf(decision).map(rule =>
      standingOf(rule, parameters.builtYear, types),
    ),
    titleDocuments: placed.flatMap(one => titleStandingOf(spec, one, heldTo)),
  };
}

// The provisions a reader is shown the requirements of.
function provisionsOf(decision: ProvisionDecision): readonly ProvisionRule[] {
  switch (decision.outcome) {
    case 'Determined':
      return [decision.provision];
    case 'Ambiguous':
      return decision.candidates;
    case 'Undetermined':
      return [];
  }
}

function standingOf(
  rule: ProvisionRule,
  builtYear: number | null,
  types: readonly DocumentType[],
): ProvisionStanding {
  return {
    provision: rule.provision,
    description: rule.description,
    titleRight: rule.titleRight,
    requirements: rule.requirements.map(requirement => ({
      anyOf: requirement.anyOf.map(type => type.value),
      onlyBuiltBefore: requirement.onlyBuiltBefore,
      applies: requirement.appliesTo(builtYear),
      answered: requirement.answeredBy(types),
    })),
  };
}

type Established<T> = {
  readonly value: T | null;
  readonly reading: ParameterReading;
};

/*
 * The right over the land. The class of title document decides it where the
 * package carries one — "Ownership: register extract, state act, 8.0.5
 * documents. Lease/use: 1.1, 1.4, 1.6, 2.2, 2.3, 2.4, 2.5, 2.5-1, 2.7, 2.8,
 * 8.0.1" — and only where it carries none is the right read off how a plan or
 * an extract words it. Wording beside a title decides nothing: a title of the
 * other class than the wording is a mismatch, and is reported as one
 * (ADR-0030).
 *
 * Two title documents of two different classes decide nothing: which of them
 * the case stands on is a question for the inspector, and the figure is left
 * unstated rather than taken from whichever came first.
 */
function rightOf(
  spec: ProvisionsSpec,
  placed: readonly Placed[],
): Established<LandRight> {
  const titles = placed.flatMap(one => {
    const right = spec.rightConferredBy(one.type);
    // A paper dated outside every window its items give it founds nothing, so
    // its kind decides nothing either (ADR-0026): it is reported as invalid and
    // not counted as the title the case stands on.
    const outside = titleStandingOf(spec, one, [])[0]?.withinWindow === false;

    return right && !outside ? [{ ...one, right }] : [];
  });

  const [first] = titles;

  if (!first) return figure('landRight', spec.landRight, placed, landRightIn);

  const rights = new Set(titles.map(title => title.right));

  return {
    value: rights.size === 1 ? first.right : null,
    reading: {
      parameter: 'landRight',
      source: 'TitleDocumentType',
      stated: [...rights].join(', '),
      from: {
        documentId: first.document.documentId,
        documentType: first.type.value,
        fieldKey: null,
        pageNumber: null,
        confidence: first.document.classifiedAt,
      },
    },
  };
}

/*
 * A figure off the first of its places this package states, in the profile's
 * order — the same walk every ordered reference in a profile gets (ADR-0010).
 *
 * The first reading that exists decides, whether or not it can be understood:
 * falling through to the next paper when the first is illegible would decide
 * the case on a paper the profile believes less, without anybody being told.
 */
function figure<T>(
  parameter: CaseParameterKey,
  places: readonly FigureAt[],
  placed: readonly Placed[],
  understand: (raw: string) => T | null,
): Established<T> {
  for (const at of places) {
    for (const { document, type } of placed) {
      if (!type.equals(at.type)) continue;

      const reading = document.readings.find(one => one.key === at.key.value);

      if (!reading) continue;

      return {
        value: understand(reading.value),
        reading: {
          parameter,
          source: 'ReadOffDocument',
          stated: reading.value,
          from: {
            documentId: document.documentId,
            documentType: type.value,
            fieldKey: reading.key,
            pageNumber: reading.pageNumber,
            confidence: reading.confidence,
          },
        },
      };
    }
  }

  return {
    value: null,
    reading: { parameter, source: null, stated: null, from: null },
  };
}

function titleStandingOf(
  spec: ProvisionsSpec,
  { document, type }: Placed,
  heldTo: readonly ProvisionRule[],
): readonly TitleDocumentStanding[] {
  const entries = spec.entriesFor(type);
  const [first] = entries;

  if (!first) return [];

  const reading = document.readings.find(
    one => one.key === first.dateField.value,
  );
  const span = reading ? dateSpanIn(reading.value) : null;
  const items = entries.map(entry => ({
    item: entry.item,
    window: entry.window,
    issuedFrom: entry.issuedFrom,
    issuedBefore: entry.issuedBefore,
    admits: entry.admits(span),
  }));

  const withinWindow = items.some(item => item.admits === true)
    ? true
    : items.every(item => item.admits === false)
      ? false
      : null;

  return [
    {
      documentId: document.documentId,
      documentType: type.value,
      landRight: first.landRight,
      dated: reading
        ? {
            documentId: document.documentId,
            documentType: type.value,
            fieldKey: reading.key,
            pageNumber: reading.pageNumber,
            confidence: reading.confidence,
            value: reading.value,
          }
        : null,
      withinWindow,
      items,
      wrongClassFor:
        withinWindow === false || entries.some(entry => entry.isRegisterRecord)
          ? []
          : heldTo
              .filter(
                rule =>
                  rule.titleRight !== null &&
                  rule.titleRight !== first.landRight,
              )
              .map(rule => rule.provision)
              .filter((one, index, all) => all.indexOf(one) === index),
    },
  ];
}
