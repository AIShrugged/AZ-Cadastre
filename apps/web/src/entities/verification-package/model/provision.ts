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
    case 'Determined': {
      const code = provision.provision ?? '';
      return t('provision.determined', {
        provision: code,
        rule: lowerFirst(
          translated(
            t,
            `provision.rule.${code}`,
            provision.provisions[0]?.description ?? '',
          ),
        ),
      });
    }
    // Says what is missing rather than which codes are left. "Could be
    // 8.0.9.1.1, 8.0.9.1.2, 8.0.9.2 …" named five sections of a decree nobody
    // has open at the desk, and told the inspector nothing they could do; the
    // figures that would settle it are the thing to go and find.
    case 'Ambiguous': {
      const names = provision.undecidedOn.map(parameter =>
        lowerFirst(
          // "Height, m" is a column heading; in a sentence it is "height".
          t(`provision.param.${parameter}`).replace(/,\s*(м|m)$/u, ''),
        ),
      );
      if (names.length === 0) return t('provision.ambiguous_open');
      const params =
        names.length <= 3
          ? names.join(', ')
          : `${names.slice(0, 2).join(', ')} ${t('provision.and_more', {
              n: names.length - 2,
            })}`;
      return t('provision.ambiguous', { params });
    }
    case 'Undetermined':
      return t('provision.undetermined');
  }
}

/**
 * A provision in a few plain words — "Before 2013 · up to 12 m · lease" — for
 * where its code alone would be the only label, such as a table column. The
 * code stays beside it: it is what the decree and the inspector's colleagues
 * call it. A provision this build has no words for is named by its code.
 */
export function provisionName(t: Translate, code: string): string {
  return translated(t, `provision.name.${code}`, code);
}

/** The dictionary echoes a key it has no word for; this falls back instead. */
function translated(t: Translate, key: string, fallback: string): string {
  const word = t(key);
  return word === key ? fallback : word;
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLocaleLowerCase() + text.slice(1);
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

/**
 * The provision in the few words a closed fold has room for.
 *
 * `provisionSummary` is the sentence, and it stays on the case sheet and inside
 * the fold. In the fold's own heading it named every candidate — five codes on
 * an open case — and was the line that pushed a phone's page sideways.
 */
export function provisionShort(
  t: Translate,
  provision: CaseProvisionDto,
): string {
  switch (provision.outcome) {
    case 'Determined':
      return t('provision.short.determined', {
        provision: provision.provision ?? '',
      });
    case 'Ambiguous':
      return t('provision.short.ambiguous', {
        n: provision.candidates.length,
      });
    case 'Undetermined':
      return t('provision.short.undetermined');
  }
}
