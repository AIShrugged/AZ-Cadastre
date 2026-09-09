import { describe, expect, it } from 'vitest';

import {
  DeclaredAtIntake,
  DocumentType,
  IntakeSpec,
  VerificationProfile,
} from '../value-objects/index.js';

import {
  suggestProfile,
  type ProfileIntake,
} from './profile-suggestion.service.js';

function aProfile(
  key: string,
  grounds: readonly string[],
  builtFrom: number | null = null,
  builtBefore: number | null = null,
): ProfileIntake {
  return {
    key,
    intake: IntakeSpec.of({ grounds: [...grounds], builtFrom, builtBefore }),
  };
}

function declaring(state: {
  legalBasis?: string;
  builtYear?: number;
}): DeclaredAtIntake {
  return DeclaredAtIntake.of({
    legalBasis: state.legalBasis ? DocumentType.create(state.legalBasis) : null,
    builtYear: state.builtYear ?? null,
  });
}

function noteOn(
  suggestion: ReturnType<typeof suggestProfile>,
  criterion: 'legalBasis' | 'builtYear',
): string {
  const reason = suggestion.reasons.find(
    candidate => candidate.criterion === criterion,
  );

  expect(reason).toBeDefined();

  return reason!.note;
}

const CADASTRE = aProfile('cadastre', ['disposal_order']);
const INHERITANCE = aProfile('inheritance', ['inheritance_certificate']);

describe('suggestProfile', () => {
  it('proposes the one profile that registers a right founded on the declared ground', () => {
    const suggestion = suggestProfile(
      declaring({ legalBasis: 'disposal_order' }),
      [CADASTRE, INHERITANCE],
    );

    expect(suggestion.profileKey).toBe('cadastre');
  });

  /*
   * The recommendation is worth nothing an operator cannot check. Saying which
   * ground selected the profile is what lets them disagree with the part that
   * is wrong rather than with the answer as a whole.
   */
  it('says which ground selected it', () => {
    const suggestion = suggestProfile(
      declaring({ legalBasis: 'disposal_order' }),
      [CADASTRE, INHERITANCE],
    );

    expect(noteOn(suggestion, 'legalBasis')).toContain('disposal_order');
    expect(noteOn(suggestion, 'legalBasis')).toContain('cadastre');
  });

  it('proposes nothing where no profile registers the declared ground', () => {
    const suggestion = suggestProfile(
      declaring({ legalBasis: 'purchase_contract' }),
      [CADASTRE, INHERITANCE],
    );

    expect(suggestion.profileKey).toBeNull();
  });

  // An operator told theirs is not a ground has to be able to see what is.
  it('names what is registered when the declared ground is not', () => {
    const suggestion = suggestProfile(
      declaring({ legalBasis: 'purchase_contract' }),
      [CADASTRE, INHERITANCE],
    );

    expect(noteOn(suggestion, 'legalBasis')).toContain('disposal_order');
    expect(noteOn(suggestion, 'legalBasis')).toContain(
      'inheritance_certificate',
    );
  });

  /*
   * Never the only profile there happens to be. An office that ships one
   * profile today and two tomorrow must not find that a suggestion it had
   * learned to trust silently changed meaning.
   */
  it('proposes nothing where nothing was declared', () => {
    const suggestion = suggestProfile(declaring({}), [CADASTRE]);

    expect(suggestion.profileKey).toBeNull();
    expect(noteOn(suggestion, 'legalBasis')).toContain(
      'No ground was declared',
    );
  });

  it('proposes nothing where more than one profile registers the ground', () => {
    const suggestion = suggestProfile(
      declaring({ legalBasis: 'disposal_order' }),
      [CADASTRE, aProfile('cadastre_legacy', ['disposal_order'])],
    );

    expect(suggestion.profileKey).toBeNull();
    expect(noteOn(suggestion, 'legalBasis')).toContain('More than one profile');
  });

  it('narrows two profiles of one ground by the year they answer for', () => {
    const suggestion = suggestProfile(
      declaring({ legalBasis: 'disposal_order', builtYear: 1995 }),
      [
        aProfile('cadastre_legacy', ['disposal_order'], null, 2010),
        aProfile('cadastre', ['disposal_order'], 2010, null),
      ],
    );

    expect(suggestion.profileKey).toBe('cadastre_legacy');
    expect(noteOn(suggestion, 'builtYear')).toContain('1995');
  });

  // Guessing which side of a threshold an undeclared year falls on is the one
  // thing this must never do.
  it('proposes nothing where a bounded profile could be neither ruled in nor out', () => {
    const suggestion = suggestProfile(
      declaring({ legalBasis: 'disposal_order' }),
      [aProfile('cadastre_legacy', ['disposal_order'], null, 2010)],
    );

    expect(suggestion.profileKey).toBeNull();
    expect(noteOn(suggestion, 'builtYear')).toContain('No year was declared');
  });

  it('says the year ruled nothing out where no profile of the ground is bounded by one', () => {
    const suggestion = suggestProfile(
      declaring({ legalBasis: 'disposal_order', builtYear: 1995 }),
      [CADASTRE],
    );

    expect(suggestion.profileKey).toBe('cadastre');
    expect(noteOn(suggestion, 'builtYear')).toContain('ruled nothing out');
  });

  it('proposes nothing where the declared year rules out every profile of the ground', () => {
    const suggestion = suggestProfile(
      declaring({ legalBasis: 'disposal_order', builtYear: 1995 }),
      [aProfile('cadastre', ['disposal_order'], 2010, null)],
    );

    expect(suggestion.profileKey).toBeNull();
    expect(noteOn(suggestion, 'builtYear')).toContain(
      'rules out every profile',
    );
  });

  // Stated whatever each criterion settled: an operator reading only the line
  // that decided would not know the other one was even looked at.
  it('states both criteria whatever either of them settled', () => {
    for (const declared of [
      declaring({}),
      declaring({ legalBasis: 'disposal_order' }),
      declaring({ builtYear: 1995 }),
      declaring({ legalBasis: 'disposal_order', builtYear: 1995 }),
    ]) {
      expect(
        suggestProfile(declared, [CADASTRE]).reasons.map(
          reason => reason.criterion,
        ),
      ).toEqual(['legalBasis', 'builtYear']);
    }
  });

  it('answers for the profiles this build actually ships', () => {
    const suggestion = suggestProfile(
      declaring({ legalBasis: 'disposal_order' }),
      VerificationProfile.all,
    );

    expect(suggestion.profileKey).toBe(VerificationProfile.CADASTRE.key);
  });
});
