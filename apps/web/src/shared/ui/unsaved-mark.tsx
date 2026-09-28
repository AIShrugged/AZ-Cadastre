/**
 * The mark something carries while what it shows is the operator's and not yet
 * the register's.
 *
 * It is the answer to the one thing an editing surface must never get wrong: a
 * value must never look saved before it is. So the mark is on every touched row
 * until the save comes back, and a save that is refused leaves it exactly where
 * it was.
 *
 * It lives in `shared/ui` because two features now draw it and neither may
 * import the other's: an operator corrects what the engine read off a paper
 * (`correct-field`) and states what the case's own figures are
 * (`state-case-parameter`). Two writes, one visual grammar — and a reader should
 * not have to learn twice what "not saved" looks like (COMM-194).
 */
import { useI18n } from '@/shared/i18n';

export function UnsavedMark() {
  const { t } = useI18n();

  return (
    <span className='inline-flex rounded-sm bg-issues/14 px-1.5 py-0.5 text-[0.625rem] font-medium leading-none text-issues-ink'>
      {t('correct.unsaved')}
    </span>
  );
}
