import { z } from 'zod';

// What a profile suggestion was decided on: one member per figure the office
// declares at intake.
//
// Published rather than left to the wording of the note, so an intake screen
// can put each line beside the field it is about instead of parsing an English
// sentence to find out which one it means.
export const SuggestionCriterionSchema = z.enum(['legalBasis', 'builtYear']);
export type SuggestionCriterion = z.infer<typeof SuggestionCriterionSchema>;
