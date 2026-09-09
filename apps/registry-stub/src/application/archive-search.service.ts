import { Inject, Injectable } from '@nestjs/common';

import type {
  ArchiveMatchDto,
  ArchiveRecordDto,
  ArchiveSearchApi,
  ArchiveSearchRequest,
  ArchiveSearchResponse,
  MatchedCriterionDto,
  SearchCriterion,
  SourceDisagreementDto,
} from '@cadastre/api-contracts/registry';
import { Logger } from '@cadastre/logger';
import {
  addressConfidence,
  addressKey,
  areasAgree,
  nameConfidence,
  namesAgree,
  normaliseAddress,
  referenceConfidence,
  referencesAgree,
} from '@cadastre/matching-engine';

import { registerOfSource } from '../domain/index.js';

import { RegistrySource, type ArchiveCandidate } from './ports/index.js';

/**
 * How each criterion is graded, and the field of the record it is graded
 * against.
 *
 * Every rule is the engine's. The register grading a name one way and the
 * verification stage grading it another would be two registers, and the whole
 * point of `libs/matching-engine` is that there is one (ADR-0009 §8).
 */
const GRADED: Readonly<
  Record<SearchCriterion, (submitted: string, recorded: string) => number>
> = {
  address: addressConfidence,
  ownerName: nameConfidence,
  cadastralNumber: referenceConfidence,
};

/** The criteria in the order a caller reads them back. */
const CRITERIA: readonly SearchCriterion[] = [
  'address',
  'ownerName',
  'cadastralNumber',
];

/**
 * The fields two sources can be caught contradicting each other about, and the
 * rule that decides whether they are.
 *
 * Not the register number, deliberately. One case genuinely holds a different
 * register number at each office that ever registered it — that is what the
 * Hövsan handover registers are (ADR-0010) — so two of them are the archive
 * working as designed and not a contradiction to report.
 */
const CONTESTED: readonly {
  readonly field: string;
  readonly of: (record: ArchiveRecordDto) => string | null;
  readonly agree: (left: string, right: string) => boolean;
}[] = [
  { field: 'ownerName', of: record => record.ownerName, agree: namesAgree },
  {
    field: 'cadastralNumber',
    of: record => record.cadastralNumber,
    agree: referencesAgree,
  },
  { field: 'plotArea', of: record => record.plotArea, agree: areasAgree },
];

/**
 * Searches the archive, and stops there.
 *
 * Everything it answers is a fact about two strings: how far what was typed is
 * from what a register wrote down, which register wrote it, and whether another
 * register wrote something else. There is no verdict and no band — a band is a
 * word for a number, and the number is what the register computed (ADR-0009).
 *
 * It is a separate service from `AddressesService` because it answers a
 * separate question. That one resolves a submission's address to the one record
 * a verification stage may act on, and refuses to choose when two answer; this
 * one offers everything that might be the record and refuses to act at all.
 */
@Injectable()
export class ArchiveSearchService implements ArchiveSearchApi {
  private readonly logger: Logger;

  constructor(
    @Inject(Logger) logger: Logger,
    @Inject(RegistrySource) private readonly source: RegistrySource,
  ) {
    this.logger = logger.child({ scope: ArchiveSearchService.name });
  }

  async search(request: ArchiveSearchRequest): Promise<ArchiveSearchResponse> {
    const asked = criteriaOf(request);
    const candidates = await this.source.findCandidates({
      ...asked,
      threshold: request.threshold,
    });

    const graded = candidates
      .map(candidate => grade(candidate, asked))
      .filter(
        (match): match is ArchiveMatchDto =>
          match !== null && match.confidence >= request.threshold,
      );

    const { disagreements, contested } = disagreementsAmong(graded);
    const matches = graded
      .map(match => ({
        ...match,
        disputed: contested.has(subjectOf(match.record)),
      }))
      .sort(surestFirst)
      .slice(0, request.limit);

    const answer: ArchiveSearchResponse = {
      threshold: request.threshold,
      matches,
      matched: graded.length,
      considered: candidates.length,
      // Over everything that cleared the threshold and not over the page, as
      // the disagreements are: which registers answered at all is a fact about
      // the search, not about how much of it fitted on one page.
      sources: [...new Set(graded.map(match => match.source.name))].sort(),
      disagreements,
      note: noteFor(graded.length, candidates.length, request, disagreements),
    };

    /*
     * What was searched for is never written to the log — a name and an address
     * are somebody's property. Which criteria were used, and what the register
     * made of them, is (ADR-0008).
     */
    this.logger.log('Archive searched', {
      criteria: Object.keys(asked),
      threshold: request.threshold,
      considered: answer.considered,
      matched: answer.matched,
      returned: matches.length,
      disagreements: answer.disagreements.length,
    });

    return answer;
  }
}

/** The criteria the caller actually named, without the paging around them. */
function criteriaOf(
  request: ArchiveSearchRequest,
): Partial<Record<SearchCriterion, string>> {
  const asked: Partial<Record<SearchCriterion, string>> = {};

  if (request.address !== undefined) asked.address = request.address;
  if (request.ownerName !== undefined) asked.ownerName = request.ownerName;
  if (request.cadastralNumber !== undefined) {
    asked.cadastralNumber = request.cadastralNumber;
  }

  return asked;
}

/**
 * One candidate graded against everything the caller asked, or null where the
 * record could answer none of it.
 *
 * The confidence is the average over the criteria the record could answer and
 * over nothing else. A register that never carried a cadastral number column is
 * silent about one (`AttributeMatch.NotRecorded` says the same thing on the
 * lookup), and silence is neither agreement nor disagreement: counting it as
 * either would make a record's score depend on which columns its office kept
 * thirty years ago. A record that could answer nothing is not a match at any
 * threshold, including none.
 */
function grade(
  candidate: ArchiveCandidate,
  asked: Partial<Record<SearchCriterion, string>>,
): ArchiveMatchDto | null {
  const criteria = CRITERIA.flatMap<MatchedCriterionDto>(criterion => {
    const submitted = asked[criterion];

    if (submitted === undefined) return [];

    return [
      criterion === 'address'
        ? bestSpelling(submitted, candidate)
        : held(criterion, submitted, candidate.record),
    ];
  });

  const answered = criteria.filter(
    (line): line is MatchedCriterionDto & { confidence: number } =>
      line.confidence !== null,
  );

  if (answered.length === 0) return null;

  return {
    record: candidate.record,
    source: {
      name: candidate.source,
      register: registerOfSource(candidate.source),
    },
    confidence:
      answered.reduce((total, line) => total + line.confidence, 0) /
      answered.length,
    criteria,
    // Decided over the whole set of matches, once they are all graded.
    disputed: false,
  };
}

/**
 * The address criterion, graded against every spelling the register holds and
 * answered with the one that did best.
 *
 * A property has as many addresses as offices that wrote one down, and the
 * `köhnə ünvan` is as much the property's address as the URIS-assigned form
 * above it. Grading only the current spelling would find a record by its old
 * address and then report it as a poor match for the words that found it.
 */
function bestSpelling(
  submitted: string,
  candidate: ArchiveCandidate,
): MatchedCriterionDto {
  const spellings =
    candidate.addresses.length > 0
      ? candidate.addresses
      : [candidate.record.address];

  const best = spellings.reduce<{ value: string; confidence: number } | null>(
    (surest, value) => {
      const confidence = addressConfidence(submitted, value);

      return surest === null || confidence > surest.confidence
        ? { value, confidence }
        : surest;
    },
    null,
  );

  return {
    criterion: 'address',
    submitted,
    recorded: best?.value ?? null,
    confidence: best === null || best.value === '' ? null : best.confidence,
  };
}

/** One criterion held against the field of the record it names. */
function held(
  criterion: SearchCriterion,
  submitted: string,
  record: ArchiveRecordDto,
): MatchedCriterionDto {
  const recorded =
    criterion === 'ownerName' ? record.ownerName : record.cadastralNumber;

  return {
    criterion,
    submitted,
    recorded,
    confidence: recorded === null ? null : GRADED[criterion](submitted, recorded), // prettier-ignore
  };
}

/**
 * How the search groups two records into one property: the address, read by the
 * same rule that decides two spellings name one place.
 *
 * The address and not the register number, because the register number is
 * exactly what two offices disagree about — the same house is 308011000692 at
 * Absheron and 006011006603 at Baku (ADR-0010). Grouping on it would put the
 * two records of one house in two groups and find no disagreement at all.
 */
function subjectOf(record: ArchiveRecordDto): string {
  return addressKey(record.address);
}

/**
 * Where two sources answered for one property and said something else.
 *
 * Only across sources: one source holding two records for an address is an
 * ambiguity of that register's own, which the lookup already answers as
 * `Ambiguous`, and calling it a divergence between sources would be a different
 * claim than the data supports. Only where both actually say something: a
 * register with no column for a field is silent, and silence contradicts
 * nothing.
 *
 * Taken over everything that cleared the threshold rather than over the page
 * that is returned — a contradiction that fell off the end of the page is still
 * a contradiction.
 */
function disagreementsAmong(matches: readonly ArchiveMatchDto[]): {
  readonly disagreements: SourceDisagreementDto[];
  /** The subjects at least one field is contested on, for the flag on a row. */
  readonly contested: ReadonlySet<string>;
} {
  const bySubject = new Map<string, ArchiveMatchDto[]>();

  for (const match of matches) {
    const subject = subjectOf(match.record);
    bySubject.set(subject, [...(bySubject.get(subject) ?? []), match]);
  }

  const disagreements: SourceDisagreementDto[] = [];
  const contested = new Set<string>();

  for (const [subject, group] of bySubject) {
    for (const field of CONTESTED) {
      const statements = group.flatMap(match => {
        const value = field.of(match.record);

        return value === null ? [] : [{ source: match.source.name, value }];
      });

      const differs = statements.some(one =>
        statements.some(
          other =>
            one.source !== other.source && !field.agree(one.value, other.value),
        ),
      );

      if (!differs) continue;

      disagreements.push({
        subject: normaliseAddress(group[0]?.record.address ?? ''),
        field: field.field,
        statements,
      });
      contested.add(subject);
    }
  }

  return { disagreements, contested };
}

/**
 * The surest first, and among equals the one that answered more of the
 * question.
 *
 * The tie-break is not decoration. A confidence is an average over the criteria
 * a record could answer, so a record that carries only an address can score 1
 * on an address alone while the record that also matched the parcel number
 * scores the same — and the second one is the answer. Register number last, so
 * two equal rows come back in the same order every time they are asked for.
 */
function surestFirst(left: ArchiveMatchDto, right: ArchiveMatchDto): number {
  if (right.confidence !== left.confidence) {
    return right.confidence - left.confidence;
  }

  const answered = (match: ArchiveMatchDto): number =>
    match.criteria.filter(line => line.confidence !== null).length;

  return (
    answered(right) - answered(left) ||
    left.record.registerNo.localeCompare(right.record.registerNo)
  );
}

/** The audit line: what was asked, over how much, and what came back. */
function noteFor(
  matched: number,
  considered: number,
  request: ArchiveSearchRequest,
  disagreements: readonly SourceDisagreementDto[],
): string {
  const by = CRITERIA.filter(criterion => request[criterion] !== undefined);
  const found =
    `${matched} of ${considered} records compared reach a confidence of ` +
    `${request.threshold.toFixed(2)}, searching by ${by.join(', ')}.`;

  if (matched === 0) {
    return `${found} The register's coverage is partial and historical.`;
  }

  return disagreements.length === 0
    ? found
    : `${found} ${disagreements.length} of the properties found are recorded ` +
        `differently by more than one source.`;
}
