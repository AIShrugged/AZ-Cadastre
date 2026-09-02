import { FileUpIcon } from 'lucide-react';
import { useState } from 'react';

import { useI18n } from '@/shared/i18n';
import { Button } from '@/shared/ui/button';

import { ImportRegistryDialog } from './import-registry-dialog';

/**
 * The one control this feature puts on a page: it owns its own modal, so a
 * surface adopts the whole of it by rendering this and nothing else.
 */
export function ImportRegistryButton() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant='outline' onClick={() => setOpen(true)}>
        <FileUpIcon />
        <span className='hidden sm:inline'>{t('reg.import.action')}</span>
      </Button>
      <ImportRegistryDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
