import { z } from "zod";

// The verification outcome, which is not the pipeline lifecycle
// (`PackageStatus`): a run that reached the end is Completed either way, and
// this says what it found.
export const ReportStatusSchema = z.enum([
  "OK",
  "IssuesFound",
  "IncompletePackage",
]);
export type ReportStatus = z.infer<typeof ReportStatusSchema>;
