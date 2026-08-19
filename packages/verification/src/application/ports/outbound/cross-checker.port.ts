import type {
  CheckedValue,
  Confidence,
  CrossCheckSpec,
  CrossCheckVerdict,
} from "../../../domain/value-objects/index.js";

export type CrossCheckRequest = {
  // What is being compared and what counts as agreement. The rule is the
  // profile's, not the reader's: the reader is only asked to apply it.
  spec: CrossCheckSpec;
  // Every value the package offers for that rule, each naming the document it
  // was read off and how well it was read.
  values: readonly CheckedValue[];
};

export type CrossCheckAnswer = {
  verdict: CrossCheckVerdict;
  confidence: Confidence;
  // One line of English for the audit trail, saying why. Never translated, and
  // never the only thing that carries the finding.
  note: string;
};

export abstract class CrossChecker {
  abstract check(request: CrossCheckRequest): Promise<CrossCheckAnswer>;
}
