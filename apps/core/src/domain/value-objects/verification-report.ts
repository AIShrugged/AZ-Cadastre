import { Verdict } from "./verdict.js";

/**
 * Verification Report — the final structured output held by a completed
 * Package.
 *
 * Placeholder shape for now: it carries the overall verdict. Detected
 * documents, extracted fields and Validation Issues — and the factory that
 * derives-and-checks the verdict from them — land with the validation engine
 * (next spec).
 */
export class VerificationReport {
  private constructor(public readonly verdict: Verdict) {}

  static of(verdict: Verdict): VerificationReport {
    return new VerificationReport(verdict);
  }
}
