import { Injectable } from "@nestjs/common";

import {
  CrossChecker,
  type CrossCheckAnswer,
  type CrossCheckRequest,
} from "../../application/ports/index.js";
import {
  type CheckedValue,
  Confidence,
  CrossCheckVerdict,
} from "../../domain/value-objects/index.js";
import { looksLikeTheSameValue } from "./value-agreement.js";

const AGREED_CONFIDENCE = 0.9;
const DISAGREED_CONFIDENCE = 0.85;

// The stand-in for the real reader: it compares what each document said after
// folding away the differences that are spelling rather than substance. It has
// no opinion it is unsure of, so it never answers Unclear.
@Injectable()
export class CrossCheckerAdapter extends CrossChecker {
  async check(request: CrossCheckRequest): Promise<CrossCheckAnswer> {
    const sides = CrossCheckerAdapter.perDocument(request.values);
    const agrees = sides.every((side, index) =>
      sides
        .slice(index + 1)
        .every((other) => looksLikeTheSameValue(side, other)),
    );

    return {
      verdict: agrees ? CrossCheckVerdict.MATCH : CrossCheckVerdict.MISMATCH,
      confidence: Confidence.of(
        agrees ? AGREED_CONFIDENCE : DISAGREED_CONFIDENCE,
      ),
      note: agrees
        ? "Every document states the same value."
        : `The documents state: ${sides.map((side) => `"${side}"`).join(" against ")}.`,
    };
  }

  // One line per document, because a document is one side of the comparison:
  // the identity card's surname and given name are two fields of a single
  // statement about a single person, not two statements to hold against each
  // other.
  private static perDocument(values: readonly CheckedValue[]): readonly string[] {
    const sides = new Map<string, string[]>();

    for (const value of values) {
      const said = sides.get(value.documentId.value) ?? [];
      said.push(value.value.value);
      sides.set(value.documentId.value, said);
    }

    return [...sides.values()].map((said) => said.join(" "));
  }
}
