/** The lifecycle states of a Verification Package. */
export const PackageStatus = {
  Created: "Created",
  Processing: "Processing",
  Completed: "Completed",
  Failed: "Failed",
} as const;

export type PackageStatus = (typeof PackageStatus)[keyof typeof PackageStatus];
