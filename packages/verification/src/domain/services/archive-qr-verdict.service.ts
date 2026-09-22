import {
  ARCHIVE_QR_FIELDS,
  ArchiveQrCheck,
  ArchiveQrFieldCheck,
  ArchiveQrSignature,
  FieldKey,
  IssuingCompetence,
  type ArchiveQrField,
  type ArchiveQrVerdict,
  type DocumentType,
  type DocumentTypeSpec,
  type IssuingAuthorityKind,
} from '../value-objects/index.js';

import { looksLikeTheSameValue } from './value-agreement.service.js';

/*
 * Whether a paper of this type has its QR code resolved (ADR-0034).
 *
 * Every type whose schema declares `qr_code`, and nothing else. Until ADR-0034
 * this also asked that the profile source the paper from the National Archive
 * and declare all eight lines the archive's copy is compared on — which left
 * the two papers most inspectors actually look at, the register extract and the
 * plan of the plot, with a code on the sheet and no line in the report about
 * it. The narrower rule was a consequence of the check having one possible
 * answer; now that a code can resolve to an issuer this system cannot ask, a
 * paper whose code leads elsewhere gets a line saying exactly that, which is
 * more than the type-wide `IntegrationNotConnected` it used to get.
 *
 * What a paper is compared *on* did not widen with it: a type that declares
 * none of the eight lines is held against nothing, and its answer is about the
 * sheet — who issued the code and whether the signature on it verifies.
 */
export function isCheckedByItsQrCode(spec: DocumentTypeSpec): boolean {
  return spec.schema.declares(FieldKey.create('qr_code'));
}

/*
 * Whether the archive's copy of this type can be compared line by line: the
 * paper is sourced from the archive, declares every line the copy is held
 * against, and its issuing body's competence is something the Decree settles
 * (ADR-0028). Eleven types answer today.
 */
export function isHeldAgainstTheArchiveByQr(spec: DocumentTypeSpec): boolean {
  return (
    spec.source === 'NationalArchive' &&
    isCheckedByItsQrCode(spec) &&
    ARCHIVE_QR_FIELDS.every(field =>
      spec.schema.declares(FieldKey.create(field)),
    ) &&
    IssuingCompetence.covers(spec.type)
  );
}

/**
 * The archive's copy of a paper, as the National Archive Fund states it: one
 * value per line it holds the paper against, null where its entry gives none,
 * and the kind of body the fund it sits in was created by.
 */
export type ArchivedPaper = {
  readonly lines: Readonly<Record<ArchiveQrField, string | null>>;
  // Null where the answer says nothing about who issued the paper, which is
  // every answer that is about the sheet rather than about what it says.
  readonly issuingAuthorityKind: IssuingAuthorityKind | null;
  // What the issuer says about the sheet rather than about the paper: null from
  // a service that holds records and does not verify signatures (ADR-0034).
  readonly signature: ArchiveQrSignature | null;
};

/**
 * What holding one Decree 439 paper against the archive came to (ADR-0028).
 *
 * `qrReference` null is a paper nothing was read off to ask by; `archived` null
 * is a reference the archive answered with nothing. The archive states facts
 * and no verdict — which lines agree and whether the body could issue a paper
 * of this kind are decided here, where the rules for comparing a reading are.
 */
export function archiveQrCheckOf(question: {
  readonly type: DocumentType;
  readonly stated: (field: ArchiveQrField) => string | null;
  readonly qrReference: string | null;
  readonly archived: ArchivedPaper | null;
  // Whoever issued the code, where the reference names them and this system
  // cannot ask them. Null means the issuer was asked (ADR-0034).
  readonly unaskedIssuer?: string | null;
  readonly checkedAt: Date;
}): ArchiveQrCheck {
  const reference = question.qrReference?.trim() ?? '';

  if (reference.length === 0)
    return ArchiveQrCheck.noQrCode(question.checkedAt);

  if (question.unaskedIssuer !== undefined) {
    return ArchiveQrCheck.issuerNotConnected(
      reference,
      question.unaskedIssuer,
      question.checkedAt,
    );
  }

  if (!question.archived) {
    return ArchiveQrCheck.notFound(reference, question.checkedAt);
  }

  const archived = question.archived;
  const fields = ARCHIVE_QR_FIELDS.map(name => {
    const documentValue = stated(question.stated(name));
    const archiveValue = stated(archived.lines[name]);

    return ArchiveQrFieldCheck.of({
      name,
      documentValue,
      archiveValue,
      verdict: verdictOn(name, documentValue, archiveValue),
    });
  });

  /*
   * An answer that holds nothing this paper can be held against is not a
   * confirmation of it (ADR-0034).
   *
   * `found` would otherwise read eight `NotStated` lines as "nothing
   * disagrees" and answer `Confirmed` — the paper confirmed by an entry that
   * says nothing about it, which is the one verdict this check must never
   * produce. From the caller's side that is the same thing as an empty
   * shelf, so it is told the same way.
   */
  const evidence =
    fields.some(field => field.verdict !== 'NotStated') ||
    archived.signature !== null;

  if (!evidence) return ArchiveQrCheck.notFound(reference, question.checkedAt);

  return ArchiveQrCheck.found({
    qrReference: reference,
    checkedAt: question.checkedAt,
    issuingAuthorityCompetent: competenceOf(
      question.type,
      archived.issuingAuthorityKind,
    ),
    fields,
    signature: archived.signature,
  });
}

/*
 * Whether the body that issued the paper could issue one of this kind — and
 * `null` wherever that is not a question anybody answered.
 *
 * Two ways of not being a question. The Decree's table settles eleven types and
 * says nothing about the rest, so for a register extract there is no rule to
 * apply; and an answer that names no issuing body has named nobody to apply one
 * to. Either way `competent` would answer `false` for want of an input, turning
 * "no rule" and "no answer" into "no power" (ADR-0034).
 */
function competenceOf(
  type: DocumentType,
  kind: IssuingAuthorityKind | null,
): boolean | null {
  if (kind === null || !IssuingCompetence.covers(type)) return null;

  return IssuingCompetence.competent(type, kind);
}

function stated(raw: string | null): string | null {
  const trimmed = raw?.trim() ?? '';

  return trimmed.length === 0 ? null : trimmed;
}

function verdictOn(
  name: ArchiveQrField,
  documentValue: string | null,
  archiveValue: string | null,
): ArchiveQrVerdict {
  if (documentValue === null || archiveValue === null) return 'NotStated';

  return AGREES[name](documentValue, archiveValue) ? 'Match' : 'Mismatch';
}

/*
 * One rule per line, each as forgiving as the paper is and no more.
 *
 * A number is its characters, a date is its day, an area is its square metres
 * and a reference into the archive is its four numbers. Names, bodies and
 * addresses are prose, and take the rule two papers of one package are already
 * held to — the case ending a form puts on a name, a level one side spells out.
 */
const AGREES: Record<
  ArchiveQrField,
  (paper: string, archive: string) => boolean
> = {
  document_no: (paper, archive) => skeleton(paper) === skeleton(archive),
  issue_date: sameDay,
  issuing_authority: looksLikeTheSameValue,
  holder_name: looksLikeTheSameValue,
  property_address: looksLikeTheSameValue,
  plot_area: sameArea,
  decree_item: (paper, archive) => {
    const ours = decreeItemIn(paper);
    const theirs = decreeItemIn(archive);

    return ours !== null && ours === theirs;
  },
  archive_reference: (paper, archive) => {
    const ours = numbersIn(paper);

    return ours.length > 0 && ours === numbersIn(archive);
  },
};

function skeleton(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replaceAll(/[^\p{L}\p{N}]/gu, '');
}

/*
 * Day, month and year, however they are separated. A 1998 act is dated
 * 29.10.1998 and an archive database answers 1998-10-29; both are one day.
 * A figure that is not a date at all is held as characters, so it can still
 * agree with the same characters.
 */
function sameDay(paper: string, archive: string): boolean {
  const ours = dayOf(paper);
  const theirs = dayOf(archive);

  return ours !== null && theirs !== null
    ? ours === theirs
    : skeleton(paper) === skeleton(archive);
}

function dayOf(raw: string): string | null {
  const dayFirst = /\b(\d{1,2})[./-](\d{1,2})[./-](\d{4})\b/u.exec(raw);
  const yearFirst = /\b(\d{4})[./-](\d{1,2})[./-](\d{1,2})\b/u.exec(raw);
  const [year, month, day] = dayFirst
    ? [dayFirst[3], dayFirst[2], dayFirst[1]]
    : yearFirst
      ? [yearFirst[1], yearFirst[2], yearFirst[3]]
      : [];

  if (!year || !month || !day) return null;

  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

/*
 * What one square metre is in each unit a paper states a plot in.
 *
 * The same units `libs/matching-engine`'s `parseArea` knows, written again
 * because a context may not import an engine (TECH_DEBT §7): 400 kv.m and
 * 0.04 ha are one plot.
 */
const IN_SQUARE_METRES: ReadonlyMap<string, number> = new Map(
  Object.entries({
    '': 1,
    m2: 1,
    'm²': 1,
    kvm: 1,
    kv: 1,
    sqm: 1,
    кв: 1,
    квм: 1,
    sot: 100,
    sotka: 100,
    сот: 100,
    ha: 10_000,
    hektar: 10_000,
    ga: 10_000,
    га: 10_000,
  }),
);

// Areas are stated to two decimals at most, so anything below a square
// centimetre is the float arithmetic and not the paper.
const AREA_NOISE = 1e-4;

function sameArea(paper: string, archive: string): boolean {
  const ours = squareMetresIn(paper);
  const theirs = squareMetresIn(archive);

  return (
    ours !== null && theirs !== null && Math.abs(ours - theirs) < AREA_NOISE
  );
}

function squareMetresIn(raw: string): number | null {
  const cleaned = raw.toLowerCase().replaceAll(/\s+/gu, ' ').trim();
  const figure = /(\d+(?:[.,]\d+)?)/u.exec(cleaned);

  if (!figure?.[1]) return null;

  const amount = Number(figure[1].replace(',', '.'));
  const unit = cleaned
    .slice(figure.index + figure[1].length)
    .replaceAll(/[^\p{L}\p{N}²]/gu, '');
  const factor = IN_SQUARE_METRES.get(unit);

  // A unit nobody can convert is not a figure anybody can compare.
  return Number.isFinite(amount) && factor !== undefined
    ? amount * factor
    : null;
}

// "2.7", "2.7-ci bənd", "п. 2.5-1": the item is its numbers, dots and the one
// hyphen the Decree numbers a sub-item with.
function decreeItemIn(raw: string): string | null {
  return /\d+(?:\.\d+)*(?:-\d+)?/u.exec(raw)?.[0] ?? null;
}

// "Fond-130, siy.1, i-476, vər.98" and "F. 130, siyahı 1, iş 476, vərəq 98" are
// one sheet: fond, inventory, file and sheet, in that order.
function numbersIn(raw: string): string {
  return (raw.match(/\d+/gu) ?? []).map(Number).join('/');
}
