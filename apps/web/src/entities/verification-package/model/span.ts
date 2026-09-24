/**
 * The span as the server calculated it out of the axis chains (ADR-0043), put
 * into the few words every surface states it in — the field it was read off,
 * the figures of the case, the sheet.
 *
 * Nothing here calculates anything. Which entries are spans, what unit the
 * figures are in and whether the longest is within the limit were all decided
 * by the server; this only says it, and says it the same way in three places.
 */
import type {
  CaseParameterDto,
  CaseProvisionDto,
  SpanCalculationDto,
} from '@cadastre/api-contracts/verification';

/** The `t` from `useI18n`. */
type Translate = (
  key: string,
  params?: Record<string, string | number>,
) => string;

/** The span figure of the case, whether or not anything established it. */
export function spanParameter(
  provision: CaseProvisionDto | null,
): CaseParameterDto | null {
  return (
    provision?.parameters.find(parameter => parameter.parameter === 'span') ??
    null
  );
}

/**
 * Whether the span meets the one row of the table that holds it to a limit —
 * the six metres of 8.0.10.2. Null where no row could hold it: the span went
 * unread, or no row the table carries names it.
 */
export function spanWithinLimit(
  provision: CaseProvisionDto | null,
): boolean | null {
  for (const rule of provision?.rules ?? []) {
    const condition = rule.conditions.find(one => one.parameter === 'span');
    if (condition && condition.holds !== null) return condition.holds;
  }
  return null;
}

/** A length in metres, in the reader's own decimal separator. */
export function metres(length: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }).format(length);
}

/** The two axes of a span, the way a plan joins them. */
export function axesOf(span: { from: string; to: string }): string {
  return `${span.from}—${span.to}`;
}

/** The longest span of all, in one phrase: "5.2 m, axes B—C". */
export function spanPhrase(
  t: Translate,
  calculation: SpanCalculationDto,
  locale: string,
): string {
  const longest = calculation.chains
    .map(chain => chain.longest)
    .reduce((best, span) => (span.length > best.length ? span : best));

  return t('span.value', {
    m: metres(calculation.longest, locale),
    axes: axesOf(longest),
  });
}

/**
 * Every span of one chain: "1—2 4.0 · 2—3 4.4". Each span is held together —
 * a word joiner either side of the dash, a no-break space before the figure —
 * so a narrow column breaks the line between spans and never inside one.
 */
export function chainLine(
  chain: SpanCalculationDto['chains'][number],
  locale: string,
): string {
  return chain.spans
    .map(
      span =>
        `${span.from}\u2060—\u2060${span.to}\u00a0${metres(span.length, locale)}`,
    )
    .join(' · ');
}

/** What the figures were read in, and who decided it. */
export function unitLine(
  t: Translate,
  calculation: SpanCalculationDto,
): string {
  return t(`span.unit.${calculation.unitBasis}`, {
    unit: t(`span.unit_name.${calculation.unit}`),
  });
}
