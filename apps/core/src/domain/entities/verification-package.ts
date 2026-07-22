import { PackageStatus } from "../value-objects/package-status.js";
import { VerificationReport } from "../value-objects/verification-report.js";

/**
 * Verification Package — aggregate root.
 *
 * A set of files uploaded together for one verification; the unit an Inspector
 * works with. Owns the package lifecycle (Created → Processing →
 * Completed/Failed) and, once completed, the Verification Report. Member
 * Documents are a separate aggregate, referenced by id only.
 *
 * Plain class for now; intended to later extend NestJS CQRS `AggregateRoot`.
 */
export class VerificationPackage {
  private _status: PackageStatus = PackageStatus.Created;
  private _report?: VerificationReport;

  constructor(
    public readonly id: string,
    public readonly documentIds: readonly string[],
    public readonly createdAt: Date = new Date(),
  ) {
    if (documentIds.length === 0) {
      throw new Error("A Verification Package must contain at least one Document.");
    }
    if (new Set(documentIds).size !== documentIds.length) {
      throw new Error("A Verification Package cannot contain duplicate Document ids.");
    }
  }

  get status(): PackageStatus {
    return this._status;
  }

  get report(): VerificationReport | undefined {
    return this._report;
  }

  /** Created → Processing. */
  startProcessing(): void {
    if (this._status !== PackageStatus.Created) {
      throw new Error(`Cannot start processing a package in status ${this._status}.`);
    }
    this._status = PackageStatus.Processing;
  }

  /** Processing → Completed. A completed package always carries a report. */
  complete(report: VerificationReport): void {
    if (this._status !== PackageStatus.Processing) {
      throw new Error(`Cannot complete a package in status ${this._status}.`);
    }
    this._report = report;
    this._status = PackageStatus.Completed;
  }

  /** Processing → Failed. Terminal. */
  fail(_reason?: string): void {
    if (this._status !== PackageStatus.Processing) {
      throw new Error(`Cannot fail a package in status ${this._status}.`);
    }
    this._status = PackageStatus.Failed;
  }
}
