/**
 * The folded panels of the case file, and which one holds a given anchor.
 *
 * The case page is a sheet of paper with its evidence filed under it: five
 * `<details>` panels, each saying what is inside before it is opened. Every jump
 * on that surface — a finding pointing at the reading behind it, a link arriving
 * from outside — goes through `panelForHash`, so the fold is opened before the
 * browser is sent to the anchor. A jump into a shut fold lands on nothing.
 */

export const PANEL = {
  attention: 'panel-attention',
  provision: 'panel-provision',
  documents: 'panel-documents',
  checks: 'panel-checks',
  archive: 'panel-archive',
} as const;

export type PanelId = (typeof PANEL)[keyof typeof PANEL];

/**
 * Which panel holds the thing this fragment names.
 *
 * The exact anchors are matched exactly and only the families are matched by
 * prefix. `#document-gaps`, `#documents` and `#doc-<id>` all begin with `#doc`,
 * so a `startsWith('#doc-')` test that reads correctly still sends the first two
 * to the attention panel — and the failure is silent, because the fold they
 * belong to simply never opens and the browser scrolls nowhere. That shipped
 * once, when COMM-81 added `#document-gaps` beside the existing `#doc-` family.
 */
export function panelForHash(hash: string): PanelId {
  if (hash.startsWith('#check-')) return PANEL.checks;
  if (hash === '#provision') return PANEL.provision;
  if (hash.startsWith('#registry-') || hash.startsWith('#archive-')) {
    return PANEL.archive;
  }
  if (
    hash === '#documents' ||
    hash === '#document-gaps' ||
    hash === '#add-files' ||
    hash.startsWith('#doc-') ||
    hash.startsWith('#field-')
  ) {
    return PANEL.documents;
  }
  return PANEL.attention;
}
