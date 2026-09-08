/**
 * Add files to a package that already exists — the document the report said was
 * missing, or a readable scan of a sheet nobody could read.
 *
 * The same feature as the one that fills a new package, pointed at an open one:
 * the same dropzone, the same validation, and the same road for the bytes —
 * `documents/presign` signs the URL, the browser PUTs to the store, and the
 * keys go to `POST /packages/:id/files`. There is one way to put a file in the
 * store and this is not a second one.
 *
 * Two things this surface owes the inspector that the new-package one does not:
 *
 *  - **What adding does.** A package that had been reported on is re-opened and
 *    verified afresh — the report, the cross-document checks and the register's
 *    answers were all worked out over an envelope that has since changed, so
 *    they are discarded (ADR-0013). That is a consequence, and it is said
 *    before the button is pressed rather than discovered after.
 *  - **Why it cannot be done.** While a run is under way the package takes no
 *    files, and the contract is what says so (`takesFiles`). The panel states
 *    that in a sentence instead of a disabled button with nothing beside it,
 *    and a refusal from the service is shown by the rule it named — never as
 *    "not allowed".
 */
import { UploadCloudIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import {
  takesFiles,
  useAddFilesMutation,
} from '@/entities/verification-package';
import { failureCode } from '@/shared/api';
import { translateOr, useI18n } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { useAppDispatch, useAppSelector } from '@/shared/lib/store-hooks';
import { Button } from '@/shared/ui/button';
import type { PackageStatus } from '@cadastre/api-contracts/verification';

import { attachedFiles } from '../lib/attached';
import { ACCEPT } from '../lib/file';
import {
  selectDocuments,
  selectReadyCount,
  selectValidCount,
} from '../model/selectors';
import { clearDocuments, enqueueDocuments } from '../model/slice';

import { Dropzone } from './dropzone';
import { UploadedList } from './uploaded-list';

export function AddFiles({
  packageId,
  status,
  reported,
}: {
  packageId: string;
  status: PackageStatus;
  /** Whether a run has already reported on this package — what adding a file
   *  now discards. */
  reported: boolean;
}) {
  const { t } = useI18n();
  const dispatch = useAppDispatch();
  const [addFiles, { isLoading: sending }] = useAddFilesMutation();

  const files = useAppSelector(selectDocuments);
  const total = useAppSelector(selectValidCount);
  const readyCount = useAppSelector(selectReadyCount);

  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);

  const accepting = takesFiles(status);

  // Leaving the page — or the package going into a run while the panel is open
  // — cancels any transfer still running and empties the list, so nothing
  // lingers in the store to be sent against a package that will not take it.
  useEffect(() => {
    if (!accepting) dispatch(clearDocuments());
  }, [accepting, dispatch]);
  useEffect(() => {
    return () => {
      dispatch(clearDocuments());
    };
  }, [dispatch]);

  if (!accepting) {
    return (
      <section className='rounded-xl border border-rule bg-muted/20 px-4 py-3.5'>
        <h3 className='register-label'>{t('add.title')}</h3>
        <p className='mt-2 max-w-[65ch] text-[0.8125rem] leading-relaxed text-muted-foreground'>
          {t('add.closed_running')}
        </p>
      </section>
    );
  }

  const attached = attachedFiles(files);
  const canSend = attached.length > 0 && !sending;

  async function onSend() {
    if (attached.length === 0 || sending) return;
    try {
      await addFiles({ id: packageId, body: { files: attached } }).unwrap();
      toast(t('add.done', { n: attached.length }));
      dispatch(clearDocuments());
    } catch (error) {
      // The service names the rule it refused with a stable code; say which one
      // rather than "not allowed", which tells the inspector nothing they can
      // act on. An unrecognised code — or no code at all — falls back.
      const code = failureCode(error);
      const generic = t('add.failed');
      toast.error(code ? translateOr(t, `error.${code}`, generic) : generic);
    }
  }

  const hasFiles = (event: React.DragEvent) =>
    Array.from(event.dataTransfer.types).includes('Files');

  return (
    <section
      className='rounded-xl border border-rule bg-muted/20 px-4 py-3.5'
      onDragEnter={event => {
        if (hasFiles(event)) {
          event.preventDefault();
          dragDepth.current += 1;
          setDragging(true);
        }
      }}
      onDragOver={event => {
        if (hasFiles(event)) event.preventDefault();
      }}
      onDragLeave={() => {
        dragDepth.current -= 1;
        if (dragDepth.current <= 0) {
          dragDepth.current = 0;
          setDragging(false);
        }
      }}
      onDrop={event => {
        event.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        if (event.dataTransfer.files.length)
          dispatch(enqueueDocuments(event.dataTransfer.files));
      }}
    >
      <input
        ref={inputRef}
        type='file'
        multiple
        accept={ACCEPT}
        className='sr-only'
        onChange={event => {
          if (event.target.files?.length)
            dispatch(enqueueDocuments(event.target.files));
          event.target.value = '';
        }}
      />

      {/* One count, not three: the list below already numbers what is in it,
          and the line by the button says how many of them can be sent. */}
      <h3 className='register-label'>{t('add.title')}</h3>
      <p className='mt-2 max-w-[65ch] text-[0.8125rem] leading-relaxed text-muted-foreground'>
        {reported ? t('add.note_reopens') : t('add.note')}
      </p>

      <Dropzone
        onBrowse={() => inputRef.current?.click()}
        className={cn(
          'mt-3.5 py-8',
          dragging && 'border-primary/70 bg-accent/50',
        )}
      />

      {files.length > 0 && (
        <div className='mt-4'>
          <UploadedList />
        </div>
      )}

      <div className='mt-4 flex flex-wrap items-center justify-end gap-3'>
        <span className='mr-auto text-[0.8125rem] text-muted-foreground'>
          {total === 0
            ? t('add.none')
            : readyCount < total
              ? t('add.uploading')
              : t('add.ready', { n: readyCount })}
        </span>
        <Button onClick={onSend} disabled={!canSend} aria-disabled={!canSend}>
          <UploadCloudIcon />
          {sending ? t('add.sending') : t('add.send')}
        </Button>
      </div>
    </section>
  );
}
