/**
 * A click that takes the reader to somewhere else on the page, moving whatever
 * has to move first.
 *
 * The target of a jump may be filtered out of the view the reader is looking at,
 * or sit in a panel that is not mounted — a link that lands on nothing is worse
 * than no link. So the handler is the surface's to write: only the page knows
 * which tab is open and which segment is showing, and it switches those before
 * the fragment is applied.
 *
 * In `shared/` because more than one place hands one out and more than one takes
 * one, and two structurally identical declarations of the same function type are
 * two types as far as the compiler is concerned.
 */
import type { ComponentProps } from 'react';

type AnchorClick = Parameters<NonNullable<ComponentProps<'a'>['onClick']>>[0];

export type Jump = (
  documentId: string | null,
  anchor: string,
) => (event: AnchorClick) => void;
