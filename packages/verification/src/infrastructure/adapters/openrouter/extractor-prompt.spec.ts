import { describe, expect, it } from 'vitest';

import {
  DocumentType,
  VerificationProfile,
} from '../../../domain/value-objects/index.js';

import { extractionInstructions } from './extractor-prompt.js';

const specOf = (type: string) =>
  VerificationProfile.CADASTRE.specFor(DocumentType.create(type));

const PLAN_SCHEME = specOf('land_plot_plan');
const SKETCH_DESIGN = specOf('sketch_project');

describe('extractionInstructions', () => {
  it('asks for every key the type declares, and names the type it is reading', () => {
    for (const spec of VerificationProfile.CADASTRE.specs) {
      const prompt = extractionInstructions(spec);

      expect(prompt).toContain(spec.type.value);
      for (const field of spec.schema.specs) {
        expect(prompt).toContain(`- ${field.key.value}: ${field.label}`);
      }
    }
  });

  // A key the prompt never mentions can never be answered, however carefully
  // the profile declares it.
  it('offers no key the type does not declare', () => {
    const prompt = extractionInstructions(PLAN_SCHEME);

    expect(prompt).not.toContain('- receipt_no:');
    expect(prompt).not.toContain('- building_height:');
  });

  /*
   * The note is the whole reason a schema of nineteen keys can be read at all:
   * `plot_area` and `actual_area` are two figures printed under one heading,
   * and a reader shown only their labels answers both with the same number.
   */
  it('says of every declared note what the label had no room for', () => {
    for (const spec of VerificationProfile.CADASTRE.specs) {
      const prompt = extractionInstructions(spec);

      for (const field of spec.schema.specs) {
        if (field.note === null) continue;

        expect(prompt).toContain(field.note);
      }
    }
  });

  it('puts each note under the key it belongs to', () => {
    const prompt = extractionInstructions(PLAN_SCHEME);
    const area = PLAN_SCHEME.schema.specs.find(
      spec => spec.key.value === 'actual_area',
    )!;

    expect(prompt).toContain(
      `- ${area.key.value}: ${area.label}\n    ${area.note}`,
    );
  });

  it('tells the reader the two areas of a plan-scheme are two values', () => {
    const prompt = extractionInstructions(PLAN_SCHEME);

    expect(prompt).toMatch(/never copy a figure across to fill a key in/i);
    expect(prompt).toMatch(/documentary figure/i);
  });

  /*
   * The turning points, the drawing schedule and the span dimensions are
   * printed as lists. Without this rule the model answers with the first entry
   * and the rest is lost with nothing saying so.
   */
  it('tells the reader what to do with a value printed as a list', () => {
    const prompt = extractionInstructions(PLAN_SCHEME);

    expect(prompt).toMatch(/separated by semicolons/i);
    expect(prompt).toMatch(/never extend, renumber or/i);
  });

  // The figure the supporting-documents branch turns on (ADR-0013). Measured
  // to the ridge instead, the case is sent to the wrong band in silence.
  it('says where the height on the section is measured from and to', () => {
    const prompt = extractionInstructions(SKETCH_DESIGN);

    expect(prompt).toContain('±0.000');
    expect(prompt).toContain('UPCC 80.1');
  });

  it('says the storeys are counted off the floor plans of the set', () => {
    expect(extractionInstructions(SKETCH_DESIGN)).toMatch(/floor plans/i);
  });

  // The value is what the sheet prints, and a QR code prints nothing a reader
  // can quote. A decoded guess is a value the inspector cannot check.
  it('forbids reading the picture of a QR code', () => {
    expect(extractionInstructions(PLAN_SCHEME)).toMatch(
      /never read the picture of the code/i,
    );
  });

  it('keeps telling the reader that an absent value is a null and not a guess', () => {
    const prompt = extractionInstructions(SKETCH_DESIGN);

    expect(prompt).toMatch(/never infer, compute or invent a value/i);
    expect(prompt).toContain('null');
  });

  // The word "JSON" is load-bearing: OpenAI refuses `response_format:
  // json_object` outright unless the conversation says it somewhere.
  it('says the word the response format is refused without', () => {
    expect(extractionInstructions(PLAN_SCHEME)).toContain('JSON');
  });

  it('asks nothing of a type the profile does not recognise', () => {
    const stray = specOf('invoice');

    expect(stray.schema.isEmpty).toBe(true);
    expect(extractionInstructions(stray)).toContain('invoice');
  });
});
