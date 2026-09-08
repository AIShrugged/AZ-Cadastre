import { InvalidPackageStatusException } from '../exceptions/index.js';

export class PackageStatus {
  static readonly PENDING = new PackageStatus('Pending');
  static readonly PROCESSING = new PackageStatus('Processing');
  static readonly COMPLETED = new PackageStatus('Completed');
  static readonly FAILED = new PackageStatus('Failed');

  private constructor(public readonly value: string) {}

  static get all(): readonly PackageStatus[] {
    return [
      PackageStatus.PENDING,
      PackageStatus.PROCESSING,
      PackageStatus.COMPLETED,
      PackageStatus.FAILED,
    ];
  }

  static of(raw: string): PackageStatus {
    const found = PackageStatus.all.find(candidate => candidate.value === raw);

    if (!found) throw new InvalidPackageStatusException(raw);

    return found;
  }

  get canStart(): boolean {
    return (
      this.equals(PackageStatus.PENDING) || this.equals(PackageStatus.FAILED)
    );
  }

  /*
   * Whether the package takes more files. Only a run under way refuses: the
   * pipeline reads the list of files it started with, so a file added now would
   * reach no stage of it, and the report the run is about to compile would
   * describe a package that is no longer the one on file (ADR-0013).
   */
  get takesMoreFiles(): boolean {
    return !this.equals(PackageStatus.PROCESSING);
  }

  get isUnderWay(): boolean {
    return this.equals(PackageStatus.PROCESSING);
  }

  get isTerminal(): boolean {
    return (
      this.equals(PackageStatus.COMPLETED) || this.equals(PackageStatus.FAILED)
    );
  }

  equals(other: PackageStatus): boolean {
    return this.value === other.value;
  }
}
