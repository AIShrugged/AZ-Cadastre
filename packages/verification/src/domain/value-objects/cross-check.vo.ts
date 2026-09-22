import {
  CrossCheckMustCompareTwoDocumentsException,
  InvalidCrossCheckKeyException,
} from '../exceptions/index.js';

import type { Confidence } from './confidence.vo.js';
import type { CrossCheckVerdict } from './cross-check-verdict.vo.js';
import type { DocumentType } from './document-type.vo.js';
import type { DocumentId } from './entity-ids/index.js';
import type { FieldKey, FieldValue } from './field.vo.js';
import type { PageNumber } from './page-number.vo.js';

export class CrossCheckKey {
  static readonly MAX_LENGTH = 64;

  private constructor(public readonly value: string) {}

  static create(raw: string): CrossCheckKey {
    const trimmed = raw.trim();

    if (trimmed.length === 0) throw new InvalidCrossCheckKeyException('empty');
    if (trimmed.length > CrossCheckKey.MAX_LENGTH) {
      throw new InvalidCrossCheckKeyException('too_long');
    }

    return new CrossCheckKey(trimmed);
  }

  equals(other: CrossCheckKey): boolean {
    return this.value === other.value;
  }
}

// One value a check was made over, with the document it was read off and the
// sheet it sits on. A disagreement is only useful if the inspector can turn to
// both sides of it, so provenance travels with every value compared.
export class CheckedValue {
  private constructor(
    public readonly documentId: DocumentId,
    public readonly documentType: DocumentType,
    public readonly fieldKey: FieldKey,
    public readonly value: FieldValue,
    public readonly foundOn: PageNumber,
    public readonly confidence: Confidence,
  ) {}

  static of(state: {
    documentId: DocumentId;
    documentType: DocumentType;
    fieldKey: FieldKey;
    value: FieldValue;
    foundOn: PageNumber;
    confidence: Confidence;
  }): CheckedValue {
    return new CheckedValue(
      state.documentId,
      state.documentType,
      state.fieldKey,
      state.value,
      state.foundOn,
      state.confidence,
    );
  }

  // The audit line's way of naming this value, written once in English.
  get cited(): string {
    return (
      `${this.documentType.value}.${this.fieldKey.value} ` +
      `"${this.value.value}" (p.${this.foundOn.value})`
    );
  }

  isFrom(documentId: DocumentId): boolean {
    return this.documentId.equals(documentId);
  }
}

// What the cross-document stage recorded for one of the profile's checks: the
// verdict, how sure it is, the line it wrote about it, and every value it
// weighed. Kept whole rather than reduced to a finding, because a check that
// agreed is evidence too — it is what the inspector does not have to redo.
export class CrossCheck {
  readonly #values: readonly CheckedValue[];

  private constructor(
    public readonly key: CrossCheckKey,
    public readonly verdict: CrossCheckVerdict,
    public readonly confidence: Confidence,
    public readonly note: string,
    values: readonly CheckedValue[],
    // Whether the package has moved on under it. A check made over readings a
    // correction has since changed is still evidence — it is what the
    // inspector was last told — but it is no longer an answer about the
    // package as it now stands (ADR-0036).
    public readonly isOutrun: boolean = false,
  ) {
    this.#values = [...values];
  }

  static of(state: {
    key: CrossCheckKey;
    verdict: CrossCheckVerdict;
    confidence: Confidence;
    note: string;
    values: readonly CheckedValue[];
  }): CrossCheck {
    if (CrossCheck.documentsIn(state.values) < 2) {
      throw new CrossCheckMustCompareTwoDocumentsException(state.key.value);
    }

    return new CrossCheck(
      state.key,
      state.verdict,
      state.confidence,
      state.note.trim(),
      state.values,
    );
  }

  // Restored from storage, where a document a later run removed may have taken
  // its value with it. A stored check is history and is never re-guarded.
  static restore(state: {
    key: CrossCheckKey;
    verdict: CrossCheckVerdict;
    confidence: Confidence;
    note: string;
    values: readonly CheckedValue[];
    isOutrun?: boolean;
  }): CrossCheck {
    return new CrossCheck(
      state.key,
      state.verdict,
      state.confidence,
      state.note,
      state.values,
      state.isOutrun ?? false,
    );
  }

  /*
   * The same verdict, marked as one the package has outrun.
   *
   * The verdict itself is untouched on purpose: a correction must not blank
   * the checklist an operator is looking at, so what the last run concluded
   * stays readable until the next run replaces it (ADR-0036). What the mark
   * changes is that the package no longer counts this check as made, so the
   * run that follows makes it again.
   */
  outrun(): CrossCheck {
    return new CrossCheck(
      this.key,
      this.verdict,
      this.confidence,
      this.note,
      this.#values,
      true,
    );
  }

  private static documentsIn(values: readonly CheckedValue[]): number {
    return new Set(values.map(value => value.documentId.value)).size;
  }

  get values(): readonly CheckedValue[] {
    return this.#values;
  }

  get agrees(): boolean {
    return this.verdict.agrees;
  }

  get needsInspector(): boolean {
    return this.verdict.needsInspector;
  }

  // Where the finding is filed: the first value the check weighed, which is the
  // one the profile named first — the identity document rather than whatever
  // was compared against it.
  get anchor(): CheckedValue | null {
    return this.#values[0] ?? null;
  }

  get cited(): string {
    return this.#values.map(value => value.cited).join(', ');
  }
}
