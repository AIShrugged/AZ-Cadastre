import { InvalidIssueKindException } from "../exceptions/index.js";

export class IssueKind {
  static readonly MISSING_DOCUMENT = new IssueKind("MissingDocument");
  static readonly UNREADABLE_DOCUMENT = new IssueKind("UnreadableDocument");
  static readonly LOW_CONFIDENCE = new IssueKind("LowConfidence");

  private constructor(public readonly value: string) {}

  static get all(): readonly IssueKind[] {
    return [
      IssueKind.MISSING_DOCUMENT,
      IssueKind.UNREADABLE_DOCUMENT,
      IssueKind.LOW_CONFIDENCE,
    ];
  }

  static of(raw: string): IssueKind {
    const found = IssueKind.all.find((candidate) => candidate.value === raw);

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
