import { InvalidRegistryCheckKeyException } from '../exceptions/index.js';

import type { Confidence } from './confidence.vo.js';
import type { CheckedValue } from './cross-check.vo.js';
import type { RegistryOutcome } from './registry-outcome.vo.js';

export class RegistryCheckKey {
  static readonly MAX_LENGTH = 64;

  private constructor(public readonly value: string) {}

  static create(raw: string): RegistryCheckKey {
    const trimmed = raw.trim();

    if (trimmed.length === 0) {
      throw new InvalidRegistryCheckKeyException('empty');
    }
    if (trimmed.length > RegistryCheckKey.MAX_LENGTH) {
      throw new InvalidRegistryCheckKeyException('too_long');
    }

    return new RegistryCheckKey(trimmed);
  }

  equals(other: RegistryCheckKey): boolean {
    return this.value === other.value;
  }
}

/**
 * One thing the package said about the property, held against what the record
 * says. `recorded` is null where the register is silent — half the registers
 * carry a column the other half never had, and a column an area's register
 * never held is silence, not a disagreement.
 */
export class RegistryAttribute {
  private constructor(
    public readonly name: string,
    public readonly agrees: boolean,
    public readonly submitted: CheckedValue,
    public readonly recorded: string | null,
  ) {}

  static of(state: {
    name: string;
    agrees: boolean;
    submitted: CheckedValue;
    recorded: string | null;
  }): RegistryAttribute {
    return new RegistryAttribute(
      state.name,
      state.agrees,
      state.submitted,
      state.recorded,
    );
  }

  get isSilent(): boolean {
    return this.recorded === null;
  }

  get differs(): boolean {
    return !this.isSilent && !this.agrees;
  }

  get cited(): string {
    return (
      `${this.name} ${this.submitted.cited} against ` +
      `${this.recorded === null ? 'nothing on record' : `"${this.recorded}"`}`
    );
  }
}

/**
 * What the register stage recorded for one of the profile's registry checks:
 * what was asked, what came back, and every attribute that was held against the
 * record.
 *
 * Kept whole rather than reduced to its findings, for the same reason a
 * cross-check is: a property the register confirmed is what the inspector does
 * not have to look up, and the archive locator on a confirmed record is where
 * they go if they want to.
 */
export class RegistryCheck {
  readonly #attributes: readonly RegistryAttribute[];

  private constructor(
    public readonly key: RegistryCheckKey,
    public readonly outcome: RegistryOutcome,
    public readonly confidence: Confidence,
    public readonly note: string,
    // What the package offered the register — the address, and the document it
    // was read off, so a finding lands on a sheet the inspector can open.
    public readonly asked: CheckedValue,
    // Where the paper is, when the register said. Folder and page as strings:
    // "01-dən 30" is a real value and casting it to a number loses it.
    public readonly reference: string | null,
    attributes: readonly RegistryAttribute[],
  ) {
    this.#attributes = [...attributes];
  }

  static of(state: {
    key: RegistryCheckKey;
    outcome: RegistryOutcome;
    confidence: Confidence;
    note: string;
    asked: CheckedValue;
    reference?: string | null;
    attributes?: readonly RegistryAttribute[];
  }): RegistryCheck {
    return new RegistryCheck(
      state.key,
      state.outcome,
      state.confidence,
      state.note.trim(),
      state.asked,
      state.reference ?? null,
      state.attributes ?? [],
    );
  }

  static restore(state: {
    key: RegistryCheckKey;
    outcome: RegistryOutcome;
    confidence: Confidence;
    note: string;
    asked: CheckedValue;
    reference: string | null;
    attributes: readonly RegistryAttribute[];
  }): RegistryCheck {
    return RegistryCheck.of(state);
  }

  get attributes(): readonly RegistryAttribute[] {
    return this.#attributes;
  }

  get contradicts(): boolean {
    return this.outcome.contradicts;
  }

  get needsInspector(): boolean {
    return this.outcome.needsInspector;
  }

  // Only what the record actually disagreed with. A field it is silent about is
  // not part of the finding, because there is nothing to disagree with.
  get differing(): readonly RegistryAttribute[] {
    return this.#attributes.filter(attribute => attribute.differs);
  }

  get cited(): string {
    return this.differing.map(attribute => attribute.cited).join(', ');
  }
}
