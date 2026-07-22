/** The overall verdict of a Verification Report. */
export const Verdict = {
  OK: "OK",
  IssuesFound: "IssuesFound",
  IncompletePackage: "IncompletePackage",
} as const;

export type Verdict = (typeof Verdict)[keyof typeof Verdict];
