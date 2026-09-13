import { describe, expect, it } from 'vitest';

import { PANEL, panelForHash } from './panels';

describe('which fold an anchor is filed under', () => {
  it('sends a document, a field and the register of them to the documents fold', () => {
    expect(panelForHash('#doc-abc')).toBe(PANEL.documents);
    expect(panelForHash('#field-abc-owner')).toBe(PANEL.documents);
    expect(panelForHash('#documents')).toBe(PANEL.documents);
    expect(panelForHash('#add-files')).toBe(PANEL.documents);
  });

  // COMM-81 added `#document-gaps` beside the `#doc-` family. A prefix test for
  // `#doc-` does not match it, so the anchor routed to the attention panel and
  // the fold holding it never opened — a jump that silently scrolled nowhere.
  it('sends the published gaps to the documents fold and not the attention one', () => {
    expect(panelForHash('#document-gaps')).toBe(PANEL.documents);
  });

  // A finding about a missing title or an undecided provision lands on the fold
  // that shows the figures it was decided on (ADR-0025).
  it('sends the provision of Article 8 to its own fold', () => {
    expect(panelForHash('#provision')).toBe(PANEL.provision);
  });

  it('sends a cross-document check to the checks fold', () => {
    expect(panelForHash('#check-address')).toBe(PANEL.checks);
  });

  it('sends the register and its signature to the archive fold', () => {
    expect(panelForHash('#registry-1')).toBe(PANEL.archive);
    expect(panelForHash('#archive-approval')).toBe(PANEL.archive);
  });

  it('sends anything it does not recognise to the attention fold', () => {
    expect(panelForHash('')).toBe(PANEL.attention);
    expect(panelForHash('#whatever')).toBe(PANEL.attention);
  });
});
