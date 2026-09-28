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

// Where a figure came from: a line of a paper, the counter, the kind of title
// document the package carries — a state act confers ownership whatever it says
// — or an operator, who overrules all three.
export const ParameterSourceSchema = z.enum([
  'ReadOffDocument',
  'DeclaredAtIntake',
  'TitleDocumentType',
  /*
   * Set by an operator over what the papers were read to say (COMM-193). The
   * case is then decided on their figure and on nothing else: an override is a
   * person taking responsibility for it, the same as a corrected field.
   *
   * What the engine made of the papers is not lost — it is published beside the
   * override in `read`, so a card can say "read X, operator set Y" and offer to
   * put it back. Reverting is clearing the override, never writing the old
   * figure back over it.
   */
  'StatedByOperator',
]);
export type ParameterSource = z.infer<typeof ParameterSourceSchema>;

// The two classes of right the acceptance contract tells apart. A lease and a
// right of use are one answer.
export const LandRightSchema = z.enum(['Ownership', 'LeaseOrUse']);
export type LandRight = z.infer<typeof LandRightSchema>;

export const LandPurposeSchema = z.enum(['Residential', 'Other']);
export type LandPurpose = z.infer<typeof LandPurposeSchema>;
