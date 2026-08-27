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
 * One paper the submission rests on, held against what the archive keeps.
 *
 * Two names, because there are two vocabularies. `name` is the register's own
 * word for the kind of paper — "Ərizə", "Sərəncam çıxarışı" — and the only one
 * it can look anything up by. `carried` is the document of this package that
 * answers to it, so a finding lands on a sheet the inspector can open.
 *
 * `Unknown` is neither held nor missing and is the ordinary case: the archive's
 * presence registers are kept per settlement and their columns differ, so a
 * kind that area never recorded is silence. Only `NotHeld` is a finding.
 */
export class RegistryDocument {
  private constructor(
    public readonly name: string,
    public readonly holding: 'Held' | 'NotHeld' | 'Unknown',
    public readonly carried: CheckedValue,
    // What the archive's own entry says about the paper, where it says
    // anything, and where that paper is.
    public readonly recordedNumber: string | null,
    public readonly recordedDate: string | null,
    public readonly reference: string | null,
  ) {}

  static of(state: {
    name: string;
    holding: 'Held' | 'NotHeld' | 'Unknown';
    carried: CheckedValue;
    recordedNumber?: string | null;
    recordedDate?: string | null;
    reference?: string | null;
  }): RegistryDocument {
    return new RegistryDocument(
      state.name,
      state.holding,
      state.carried,
      state.recordedNumber ?? null,
      state.recordedDate ?? null,
      state.reference ?? null,
    );
  }

  get isHeld(): boolean {
    return this.holding === 'Held';
  }

  // The register said it is not in the file. Silence does not count: a column
  // the area never kept is not a paper the archive lost.
  get isMissing(): boolean {
    return this.holding === 'NotHeld';
  }

  get isSilent(): boolean {
    return this.holding === 'Unknown';
  }

  get cited(): string {
    return `"${this.name}" (${this.carried.documentType.value})`;
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
  readonly #documents: readonly RegistryDocument[];

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
    documents: readonly RegistryDocument[],
  ) {
    this.#attributes = [...attributes];
    this.#documents = [...documents];
  }

  static of(state: {
    key: RegistryCheckKey;
    outcome: RegistryOutcome;
    confidence: Confidence;
    note: string;
    asked: CheckedValue;
    reference?: string | null;
    attributes?: readonly RegistryAttribute[];
    documents?: readonly RegistryDocument[];
  }): RegistryCheck {
    return new RegistryCheck(
      state.key,
      state.outcome,
      state.confidence,
      state.note.trim(),
      state.asked,
      state.reference ?? null,
      state.attributes ?? [],
      state.documents ?? [],
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
    documents: readonly RegistryDocument[];
  }): RegistryCheck {
    return RegistryCheck.of(state);
  }

  get attributes(): readonly RegistryAttribute[] {
    return this.#attributes;
  }

  get documents(): readonly RegistryDocument[] {
    return this.#documents;
  }

  get contradicts(): boolean {
    return this.outcome.contradicts;
  }

  get isShortOfPaper(): boolean {
    return this.outcome.isShortOfPaper;
  }

  // Only the papers the register said are not in the file. One it is silent
  // about is not among them, for the reason RegistryDocument says.
  get missing(): readonly RegistryDocument[] {
    return this.#documents.filter(document => document.isMissing);
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
