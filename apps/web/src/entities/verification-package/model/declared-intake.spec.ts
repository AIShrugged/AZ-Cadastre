import { describe, expect, it } from 'vitest';

import type { ProfileDto } from '@cadastre/api-contracts/verification';

import {
  BLANK_DECLARATION,
  DECLARED_YEAR_EARLIEST,
  DECLARED_YEAR_LATEST,
  declaresAnything,
  groundFitsProfile,
  groundsOffered,
  readDeclaration,
  readDeclaredYear,
  registering,
  toDeclaredInput,
  toSuggestionRequest,
} from './declared-intake';

const profile = (key: string, grounds: string[]): ProfileDto => ({
  key,
  documentTypes: grounds.map(ground => ({
    key: ground,
    required: true,
    fields: [],
  })),
  grounds,
});

const cadastre = profile('cadastre', ['disposal_order']);
const restitution = profile('restitution', ['disposal_order', 'court_ruling']);

describe('readDeclaredYear', () => {
  it('reads an empty box as nothing declared', () => {
    expect(readDeclaredYear('')).toEqual({ state: 'blank' });
    expect(readDeclaredYear('   ')).toEqual({ state: 'blank' });
  });

  it('reads a year still being typed as neither a year nor an error', () => {
    // Every year in the window is four digits, so `19` on the way to `1998` is
    // a box being filled — a form that refused it would argue mid-keystroke.
    expect(readDeclaredYear('1')).toEqual({ state: 'typing' });
    expect(readDeclaredYear('199')).toEqual({ state: 'typing' });
  });

  it('reads a year inside the window the engine reads one in', () => {
    expect(readDeclaredYear('1998')).toEqual({ state: 'year', year: 1998 });
    expect(readDeclaredYear(String(DECLARED_YEAR_EARLIEST))).toEqual({
      state: 'year',
      year: DECLARED_YEAR_EARLIEST,
    });
    expect(readDeclaredYear(String(DECLARED_YEAR_LATEST))).toEqual({
      state: 'year',
      year: DECLARED_YEAR_LATEST,
    });
  });

  it('refuses a figure outside the window and anything that is not one', () => {
    expect(readDeclaredYear('1799')).toEqual({ state: 'unreadable' });
    expect(readDeclaredYear('2201')).toEqual({ state: 'unreadable' });
    expect(readDeclaredYear('19x8')).toEqual({ state: 'unreadable' });
    expect(readDeclaredYear('-1998')).toEqual({ state: 'unreadable' });
  });
});

describe('readDeclaration', () => {
  it('declares no year while one is unreadable', () => {
    expect(
      readDeclaration({ legalBasis: 'disposal_order', builtYear: '19' }),
    ).toEqual({ legalBasis: 'disposal_order', builtYear: null });
  });

  it('reads the blank form as nothing declared', () => {
    const declared = readDeclaration(BLANK_DECLARATION);
    expect(declared).toEqual({ legalBasis: null, builtYear: null });
    expect(declaresAnything(declared)).toBe(false);
  });
});

describe('groundsOffered', () => {
  it('offers every ground the catalogue names before a profile is chosen', () => {
    expect(groundsOffered([cadastre, restitution], null)).toEqual([
      'disposal_order',
      'court_ruling',
    ]);
  });

  it('narrows to the chosen profile, which is what the service accepts', () => {
    expect(groundsOffered([cadastre, restitution], 'restitution')).toEqual([
      'disposal_order',
      'court_ruling',
    ]);
    expect(groundsOffered([cadastre, restitution], 'cadastre')).toEqual([
      'disposal_order',
    ]);
  });
});

describe('registering', () => {
  it('names the profiles that register a right founded on the ground', () => {
    expect(
      registering([cadastre, restitution], 'disposal_order').map(p => p.key),
    ).toEqual(['cadastre', 'restitution']);
    expect(
      registering([cadastre, restitution], 'court_ruling').map(p => p.key),
    ).toEqual(['restitution']);
  });

  it('names none for a ground nothing registers, and none for no ground', () => {
    expect(registering([cadastre], 'sale_contract')).toEqual([]);
    expect(registering([cadastre], null)).toEqual([]);
  });
});

describe('groundFitsProfile', () => {
  it('holds a declared ground against the chosen profile', () => {
    expect(groundFitsProfile([cadastre], 'cadastre', 'disposal_order')).toBe(
      true,
    );
    expect(groundFitsProfile([cadastre], 'cadastre', 'court_ruling')).toBe(
      false,
    );
  });

  it('holds nothing against a half-made choice', () => {
    expect(groundFitsProfile([cadastre], null, 'court_ruling')).toBe(true);
    expect(groundFitsProfile([cadastre], 'cadastre', null)).toBe(true);
  });

  it('leaves a profile this build has never heard of to the service', () => {
    expect(groundFitsProfile([cadastre], 'unknown', 'disposal_order')).toBe(
      true,
    );
  });
});

describe('toDeclaredInput', () => {
  it('leaves an empty declaration out of the request entirely', () => {
    expect(
      toDeclaredInput({ legalBasis: null, builtYear: null }),
    ).toBeUndefined();
  });

  it('sends only what was declared — never a null and never an empty string', () => {
    expect(
      toDeclaredInput({ legalBasis: 'disposal_order', builtYear: null }),
    ).toEqual({ legalBasis: 'disposal_order' });
    expect(toDeclaredInput({ legalBasis: null, builtYear: 1998 })).toEqual({
      builtYear: 1998,
    });
    expect(
      toDeclaredInput({ legalBasis: 'disposal_order', builtYear: 1998 }),
    ).toEqual({ legalBasis: 'disposal_order', builtYear: 1998 });
  });
});

describe('toSuggestionRequest', () => {
  it('puts no question at all where nothing has been declared', () => {
    expect(
      toSuggestionRequest({ legalBasis: null, builtYear: null }),
    ).toBeNull();
  });

  it('asks about whichever figure is declared', () => {
    expect(toSuggestionRequest({ legalBasis: null, builtYear: 1998 })).toEqual({
      builtYear: 1998,
    });
  });
});
