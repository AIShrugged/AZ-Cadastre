import { ReportStatus } from "./report-status.vo.js";
import type { ValidationIssue } from "./validation-issue.vo.js";

// What the run hands the inspector: every problem it met, and the one word
// that sums them up. It states findings and never refuses a package — the
// decision is the inspector's.
export class VerificationReport {
  readonly #issues: readonly ValidationIssue[];

  private constructor(
    public readonly status: ReportStatus,
    issues: readonly ValidationIssue[],
  ) {
    this.#issues = [...issues];
  }

  static of(issues: readonly ValidationIssue[]): VerificationReport {
    return new VerificationReport(VerificationReport.statusOf(issues), issues);
  }

  static restore(
    status: ReportStatus,
    issues: readonly ValidationIssue[],
  ): VerificationReport {
    return new VerificationReport(status, issues);
  }

  private static statusOf(issues: readonly ValidationIssue[]): ReportStatus {
    if (issues.some((issue) => issue.kind.leavesPackageIncomplete)) {
      return ReportStatus.INCOMPLETE_PACKAGE;
    }

    return issues.length === 0 ? ReportStatus.OK : ReportStatus.ISSUES_FOUND;
  }

  get issues(): readonly ValidationIssue[] {
    return this.#issues;
  }

  get isClean(): boolean {
    return this.#issues.length === 0;
  }
}
