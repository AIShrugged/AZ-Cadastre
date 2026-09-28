/**
 * Why a rule ruled the case out — in the rule's own terms and the package's.
 *
 * The panel used to fold every ruled-out provision into a list of codes and
 * their descriptions, and the in-play column's hint named the failing figures
 * by name. Both said *which* figure decided it and never *what about it*: for
 * 8.0.9.1.2 the reader was given "built before 2013, up to 12 m, land held in
 * ownership and designated for housing" and left to work out which half of that
 * the package had failed. The package's disposal order is a lease-or-use title
 * by its kind (ADR-0030), so the right came out `LeaseOrUse` and the row turns
 * on `Ownership` — that is one sentence, and the reader should not have to
 * assemble it.
 *
 * Both sides are already on the wire and nothing here re-decides anything: the
 * rule's own `expected` says what it asks (COMM-191), and the case's parameter
 * says what the package established. The established side is printed by the
 * same function the figures table prints it with, so the fold and the table can
 * never word one reading two ways.
 *
 * A `Range` is read off its bounds and their inclusivity and never off the
 * parameter's name: the profile is the customer's to change, and a panel that
 * knows "height means ≤" is a panel that lies the day a rule declares a floor
 * for it. `min`/`max` being null is what says a side exists at all; the flag is
 * read only for a side that does.
 */
import { spanPhrase } from '@/entities/verification-package';
import { translateOr } from '@/shared/i18n';
import type {
  CaseParameterDto,
  CaseProvisionDto,
  ConditionExpectationDto,
} from '@cadastre/api-contracts/verification';

/** The `t` from `useI18n`. */
type Translate = (
  key: string,
  vars?: Record<string, string | number>,
) => string;

type ProvisionRule = CaseProvisionDto['rules'][number];

/** What the figures table prints for one figure, as text.
 *
 *  A reading refused is not a reading missing: the words that could not be
 *  understood are what the table shows, and the reason line shows the same. */
export function parameterPhrase(
  t: Translate,
  parameter: CaseParameterDto,
  locale: string,
): string {
  if (parameter.value === null) {
    return parameter.stated === null
      ? t('provision.not_established')
      : t('provision.stated_refused', { stated: parameter.stated });
  }
  // The span says which two axes it lies between: a bare "5.2" is a figure the
  // inspector cannot find on the plan (ADR-0043).
  if (parameter.calculation) {
    return spanPhrase(t, parameter.calculation, locale);
  }
  return typeof parameter.value === 'number'
    ? String(parameter.value)
    : translateOr(t, `provision.value.${parameter.value}`, parameter.value);
}

/**
 * What the engine itself established for a figure, *as* a figure — so the one
 * phrase function words it and the cell can never word a reading two ways.
 *
 * Null where no operator has stated this figure, which is where there is nothing
 * underneath it to show. Where there is, `read.value` may still be null: a
 * parameter no paper ever stated is precisely the cell an override exists for, so
 * the phrase has to come out "not established" rather than assume a figure was
 * displaced (COMM-193).
 */
export function asRead(parameter: CaseParameterDto): CaseParameterDto | null {
  const read = parameter.read;
  if (read === null) return null;

  return { ...parameter, ...read, overriddenBy: null, read: null };
}

/** What the rule asks of one figure, in words. */
export function expectationPhrase(
  t: Translate,
  expected: ConditionExpectationDto,
): string {
  if (expected.kind === 'OneOf') {
    return expected.values
      .map(value => translateOr(t, `provision.value.${value}`, value))
      .join(` ${t('common.or')} `);
  }

  const floor =
    expected.min === null
      ? null
      : t(
          expected.minInclusive
            ? 'provision.cond.at_least'
            : 'provision.cond.more_than',
          { min: expected.min },
        );
  const ceiling =
    expected.max === null
      ? null
      : t(
          expected.maxInclusive
            ? 'provision.cond.at_most'
            : 'provision.cond.less_than',
          { max: expected.max },
        );

  if (floor && ceiling) {
    return t('provision.cond.and', { from: floor, to: ceiling });
  }
  // A condition exists only for a figure the rule turns on, so an open range on
  // both sides is a rule that asks for nothing — said rather than left blank.
  return floor ?? ceiling ?? t('provision.cond.any');
}

/**
 * The conditions of a rule that came out false, each as the one line that names
 * the figure, what the rule required and what the package established.
 *
 * Only `holds === false`. A figure nothing established leaves its condition
 * undecided, and a rule is not ruled out by a figure nobody could read — saying
 * so would send the inspector to correct a reading that does not exist.
 */
export function conditionReasons(
  t: Translate,
  rule: ProvisionRule,
  parameters: readonly CaseParameterDto[],
  locale: string,
): string[] {
  return rule.conditions
    .filter(condition => condition.holds === false)
    .map(condition => {
      const established = parameters.find(
        parameter => parameter.parameter === condition.parameter,
      );
      return t('provision.cond.reason', {
        label: translateOr(
          t,
          `provision.param.${condition.parameter}`,
          condition.parameter,
        ),
        required: expectationPhrase(t, condition.expected),
        // The case always publishes all six figures, so this is a guard and not
        // a case: a condition without its figure is a package the server sent
        // half of, and naming the requirement alone still beats a blank line.
        actual: established
          ? parameterPhrase(t, established, locale)
          : t('provision.not_established'),
      });
    });
}

/** The figures a rule turns on that nothing has established yet, by name — what
 *  is still to be found before the rule can be settled either way. */
export function undecidedNames(t: Translate, rule: ProvisionRule): string[] {
  return rule.conditions
    .filter(condition => condition.holds === null)
    .map(condition =>
      translateOr(
        t,
        `provision.param.${condition.parameter}`,
        condition.parameter,
      ),
    );
}
