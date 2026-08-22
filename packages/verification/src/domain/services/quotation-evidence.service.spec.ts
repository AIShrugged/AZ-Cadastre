import { describe, expect, it } from 'vitest';

import { quotedIn } from './quotation-evidence.service.js';

const CERTIFICATE = [
  'AZƏRBAYCAN RESPUBLİKASI PREZİDENTİNİN İŞLƏR İDARƏSİ',
  'ARXİV ARAYIŞI',
  '№ 1-2-28/2-496/2025      [hw: 15] dekabr [hw: 2025] il',
  'Əliyeva Rübabə Kavı qızına fərdi mənzil tikintisi üçün 0.05 ha hesabı ilə',
  '5-862 saylı həyətyanı torpaq sahəsi ayrılmışdır.',
  '[stamp: İCTİMAİ-SİYASİ SƏNƏDLƏR ARXİVİ] [signature]',
].join('\n');

describe('quotedIn', () => {
  it('accepts a quote the document actually carries', () => {
    expect(quotedIn(CERTIFICATE, '1-2-28/2-496/2025')).toBe(true);
  });

  it('rejects a year the document does not carry, which is how a plausible date gets caught', () => {
    // The reading this check exists for: a certificate dated 2025 returned as
    // 2026, at a confidence that made it look checked.
    expect(quotedIn(CERTIFICATE, '15 dekabr 2026')).toBe(false);
  });

  it('rejects a name assembled out of the shape of some handwriting', () => {
    expect(quotedIn(CERTIFICATE, 'Strzela Ribaba')).toBe(false);
  });

  it('does not mind how the quote was spaced or wrapped', () => {
    expect(quotedIn(CERTIFICATE, '  Əliyeva   Rübabə\n  Kavı qızına ')).toBe(
      true,
    );
  });

  it('does not mind the case it was typed back in', () => {
    expect(quotedIn(CERTIFICATE, 'arxiv arayışı')).toBe(true);
  });

  it("reads through the transcription's own marks, which are ours and not the document's", () => {
    expect(quotedIn(CERTIFICATE, '15 dekabr 2025 il')).toBe(true);
  });

  it('takes a doubtful reading as the text it hedges', () => {
    expect(quotedIn('plot <?5-862> saylı', '5-862 saylı')).toBe(true);
  });

  it('treats the several dashes a scan produces as one', () => {
    expect(quotedIn('torpaq 5–862 saylı', '5-862')).toBe(true);
  });

  it('refuses a quote too short to be evidence of anything', () => {
    // Every document contains "25". Matching on it would wave through any value
    // the model cared to attach it to.
    expect(quotedIn(CERTIFICATE, '25')).toBe(false);
  });

  it('refuses an empty quote, so a model that offered none is not thereby verified', () => {
    expect(quotedIn(CERTIFICATE, '')).toBe(false);
    expect(quotedIn(CERTIFICATE, '   ')).toBe(false);
  });
});
