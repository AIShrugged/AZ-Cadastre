/**
 * One document's corrections, from the first keystroke to the run they start.
 *
 * The state is per document and lives with the card that draws it, because that
 * is the unit the contract is shaped for: an operator fixes what is wrong on a
 * paper and saves it once. Nothing leaves the browser until they do.
 *
 * The answer to a save is the whole package, so it is written into the cache
 * the detail screen is already reading rather than being followed by a fetch of
 * what the server has just said. The screen then re-renders off the response —
 * re-opened, its report gone, back in the queue — and its own poll takes over
 * from there.
 */
import { useState } from 'react';
import { toast } from 'sonner';

import {
  useEditDocumentFieldsMutation,
  useKeepPackage,
} from '@/entities/verification-package';
import { failureCode } from '@/shared/api';
import { translateOr, useI18n } from '@/shared/i18n';
import type {
  DocumentDto,
  FieldDto,
} from '@cadastre/api-contracts/verification';

import {
  addedNames,
  anyOverlong,
  correctionsOf,
  isChanged,
  withoutText,
  withText,
  type Draft,
} from './corrections';

export type Corrections = {
  draft: Draft;
  /** Every correction the save would carry, as the wire takes them. */
  pending: ReturnType<typeof correctionsOf>;
  /** Something in the draft is longer than the contract takes. */
  overlong: boolean;
  saving: boolean;
  /** Whether this row has a box open on it — the register draws a box where
   *  there is one and a value where there is not. */
  opened: (name: string) => boolean;
  /** Whether this row's box says something other than what the register holds,
   *  which is what the row has to be marked unsaved for. */
  changed: (name: string) => boolean;
  /** Keys the operator has opened a box for that the document holds nothing
   *  for — rows the card draws under its own. */
  added: readonly string[];
  type: (name: string, text: string) => void;
  /** Put one row back as the document holds it. */
  revert: (name: string) => void;
  /** Open a box on a key nothing was read for. */
  open: (name: string) => void;
  /** Throw the whole draft away — the card goes back to what the server holds. */
  discard: () => void;
  save: () => void;
};

export function useCorrections(
  packageId: string,
  doc: DocumentDto,
  fields: readonly FieldDto[],
): Corrections {
  const { t } = useI18n();
  const keep = useKeepPackage();
  const [edit, { isLoading: saving }] = useEditDocumentFieldsMutation();
  const [draft, setDraft] = useState<Draft>({});

  const pending = correctionsOf(fields, draft);
  const overlong = anyOverlong(draft);

  async function save() {
    if (saving || overlong || pending.length === 0) return;
    try {
      const pkg = await edit({
        id: packageId,
        documentId: doc.id,
        body: { fields: pending },
      }).unwrap();
      // The screen is looking at this cache entry; the answer is the package as
      // it now stands, so it goes straight in.
      keep(pkg);
      setDraft({});
      toast(t('correct.saved'));
    } catch (error) {
      // The draft is kept, and kept marked as unsaved. Dropping it would throw
      // away what the operator read off the paper over a refusal they can act
      // on — and the row goes on saying "not saved yet", so it never shows a
      // value as one the register holds when it does not.
      const code = failureCode(error);
      const generic = t('correct.failed');
      toast.error(code ? translateOr(t, `error.${code}`, generic) : generic);
    }
  }

  return {
    draft,
    pending,
    overlong,
    saving,
    opened: name => name in draft,
    changed: name => isChanged(fields, draft, name),
    added: addedNames(fields, draft),
    type: (name, text) => setDraft(current => withText(current, name, text)),
    revert: name => setDraft(current => withoutText(current, name)),
    open: name => setDraft(current => withText(current, name, '')),
    discard: () => setDraft({}),
    save: () => void save(),
  };
}
