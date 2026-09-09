/**
 * How something came out, as a pill — a mark and the word, always together (The
 * Status-Never-Alone Rule). No colour-only meaning, which is what lets five
 * answers stay five answers for a reader who cannot tell amber from orange.
 *
 * It lives in `shared/ui` because two entities now draw it and one of them must
 * not import the other's: the verification context reports what the archive
 * answered **about a submission** (`RegistryOutcome`), and the archive register
 * reports what it holds **about a property** (`LookupOutcome`). Two vocabularies,
 * one visual grammar — and a reader should not have to learn the grammar twice.
 *
 * The tones are here and the mapping is not. Which word takes which tone is a
 * statement about that word's meaning, so it stays with the vocabulary that owns
 * it; this module only says what a tone looks like.
 */
import type { ReactNode } from 'react';

import { cn } from '@/shared/lib/cn';

/**
 * The tones an outcome is set in.
 *
 * `ok`, `issues` and `incomplete` are the register's own three, shared with
 * every other panel on the surface. The two below them exist because an answer
 * may come from a source outside the system that is allowed not to know:
 *
 *  - `silent`  — it holds nothing under what was asked. Neutral, and
 *                deliberately without a fault's colour.
 *  - `question`— it holds more than one answer. Not a fault either, but not
 *                silence: somebody has to say which one applies.
 */
export type OutcomeTone =
  'ok' | 'issues' | 'incomplete' | 'silent' | 'question';

const CHIP: Record<OutcomeTone, string> = {
  ok: 'bg-ok/12 text-ok-ink',
  issues: 'bg-issues/12 text-issues-ink',
  incomplete: 'bg-incomplete/12 text-incomplete-ink',
  // Untinted and unalarming on purpose: a register holding no record is an
  // absence of evidence, and a fault's colour would state a shortfall it never
  // claimed (ADR-0009).
  silent: 'bg-muted text-muted-foreground',
  // A question for a person rather than a finding against the package, in the
  // one hue this surface keeps for waiting on somebody.
  question: 'bg-accent-2/12 text-accent-2-ink',
};

const DOT: Record<OutcomeTone, string> = {
  ok: 'bg-ok',
  issues: 'bg-issues',
  incomplete: 'bg-incomplete',
  silent: 'bg-muted-foreground/45',
  question: 'bg-accent-2',
};

export function OutcomeMark({
  tone,
  label,
  icon,
}: {
  tone: OutcomeTone;
  label: string;
  /** Drawn in place of the dot where the answer has a mark of its own — the
   *  five archive verdicts have five icons, so none of them rests on colour. */
  icon?: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.6875rem] font-medium',
        CHIP[tone],
      )}
    >
      {icon ?? (
        <span aria-hidden className={cn('size-1.5 rounded-full', DOT[tone])} />
      )}
      {label}
    </span>
  );
}
