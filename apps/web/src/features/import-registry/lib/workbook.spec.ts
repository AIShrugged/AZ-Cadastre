import { describe, expect, it } from 'vitest';

import { MAX_BYTES, refusalFor } from './workbook';

/** A file of a given name and size, without holding the bytes for it. */
function file(name: string, size = 1024): File {
  const made = new File([], name);
  Object.defineProperty(made, 'size', { value: size });
  return made;
}

describe('refusalFor', () => {
  it('accepts a workbook', () => {
    expect(refusalFor(file('registry-import-template.xlsx'))).toBeNull();
  });

  it('accepts a workbook named in any case', () => {
    // The register lowercases the name before it looks at the extension, and a
    // file off a Windows share is as likely to be .XLSX as .xlsx.
    expect(refusalFor(file('REGISTER.XLSX'))).toBeNull();
  });

  it('refuses anything that is not an .xlsx', () => {
    expect(refusalFor(file('scan.pdf'))).toBe('format');
    expect(refusalFor(file('records.xls'))).toBe('format');
    expect(refusalFor(file('records.xlsx.zip'))).toBe('format');
    expect(refusalFor(file('records'))).toBe('format');
  });

  it('refuses a workbook over the register’s ceiling', () => {
    expect(refusalFor(file('big.xlsx', MAX_BYTES + 1))).toBe('size');
    expect(refusalFor(file('exact.xlsx', MAX_BYTES))).toBeNull();
  });

  it('names the format before the size', () => {
    // Both are wrong: the one to say is the one the operator can act on without
    // finding out the file was never a workbook to begin with.
    expect(refusalFor(file('huge.pdf', MAX_BYTES + 1))).toBe('format');
  });
});
