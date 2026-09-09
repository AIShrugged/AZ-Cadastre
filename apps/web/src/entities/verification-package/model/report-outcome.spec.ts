import { describe, expect, it } from 'vitest';

import { ReportStatusSchema } from '@cadastre/api-contracts/verification';

import { REPORT_KEY, REPORT_TONE } from './report-outcome';

const OUTCOMES = ReportStatusSchema.options;

describe('what the run made of the papers', () => {
  // The contract may gain an outcome; a client that drew nothing for it would
  // leave a column blank on a row the filter can still select.
  it.each(OUTCOMES)('gives %s a word and a tone', outcome => {
    expect(REPORT_KEY[outcome]).toBeDefined();
    expect(REPORT_TONE[outcome]).toBeDefined();
  });

  // A short set of papers and a set with findings against it are not the same
  // news, and the register's tones are what say them apart.
  it('keeps a shortfall and a finding in different tones', () => {
    expect(REPORT_TONE.OK).toBe('ok');
    expect(REPORT_TONE.IssuesFound).toBe('issues');
    expect(REPORT_TONE.IncompletePackage).toBe('incomplete');
  });

  // The register's row and the detail's report panel read one mapping. Two
  // copies is how they come to call the same outcome by two names.
  it('names the outcomes in the words the detail screen already used', () => {
    expect(REPORT_KEY).toEqual({
      OK: 'status.ok',
      IssuesFound: 'status.issues',
      IncompletePackage: 'status.incomplete',
    });
  });
});
