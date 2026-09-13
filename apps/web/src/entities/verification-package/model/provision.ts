/**
 * The provision of Article 8 a package's case falls under, read off the contract.
 *
 * The server decides it and publishes it on every read (ADR-0025); nothing here
 * decides anything. What lives with the entity is the one sentence every surface
 * states it in — the intake screen, the case sheet and the fold behind it — so
 * that "falls under 8.0.10.2" is not said three ways on three screens.
 */
import type { CaseProvisionDto } from '@cadastre/api-contracts/verification';

/** The `t` from `useI18n`. */
type Translate = (
  key: string,
  params?: Record<string, string | number>,
) => string;

/**
 * What the table made of the case, in one line.
 *
 * Three sentences and not a provision-or-dash: a case whose height nobody read
 * could still be one of two provisions, and a case no row covers is one the Law
 * does not register this way. Drawing either as a blank would read as "not
 * worked out yet".
 */
export function provisionSummary(
  t: Translate,
  provision: CaseProvisionDto,
): string {
  switch (provision.outcome) {
    case 'Determined':
      return t('provision.determined', {
        provision: provision.provision ?? '',
      });
    case 'Ambiguous':
      return t('provision.ambiguous', {
        list: provision.candidates.join(', '),
      });
    case 'Undetermined':
      return t('provision.undetermined');
  }
}

/**
 * The papers of a group any one of which answers it, where the decided
 * provision is still short of such a group.
 *
 * A `MissingDocument` finding names no type when any of several papers would
 * answer it (ADR-0025), so a screen naming it reads the alternatives off the
 * provision the report was compiled on rather than off the audit line.
 */
export function unansweredAlternatives(
  provision: CaseProvisionDto | null,
): readonly string[] {
  if (provision?.outcome !== 'Determined') return [];

  const group = provision.provisions[0]?.requirements.find(
    requirement =>
      requirement.applies === true &&
      !requirement.answered &&
      requirement.anyOf.length > 1,
  );

  return group?.anyOf ?? [];
}
