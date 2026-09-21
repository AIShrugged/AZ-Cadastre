/**
 * The «Загрузить» beside one published gap: one file, sent in with what it
 * answers.
 *
 * Its own picker and not the batch panel's queue, because this is not a batch.
 * A target names one document, so the input takes one file and sends it the
 * moment it is chosen — an operator who has already decided which gap they are
 * answering has nothing left to confirm, and a second "send" step would only be
 * somewhere to forget.
 *
 * What the button is told, it was told by the server: `expectedType` and
 * `replacesDocumentId` are copied off the gap (`supplyTarget`) and never
 * assembled here. The service accepts exactly the list it published, so a button
 * drawn off that list cannot offer an upload that would be refused for having no
 * gap to answer.
 *
 * Three states and no empty one. Uploading says how far the bytes have got;
 * sending says the service is deciding; and a refusal is read by the rule the
 * service named — never "upload failed", which tells an operator nothing they
 * can act on.
 */
import { Loader2Icon, UploadIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

import {
  supplyTarget,
  useSupplyDocumentMutation,
} from '@/entities/verification-package';
import { failureCode, uploadDocument } from '@/shared/api';
import { translateOr, useI18n } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { ACCEPT, MAX_MB } from '@/shared/lib/document-file';
import { Button } from '@/shared/ui/button';
import type { DocumentGapDto } from '@cadastre/api-contracts/verification';

import { localRefusal, refusalKey } from '../model/refusal';

/** Where the one file has got to. `null` is the resting state: no file chosen,
 *  the button ready. */
type Sending =
  | { phase: 'uploading'; filename: string; progress: number }
  | { phase: 'supplying'; filename: string };

export function SupplyButton({
  packageId,
  gap,
  /** False while a run is under way: the package takes no files then, and the
   *  panel above says so in a sentence rather than leaving a dead button. */
  accepting,
  quiet = false,
}: {
  packageId: string;
  gap: DocumentGapDto;
  accepting: boolean;
  /** Drawn as an offer rather than an answer to a shortfall — the row is a
   *  paper the profile takes at any time, or an alternative under the fold.
   *  Outlined, all of these buttons carried the same weight as the one beside a
   *  missing title deed. The hit area is unchanged; only the frame goes. */
  quiet?: boolean;
}) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [sending, setSending] = useState<Sending | null>(null);
  const [supplyDocument] = useSupplyDocumentMutation();

  const busy = sending !== null;
  const label = translateOr(t, `doctype.${gap.expectedType}`, gap.expectedType);

  async function onPicked(file: File) {
    const refused = localRefusal(file);
    if (refused) {
      toast.error(t(refusalKey(refused), { max: MAX_MB }));
      return;
    }

    setSending({ phase: 'uploading', filename: file.name, progress: 0 });

    try {
      const { key, contentType } = await uploadDocument(file, {
        onProgress: progress =>
          setSending(current =>
            current?.phase === 'uploading' ? { ...current, progress } : current,
          ),
      });

      setSending({ phase: 'supplying', filename: file.name });

      await supplyDocument({
        id: packageId,
        body: {
          file: {
            originalFilename: file.name,
            contentType,
            storageKey: key,
          },
          ...supplyTarget(gap),
        },
      }).unwrap();

      // What happens next is the run's, and the card is already watching for it:
      // the package re-opened, so the detail query is polling and the gap will
      // go when the report is rebuilt without it. Nothing here removes the row.
      toast(t('supply.sent', { type: label }));
    } catch (error) {
      // The service names the rule it refused with a stable code. Said as the
      // rule, the operator learns that this target is no longer on the list, or
      // that the package is mid-run — "upload failed" teaches them neither.
      const code = failureCode(error);
      const generic = t('supply.failed');
      toast.error(code ? translateOr(t, refusalKey(code), generic) : generic);
    } finally {
      setSending(null);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type='file'
        accept={ACCEPT}
        className='sr-only'
        // The same input, used again: without this a second attempt at the same
        // file after a refusal fires no change event at all.
        onChange={event => {
          const [file] = event.target.files ?? [];
          event.target.value = '';
          if (file) void onPicked(file);
        }}
      />
      <Button
        variant={quiet ? 'ghost' : 'outline'}
        size='sm'
        className={cn('shrink-0', quiet && 'text-muted-foreground')}
        disabled={!accepting || busy}
        aria-disabled={!accepting || busy}
        // The picker's own label says nothing about which row it belongs to, and
        // a column of identical "Upload" buttons is a column a screen reader
        // cannot tell apart.
        aria-label={t('supply.action_for', { type: label })}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? (
          <Loader2Icon className='motion-safe:animate-spin' />
        ) : (
          <UploadIcon />
        )}
        {sending?.phase === 'uploading'
          ? t('supply.uploading', { n: sending.progress })
          : sending?.phase === 'supplying'
            ? t('supply.sending')
            : t('supply.action')}
      </Button>
    </>
  );
}
