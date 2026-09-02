/**
 * import-registry — loading records into the archive register from an .xlsx
 * workbook: a button, a modal, and the report the register answers with.
 *
 * The register is a system outside this one and its import endpoint is not part
 * of `@cadastre/api-contracts` (ADR-0011 §1), so this feature is the one place
 * in `apps/web` that calls a service other than the core API. Why that was
 * accepted, and what has to change before it is published: TECH_DEBT §10.
 */

export { ImportRegistryButton } from './ui/import-registry-button';
export type {
  ImportProblem,
  ImportedRows,
  RegistryImportReport,
} from './model/types';
