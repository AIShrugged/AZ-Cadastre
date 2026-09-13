import { z } from 'zod';

// What the Article 8 decision table made of a case (ADR-0025). Three answers and
// not a provision-or-null: an unread figure leaves several provisions open and
// the report names them, while a case no row covers is a case the Law does not
// register this way.
export const ProvisionOutcomeSchema = z.enum([
  'Determined',
  'Ambiguous',
  'Undetermined',
]);
export type ProvisionOutcome = z.infer<typeof ProvisionOutcomeSchema>;

// The six figures the table decides on, in the order its columns are printed.
export const CaseParameterSchema = z.enum([
  'builtYear',
  'storeys',
  'height',
  'span',
  'landRight',
  'purpose',
]);
export type CaseParameter = z.infer<typeof CaseParameterSchema>;

// Where a figure came from: a line of a paper, the counter, or the kind of title
// document the package carries — a state act confers ownership whatever it says.
export const ParameterSourceSchema = z.enum([
  'ReadOffDocument',
  'DeclaredAtIntake',
  'TitleDocumentType',
]);
export type ParameterSource = z.infer<typeof ParameterSourceSchema>;

// The two classes of right the acceptance contract tells apart. A lease and a
// right of use are one answer.
export const LandRightSchema = z.enum(['Ownership', 'LeaseOrUse']);
export type LandRight = z.infer<typeof LandRightSchema>;

export const LandPurposeSchema = z.enum(['Residential', 'Other']);
export type LandPurpose = z.infer<typeof LandPurposeSchema>;
