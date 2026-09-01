/**
 * Loading register records from a workbook.
 *
 * The modal is the whole feature: pick an .xlsx, watch it go, read what the
 * register did with it. A workbook that is partly wrong is not a failure — the
 * register stores every object it could read and reports the sheet, row and
 * column of each one it refused (ADR-0011 §4) — so the outcome is a report and
 * only a file the register could not open at all is an error.
 */
import axios from 'axios';
import {
  FileSpreadsheetIcon,
  TriangleAlertIcon,
  UploadIcon,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { apiFailure } from '@/shared/api';
import { useI18n } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/table';

import { importRegistryWorkbook } from '../api/registry-import-api';
import { ACCEPT, MAX_MB, refusalFor } from '../lib/workbook';
import type { ImportPhase, RegistryImportReport } from '../model/types';

const ROW_KEYS: (keyof RegistryImportReport['rows'])[] = [
  'addresses',
  'rightHolders',
  'documents',
  'aliases',
  'locations',
];

export function ImportRegistryDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const aborter = useRef<AbortController | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<ImportPhase>({ kind: 'idle' });

  const reset = useCallback(() => {
    aborter.current?.abort();
    aborter.current = null;
    setFile(null);
    setPhase({ kind: 'idle' });
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  // A closed modal holds nothing: the next open starts from an empty picker,
  // and a transfer nobody is watching is cancelled rather than left running.
  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const pick = (picked: File | undefined) => {
    if (!picked) return;

    const refusal = refusalFor(picked);
    setFile(picked);
    setPhase(
      refusal === null
        ? { kind: 'idle' }
        : {
            kind: 'failed',
            message:
              refusal === 'size'
                ? t('reg.import.err.size', { max: MAX_MB })
                : t('reg.import.err.format'),
          },
    );
  };

  const send = async () => {
    if (!file || refusalFor(file) !== null) return;

    const controller = new AbortController();
    aborter.current = controller;
    setPhase({ kind: 'sending', progress: 0 });

    try {
      const report = await importRegistryWorkbook(file, {
        signal: controller.signal,
        onProgress: progress => setPhase({ kind: 'sending', progress }),
      });
      setPhase({ kind: 'reported', report });
    } catch (error) {
      // The modal aborts its own transfer when it closes — that is not a failure.
      if (axios.isCancel(error)) return;
      // The register answers a refusal in the published `ErrorBody`, but with one
      // code for all of them (`VALIDATION_FAILED`) — so unlike the core API there
      // is nothing to key a translation on, and its sentence names the actual
      // fault. Shown as it came; the fallback covers a register that never
      // answered at all.
      setPhase({
        kind: 'failed',
        message: apiFailure(error)?.message ?? t('reg.import.err.unreachable'),
      });
    } finally {
      aborter.current = null;
    }
  };

  const busy = phase.kind === 'sending';

  return (
    // A stray click outside does not dismiss this one: there is a file picked, a
    // transfer running or a report to read behind it, and none of the three is
    // worth losing to a misplaced pointer. Escape, Cancel and the corner cross
    // still close it, and closing aborts a transfer rather than leaving it
    // running for nobody — the import upserts on the object key, so a workbook
    // sent again after an abort changes nothing (ADR-0011).
    <Dialog open={open} onOpenChange={onOpenChange} disablePointerDismissal>
      <DialogContent className='max-w-2xl'>
        <DialogHeader>
          <DialogTitle>{t('reg.import.title')}</DialogTitle>
          <DialogDescription>{t('reg.import.subtitle')}</DialogDescription>
        </DialogHeader>

        <input
          ref={inputRef}
          type='file'
          accept={ACCEPT}
          className='hidden'
          onChange={e => pick(e.target.files?.[0])}
        />

        <div className='min-h-0 flex-1 overflow-y-auto'>
          {/* ── The file, and how to choose another one ── */}
          <div className='flex items-center gap-3 border-y border-rule py-3'>
            <span
              aria-hidden
              className='grid size-9 shrink-0 place-items-center rounded-lg border border-rule-strong bg-card text-muted-foreground'
            >
              <FileSpreadsheetIcon className='size-4' />
            </span>
            <span className='min-w-0 flex-1'>
              {file ? (
                <span data-mono className='block truncate text-[0.8125rem]'>
                  {file.name}
                </span>
              ) : (
                <span className='text-[0.8125rem] text-muted-foreground'>
                  {t('reg.import.no_file')}
                </span>
              )}
            </span>
            <Button
              variant='outline'
              size='sm'
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              {file ? t('reg.import.change') : t('reg.import.choose')}
            </Button>
          </div>

          {phase.kind === 'sending' && <Sending progress={phase.progress} />}
          {phase.kind === 'reported' && <Report report={phase.report} />}
          {phase.kind === 'failed' && <Failure message={phase.message} />}
        </div>

        <DialogFooter>
          <Button variant='ghost' onClick={() => onOpenChange(false)}>
            {phase.kind === 'reported'
              ? t('reg.import.close')
              : t('reg.import.cancel')}
          </Button>
          <Button
            disabled={file === null || busy || refusalFor(file) !== null}
            onClick={() => void send()}
          >
            <UploadIcon />
            {phase.kind === 'reported' || phase.kind === 'failed'
              ? t('reg.import.again')
              : t('reg.import.send')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The transfer, and then the wait. 100% is not the end of the work: the register
 * reads the whole workbook and writes it in one transaction after the last byte
 * arrives, which is the part with no progress to report.
 */
function Sending({ progress }: { progress: number }) {
  const { t } = useI18n();
  return (
    <div className='flex items-center gap-3 pt-4'>
      <span className='h-[3px] w-full overflow-hidden rounded-full bg-rule'>
        <span
          className='block h-full rounded-full bg-primary transition-[width] duration-300 ease-out'
          style={{ width: `${progress}%` }}
        />
      </span>
      <span
        data-mono
        className='shrink-0 text-[0.6875rem] tabular-nums text-muted-foreground'
      >
        {progress < 100
          ? t('reg.import.sending', { p: progress })
          : t('reg.import.reading')}
      </span>
    </div>
  );
}

function Failure({ message }: { message: string }) {
  return (
    <p className='mt-4 flex items-start gap-2 border border-destructive/30 bg-destructive/10 p-3 text-[0.8125rem] text-destructive'>
      <TriangleAlertIcon className='mt-px size-4 shrink-0' />
      <span>{message}</span>
    </p>
  );
}

function Report({ report }: { report: RegistryImportReport }) {
  const { t } = useI18n();
  return (
    <div className='space-y-4 pt-4'>
      <p
        className={cn(
          'text-[0.8125rem]',
          report.accepted ? 'text-foreground' : 'text-issues-ink',
        )}
      >
        {report.accepted
          ? t('reg.import.accepted')
          : t('reg.import.partial', { n: report.refused })}
      </p>

      <dl className='grid grid-cols-2 gap-x-6 gap-y-1 border-y border-rule py-3 text-[0.8125rem] sm:grid-cols-4'>
        <Figure label={t('reg.import.imported')} value={report.imported} />
        <Figure label={t('reg.import.refused')} value={report.refused} />
        {ROW_KEYS.map(key => (
          <Figure
            key={key}
            label={t(`reg.import.rows.${key}`)}
            value={report.rows[key]}
          />
        ))}
      </dl>

      <p className='text-[0.8125rem] text-muted-foreground'>{report.note}</p>

      {report.problems.length > 0 && (
        <div className='max-h-64 overflow-y-auto border border-rule'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('reg.import.col.sheet')}</TableHead>
                <TableHead>{t('reg.import.col.row')}</TableHead>
                <TableHead>{t('reg.import.col.column')}</TableHead>
                <TableHead>{t('reg.import.col.message')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.problems.map((problem, i) => (
                <TableRow
                  key={`${problem.sheet}-${problem.row}-${problem.column}-${i}`}
                >
                  <TableCell>{problem.sheet}</TableCell>
                  <TableCell data-mono className='tabular-nums'>
                    {problem.row ?? '—'}
                  </TableCell>
                  <TableCell data-mono>{problem.column ?? '—'}</TableCell>
                  <TableCell className='text-muted-foreground'>
                    {problem.message}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div className='flex flex-col gap-0.5'>
      <dt className='register-label text-muted-foreground'>{label}</dt>
      <dd data-mono className='tabular-nums text-foreground'>
        {value}
      </dd>
    </div>
  );
}
