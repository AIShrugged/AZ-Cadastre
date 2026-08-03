import { InvalidReportStatusException } from "../exceptions/index.js";

// The verification outcome, which is not the pipeline lifecycle: a run that
// reached the end reports Completed either way, and this says what it found.
export class ReportStatus {
  static readonly OK = new ReportStatus("OK");
  static readonly ISSUES_FOUND = new ReportStatus("IssuesFound");
  static readonly INCOMPLETE_PACKAGE = new ReportStatus("IncompletePackage");

  private constructor(public readonly value: string) {}

  static get all(): readonly ReportStatus[] {
    return [
      ReportStatus.OK,
      ReportStatus.ISSUES_FOUND,
      ReportStatus.INCOMPLETE_PACKAGE,
    ];
  }

  static of(raw: string): ReportStatus {
    const found = ReportStatus.all.find((candidate) => candidate.value === raw);

    if (!found) throw new InvalidReportStatusException(raw);

    return found;
  }

  equals(other: ReportStatus): boolean {
    return this.value === other.value;
  }
}
