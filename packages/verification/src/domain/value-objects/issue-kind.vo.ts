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
    ];
  }

  // Stated for the record, not against the package: a report carrying nothing
  // else still reads OK, because nothing here is a shortfall the inspector has
  // to resolve before registering.
  get isInformational(): boolean {
    return (
      this.equals(IssueKind.EXTRA_DOCUMENT) ||
      this.equals(IssueKind.DUPLICATE_DOCUMENT) ||
      this.equals(IssueKind.REGISTRY_UNCONFIRMED)
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
