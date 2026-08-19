import { InvalidIssueKindException } from '../exceptions/index.js';

export class IssueKind {
  static readonly MISSING_DOCUMENT = new IssueKind('MissingDocument');
  static readonly UNREADABLE_DOCUMENT = new IssueKind('UnreadableDocument');
  static readonly LOW_CONFIDENCE = new IssueKind('LowConfidence');
  // Two documents of the same submission were asked to agree on a value the
  // profile says must be one value — the name on the identity card against the
  // name the application is made in — and they were not shown to agree.
  static readonly FIELD_MISMATCH = new IssueKind('FieldMismatch');
  // A document the package carries that the profile does not ask for, and a
  // required type that two documents answer to at once. Neither is a fault:
  // packages arrive with the registry's own service sheets in them, and a title
  // can rest on a chain of two acts. They are told to the inspector because
  // only the inspector can say whether this one matters.
  static readonly EXTRA_DOCUMENT = new IssueKind('ExtraDocument');
  static readonly DUPLICATE_DOCUMENT = new IssueKind('DuplicateDocument');

  private constructor(public readonly value: string) {}

  static get all(): readonly IssueKind[] {
    return [
      IssueKind.MISSING_DOCUMENT,
      IssueKind.UNREADABLE_DOCUMENT,
      IssueKind.LOW_CONFIDENCE,
      IssueKind.FIELD_MISMATCH,
      IssueKind.EXTRA_DOCUMENT,
      IssueKind.DUPLICATE_DOCUMENT,
    ];
  }

  // Stated for the record, not against the package: a report carrying nothing
  // else still reads OK, because nothing here is a shortfall the inspector has
  // to resolve before registering.
  get isInformational(): boolean {
    return (
      this.equals(IssueKind.EXTRA_DOCUMENT) ||
      this.equals(IssueKind.DUPLICATE_DOCUMENT)
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
