import { InvalidCrossCheckVerdictException } from '../exceptions/index.js';

// What the cross-document stage made of one check. It never says the package is
// wrong — it says whether the values that have to agree were shown to agree.
export class CrossCheckVerdict {
  static readonly MATCH = new CrossCheckVerdict('Match');
  static readonly MISMATCH = new CrossCheckVerdict('Mismatch');
  // The values were read and compared, and the reader could not say either way:
  // a name half lost to a faint scan, an address written two ways that may or
  // may not be one place. Not an agreement, so it goes to the inspector.
  static readonly UNCLEAR = new CrossCheckVerdict('Unclear');

  private constructor(public readonly value: string) {}

  static get all(): readonly CrossCheckVerdict[] {
    return [
      CrossCheckVerdict.MATCH,
      CrossCheckVerdict.MISMATCH,
      CrossCheckVerdict.UNCLEAR,
    ];
  }

  static of(raw: string): CrossCheckVerdict {
    const found = CrossCheckVerdict.all.find(
      candidate => candidate.value === raw,
    );

    if (!found) throw new InvalidCrossCheckVerdictException(raw);

    return found;
  }

  get agrees(): boolean {
    return this.equals(CrossCheckVerdict.MATCH);
  }

  // Anything but an agreement is work for the inspector: a disagreement is a
  // finding, and a check nobody could decide is one they have to decide.
  get needsInspector(): boolean {
    return !this.agrees;
  }

  equals(other: CrossCheckVerdict): boolean {
    return this.value === other.value;
  }
}
