import { z } from 'zod';

/**
 * What one of the archive's sources has in the register.
 *
 * `id` is the source as the register's own catalogue of archive registers
 * names it — `EMDK`, `Hovsan`, `Pasbaza`. A register holding rows under a name
 * the catalogue does not carry states that name instead of hiding the rows:
 * every record the register holds is under exactly one of these lines, so the
 * lines add up to the total and a reader can see what they add up from.
 */
export const RegistrySourceSummaryDtoSchema = z.object({
  id: z.string(),
  // Records read out of this source. Zero for a catalogued source nothing was
  // ever loaded from — which is a source with no records and not an absent
  // one, and the difference is the whole question the sidebar asks.
  records: z.number().int().nonnegative(),
  // ISO-8601, or null where the source holds nothing.
  loadedAt: z.string().nullable(),
});
export type RegistrySourceSummaryDto = z.infer<
  typeof RegistrySourceSummaryDtoSchema
>;

/**
 * How much of the archive the register is holding, and since when.
 *
 * Facts and no verdict, for the same reason a lookup carries none: there is no
 * "ready" or "loaded" here, because how many of six archive registers have to
 * be in before an answer means anything is the caller's rule and not the
 * register's (ADR-0009). The register says what it has; a screen that wants to
 * call four out of six "partial" is welcome to.
 *
 * Distinct from `GET /health`, which says the process is answering and stays
 * that cheap: a register that is up with an empty database and one that is up
 * with the whole archive in it are the same health check and different answers
 * here.
 */
export const RegistrySummaryResponseSchema = z.object({
  // Sources that actually hold at least one record — never the size of the
  // catalogue, which is how many the archive keeps rather than how many
  // arrived.
  sources: z.number().int().nonnegative(),
  // Every record the register holds, over all sources.
  records: z.number().int().nonnegative(),
  // The most recent load, over all sources. ISO-8601, or null on an empty
  // register.
  loadedAt: z.string().nullable(),
  // One line per source: every source the register holds rows under, plus
  // every source its catalogue knows about and holds nothing from.
  bySource: z.array(RegistrySourceSummaryDtoSchema),
});
export type RegistrySummaryResponse = z.infer<
  typeof RegistrySummaryResponseSchema
>;
