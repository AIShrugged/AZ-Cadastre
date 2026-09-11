import { InvalidIssueKindException } from '../exceptions/index.js';

export class IssueKind {
  static readonly MISSING_DOCUMENT = new IssueKind('MissingDocument');
  static readonly UNREADABLE_DOCUMENT = new IssueKind('UnreadableDocument');
  static readonly LOW_CONFIDENCE = new IssueKind('LowConfidence');
  // Two documents of the same submission were asked to agree on a value the
  // profile says must be one value — the name on the identity card against the
  // name the application is made in — and they were not shown to agree.
  static readonly FIELD_MISMATCH = new IssueKind('FieldMismatch');
  // The archive register holds a record of this property and it says something
  // else — a different owner, a different area, a different cadastral number.
  // Unlike FIELD_MISMATCH this is not the papers disagreeing with each other
  // but with the record of what was registered, which is why it is a kind of
  // its own and not a second flavour of the same one (ADR-0009).
  static readonly REGISTRY_MISMATCH = new IssueKind('RegistryMismatch');
  // The archive does not hold the original of a paper the submission rests on.
  // Not MISSING_DOCUMENT, which is about the envelope: the paper is here, and
  // the file it should have come out of does not have it. For a title relied on
  // under Decree 439 that is the whole question — §7 makes the original in the
  // National Archive Fund a condition of the ground being valid (ADR-0010).
  static readonly REGISTRY_DOCUMENT_MISSING = new IssueKind(
    'RegistryDocumentMissing',
  );
  // A document the package carries that the profile does not ask for, and a
  // required type that two documents answer to at once. Neither is a fault:
  // packages arrive with the registry's own service sheets in them, and a title
  // can rest on a chain of two acts. They are told to the inspector because
  // only the inspector can say whether this one matters.
  static readonly EXTRA_DOCUMENT = new IssueKind('ExtraDocument');
  static readonly DUPLICATE_DOCUMENT = new IssueKind('DuplicateDocument');
  // The register held no record of the property, or held more than one. Its
  // coverage is partial and historical — the privatisations of the 1990s and
  // 2000s, not everything that exists — so an absence proves nothing and is
  // told to the inspector rather than counted against the package.
  static readonly REGISTRY_UNCONFIRMED = new IssueKind('RegistryUnconfirmed');
  // A paper that is only itself once an office has sealed or signed it came
  // without the mark, or with one nothing could be read off. Not
  // UNREADABLE_DOCUMENT, which is about the reading: the sheet was read, and
  // what it was read to hold is a document short of what makes it valid
  // (ADR-0012).
  static readonly MISSING_ATTESTATION = new IssueKind('MissingAttestation');
  /*
   * What the applicant must bring beyond the envelope, for the case this
   * package turned out to be. The third thing a report can say: not a
   * shortfall in what arrived and not a doubt about how well it was read, but
   * a statement about what happens next.
   *
   * The engine never checks these papers — they are not in the envelope and
   * several are issued by offices this system does not reach — so it is stated
   * for the applicant and counts for nothing against the package. It is stated
   * whether or not the case could be placed in a band, because an applicant
   * whose height nobody could read still has papers to bring; the two are told
   * apart by whether the message carries the reading it was decided on
   * (ADR-0013).
   */
  static readonly SUPPORTING_DOCUMENTS_REQUIRED = new IssueKind(
    'SupportingDocumentsRequired',
  );
  /*
   * What the office declared when it took the submission in is not what the
   * papers turned out to say.
   *
   * Not FIELD_MISMATCH, which is two papers of one submission disagreeing, and
   * not REGISTRY_MISMATCH, which is the papers disagreeing with the record of
   * what was registered. This is the papers disagreeing with the counter, and
   * it is the only one of the three where one side was typed by a person.
   *
   * Neither side is presumed right — a year is as easy to mistype at a counter
   * as it is to misread off a scan — so it is stated for the record and never
   * counted against the package. It is filed against the reading it disagrees
   * with, so the inspector opens the sheet and settles it.
   */
  static readonly DECLARED_VALUE_MISMATCH = new IssueKind(
    'DeclaredValueMismatch',
  );
  /*
   * A file was sent in for a particular hole in the package and turned out to
   * be a different paper.
   *
   * Not EXTRA_DOCUMENT, which is a paper that simply arrived: this one was sent
   * in answer to something the package said it was short of, and the answer
   * does not fit. An operator who asked to replace an unreadable technical
   * passport and attached the payment receipt has to be told that, and told it
   * plainly — the alternative is the file being taken in as one more document
   * and the hole staying open with nothing said about why (COMM-80).
   *
   * Held against the package, unlike EXTRA_DOCUMENT: the gap it was sent for is
   * still open, and the operator has a thing left to do.
   */
  static readonly WRONG_DOCUMENT_SUPPLIED = new IssueKind(
    'WrongDocumentSupplied',
  );

  private constructor(public readonly value: string) {}

  static get all(): readonly IssueKind[] {
    return [
      IssueKind.MISSING_DOCUMENT,
      IssueKind.UNREADABLE_DOCUMENT,
      IssueKind.LOW_CONFIDENCE,
      IssueKind.FIELD_MISMATCH,
      IssueKind.REGISTRY_MISMATCH,
      IssueKind.REGISTRY_DOCUMENT_MISSING,
      IssueKind.EXTRA_DOCUMENT,
      IssueKind.DUPLICATE_DOCUMENT,
      IssueKind.REGISTRY_UNCONFIRMED,
      IssueKind.MISSING_ATTESTATION,
      IssueKind.SUPPORTING_DOCUMENTS_REQUIRED,
      IssueKind.DECLARED_VALUE_MISMATCH,
      IssueKind.WRONG_DOCUMENT_SUPPLIED,
    ];
  }

  // Stated for the record, not against the package: a report carrying nothing
  // else still reads OK, because nothing here is a shortfall the inspector has
  // to resolve before registering. The supporting documents are here for a
  // slightly different reason than the rest — they are not a finding about the
  // package at all — but the rule they need is the same one: absence of data is
  // not a violation (ADR-0013). A declared value the papers contradict is here
  // for a third reason: the applicant is not answerable for what the office
  // typed about their case, and scoring the package down for it would hold them
  // to it.
  get isInformational(): boolean {
    return (
      this.equals(IssueKind.EXTRA_DOCUMENT) ||
      this.equals(IssueKind.DUPLICATE_DOCUMENT) ||
      this.equals(IssueKind.REGISTRY_UNCONFIRMED) ||
      this.equals(IssueKind.SUPPORTING_DOCUMENTS_REQUIRED) ||
      this.equals(IssueKind.DECLARED_VALUE_MISMATCH)
    );
  }

  static of(raw: string): IssueKind {
    const found = IssueKind.all.find(candidate => candidate.value === raw);

    if (!found) throw new InvalidIssueKindException(raw);

    return found;
  }

  // A shortfall in the package itself, not in how well it was read: the
  // inspector is being told a document is absent, which is what makes the
  // whole package incomplete.
  get leavesPackageIncomplete(): boolean {
    return this.equals(IssueKind.MISSING_DOCUMENT);
  }

  equals(other: IssueKind): boolean {
    return this.value === other.value;
  }
}
