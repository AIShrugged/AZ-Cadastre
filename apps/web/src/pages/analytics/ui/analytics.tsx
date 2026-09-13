/**
 * Analytics — the register from further away, on a surface of its own.
 *
 * It used to head `/cases`, on the reasoning that an inspector comes to the
 * register anyway. What that cost was four hundred pixels of tallies between
 * them and the search box every single time they came to find one case. Taking
 * the register's measure and finding a case are asked at different moments, so
 * they are answered in different places, and the register is a register.
 *
 * The page is a title, one period control and the summary under them. The
 * control sits in the heading because everything below is read over the **same
 * window**: the counters and the figures come from one call, so they cannot
 * disagree, and the mark beside the title reads that same call from the cache
 * rather than making a second one.
 */
import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import {
  parseOverviewPeriod,
  withOverviewPeriod,
  type OverviewPeriod,
} from '@/entities/verification-package';
import { useI18n } from '@/shared/i18n';
import { SurfaceBody, SurfaceHeading, SurfacePage } from '@/shared/ui/surface';
import {
  ConveyorMark,
  PeriodSelect,
  RegisterSummary,
} from '@/widgets/register-summary';

export function Analytics() {
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();

  const period = useMemo(() => parseOverviewPeriod(params), [params]);
  const askPeriod = useCallback(
    (next: OverviewPeriod) =>
      setParams(withOverviewPeriod(new URLSearchParams(), next)),
    [setParams],
  );

  // A fixed instant the windows are measured back from. Held here rather than
  // read inside the query: the request is its own cache key, and a `from` that
  // moved every render would be a call that never stopped.
  const [now] = useState(() => Date.now());

  return (
    <SurfacePage>
      <SurfaceHeading
        title={t('page.analytics.title')}
        badge={<ConveyorMark period={period} now={now} />}
        actions={<PeriodSelect period={period} onPeriod={askPeriod} />}
      />

      <SurfaceBody>
        <RegisterSummary period={period} now={now} />
      </SurfaceBody>
    </SurfacePage>
  );
}
