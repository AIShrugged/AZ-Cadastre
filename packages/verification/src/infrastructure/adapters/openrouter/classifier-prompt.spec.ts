import { describe, expect, it } from 'vitest';

import {
  DocumentCatalogue,
  DocumentType,
  VerificationProfile,
} from '../../../domain/value-objects/index.js';

import {
  classificationInstructions,
  matchKey,
  readAnswer,
} from './classifier-prompt.js';

const CADASTRE = VerificationProfile.CADASTRE.specs;
const CATALOGUE = DocumentCatalogue.KNOWN;
const PROMPT = classificationInstructions(CADASTRE);

describe('classificationInstructions', () => {
  it("offers every one of the profile's own types", () => {
    for (const spec of CADASTRE) {
      expect(PROMPT).toContain(`- ${spec.type.value}\n`);
    }
  });

  // The whole point of the catalogue is that the model is shown the key: a key
  // that never reaches the prompt can never be answered, and the entry might as
  // well not exist (ADR-0022).
  it('offers every key the catalogue holds', () => {
    for (const type of CATALOGUE.types) {
      expect(PROMPT).toContain(`- ${type.value}\n`);
    }
  });

  it('shows the headings each key is usually printed under', () => {
    for (const entry of CATALOGUE.entries) {
      for (const hint of entry.hints) {
        expect(PROMPT).toContain(`"${hint}"`);
      }
    }
  });

  // Fifty keys in a flat run are read worse than four labelled groups. The
  // headings are what tell the model that a ground under the Law and a
  // courier's waybill are not the same kind of answer.
  it('prints the keys under the headings of their groups', () => {
    for (const group of CATALOGUE.groups) {
      expect(PROMPT).toContain(`${group.title}:`);
    }
  });

  it('puts the group headings before the keys they head', () => {
    for (const group of CATALOGUE.groups) {
      const heading = PROMPT.indexOf(`${group.title}:`);

      for (const entry of group.entries) {
        expect(PROMPT.indexOf(`- ${entry.type.value}\n`)).toBeGreaterThan(
          heading,
        );
      }
    }
  });

  // The profile is shown first and named as the only list that answers a
  // requirement, so a document that could be read as either is read as the
  // profile's (ADR-0012).
  it("shows the profile's own types before the catalogue's", () => {
    const lastProfile = Math.max(
      ...CADASTRE.map(spec => PROMPT.indexOf(`- ${spec.type.value}\n`)),
    );
    const firstCatalogued = Math.min(
      ...CATALOGUE.types.map(type => PROMPT.indexOf(`- ${type.value}\n`)),
    );

    expect(firstCatalogued).toBeGreaterThan(-1);
    expect(lastProfile).toBeLessThan(firstCatalogued);
  });

  it('still offers the two answers the engine keeps for itself', () => {
    expect(PROMPT).toContain(`- ${DocumentType.OUT_OF_PROFILE.value}\n`);
    expect(PROMPT).toContain(`- ${DocumentType.UNKNOWN.value}\n`);
  });

  // "None of the above" is a far stronger claim against fifty keys than it was
  // against thirteen, and the wording has to say so or the model reaches for it
  // at the old rate.
  it('tells the model that answering out of profile is now a strong claim', () => {
    const at = PROMPT.indexOf(`- ${DocumentType.OUT_OF_PROFILE.value}\n`);
    const paragraph = PROMPT.slice(at, at + 700);

    expect(paragraph).toContain('NOT ONE of the keys above');
    expect(paragraph).toContain('strong');
  });

  // A date in an entry is there to help recognise the paper. Whether a document
  // may be used given its date is the profile's question, and this task did not
  // answer it.
  it('forbids the model to reject a key on the document’s date', () => {
    expect(PROMPT).toContain(
      'never reject a key because the document is dated',
    );
  });

  // The word "JSON" is load-bearing: OpenAI refuses `response_format:
  // json_object` outright unless the conversation says it somewhere.
  it('says JSON and asks for one key, a confidence and a reason', () => {
    expect(PROMPT).toContain('JSON');
    expect(PROMPT).toContain('"type"');
    expect(PROMPT).toContain('"confidence"');
    expect(PROMPT).toContain('"reason"');
  });

  it('shows only the candidates it was given, not every profile there is', () => {
    const onlyIdentity = CADASTRE.filter(
      spec => spec.type.value === 'identity_card',
    );

    const narrowed = classificationInstructions(onlyIdentity);

    expect(narrowed).toContain('- identity_card\n');
    expect(narrowed).not.toContain('- payment_receipt\n');
  });
});

describe('readAnswer', () => {
  it('reads the object the model was asked for', () => {
    const answer = readAnswer(
      '{"type":"court_decision","confidence":0.9,"reason":"headed by a court"}',
    );

    expect(answer?.type).toBe('court_decision');
    expect(answer?.confidence).toBe(0.9);
  });

  it('reads the object out of a sentence the model wrapped it in', () => {
    const answer = readAnswer(
      'Here is my answer:\n{"type":"technical_passport"}\nHope that helps.',
    );

    expect(answer?.type).toBe('technical_passport');
  });

  it('reads an answer that left the confidence and the reason out', () => {
    expect(
      readAnswer('{"type":"power_of_attorney"}')?.confidence,
    ).toBeUndefined();
  });

  it('answers with nothing for a confidence outside nought to one', () => {
    expect(readAnswer('{"type":"court_decision","confidence":4}')).toBeNull();
  });

  it('answers with nothing for a bare key, which is the caller’s to salvage', () => {
    expect(readAnswer('court_decision')).toBeNull();
  });

  it('answers with nothing for text that is not JSON at all', () => {
    expect(readAnswer('I could not tell')).toBeNull();
  });
});

describe('matchKey', () => {
  const ALLOWED = [
    ...CADASTRE.map(spec => spec.type),
    ...CATALOGUE.types,
    DocumentType.OUT_OF_PROFILE,
    DocumentType.UNKNOWN,
  ];

  it('reads a key it was offered', () => {
    expect(matchKey('operation_permit', ALLOWED).value).toBe(
      'operation_permit',
    );
  });

  it('does not care how the model cased it', () => {
    expect(matchKey('Court_Decision', ALLOWED).value).toBe('court_decision');
  });

  // Two catalogue keys where one contains the other: the longer is the answer,
  // or the model's choice is silently narrowed to its own prefix.
  it('takes the longest key contained in an answer wrapped in a sentence', () => {
    expect(
      matchKey('this is a operation_acceptance_act, I think', ALLOWED).value,
    ).toBe('operation_acceptance_act');
  });

  it('falls back to unknown for a key nobody offered', () => {
    expect(matchKey('mortgage_deed', ALLOWED).value).toBe('unknown');
  });
});
