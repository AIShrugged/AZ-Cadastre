import { InvalidRegistryOutcomeException } from '../exceptions/index.js';

/**
 * What the archive register said when it was asked about the property this
 * package is for.
 *
 * It is an answer about the register's own holdings, never about the package.
 * The register's coverage is partial and historical — it is the record of the
 * privatisations of the 1990s and 2000s, not a list of everything that exists —
 * so "no record" is an absence of evidence and is told to the inspector rather
 * than held against the submission.
 */
export class RegistryOutcome {
  static readonly CONFIRMED = new RegistryOutcome('Confirmed');
  // A record was found and something the package states is not what it holds.
  static readonly DIFFERS = new RegistryOutcome('Differs');
  // A record was found, everything held against it agreed, and the archive does
  // not hold one of the papers the submission rests on. Its own answer and not
  // a flavour of DIFFERS: the record does not contradict the package — the file
  // behind it is short, which for a Decree 439 title is the question rather
  // than a footnote (ADR-0010).
  static readonly INCOMPLETE = new RegistryOutcome('Incomplete');
  static readonly NOT_FOUND = new RegistryOutcome('NotFound');
  // More than one record answers to the property. Somebody has to say which,
  // and it is not the engine.
  static readonly AMBIGUOUS = new RegistryOutcome('Ambiguous');

  private constructor(public readonly value: string) {}

  static get all(): readonly RegistryOutcome[] {
    return [
      RegistryOutcome.CONFIRMED,
      RegistryOutcome.DIFFERS,
      RegistryOutcome.INCOMPLETE,
      RegistryOutcome.NOT_FOUND,
      RegistryOutcome.AMBIGUOUS,
    ];
  }

  static of(raw: string): RegistryOutcome {
    const found = RegistryOutcome.all.find(
      candidate => candidate.value === raw,
    );

    if (!found) throw new InvalidRegistryOutcomeException(raw);

    return found;
  }

  get confirms(): boolean {
    return this.equals(RegistryOutcome.CONFIRMED);
  }

  // The one outcome that is a finding against the package: the record exists
  // and says something else.
  get contradicts(): boolean {
    return this.equals(RegistryOutcome.DIFFERS);
  }

  // The other finding against the package, and a different one: the record
  // agrees, and the archive does not hold a paper the submission rests on.
  get isShortOfPaper(): boolean {
    return this.equals(RegistryOutcome.INCOMPLETE);
  }

  // Anything but a confirmation reaches the inspector — but only a
  // contradiction and a missing original reach them as a fault.
  get needsInspector(): boolean {
    return !this.confirms;
  }

  equals(other: RegistryOutcome): boolean {
    return this.value === other.value;
  }
}
