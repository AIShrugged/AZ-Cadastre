import { describe, expect, it } from 'vitest';

import {
  DocumentType,
  VerificationProfile,
} from '../../../domain/value-objects/index.js';

import { extractionInstructions } from './extractor-prompt.js';

// Declared by the profile and never asked of a reader: it is decoded off the
// symbol on the sheet (ADR-0034).
const DECODED = VerificationProfile.QR_CODE;

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
        if (field.key.equals(DECODED)) continue;

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
        if (field.note === null || field.key.equals(DECODED)) continue;

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

  // One of the figures the provision of Article 8 turns on (ADR-0025). Measured
  // to the ridge instead, the case is placed under the wrong provision in
  // silence.
  it('says where the height on the section is measured from and to', () => {
    const prompt = extractionInstructions(SKETCH_DESIGN);

    expect(prompt).toContain('±0.000');
    expect(prompt).toContain('UPCC 80.1');
  });

  it('says the storeys are counted off the floor plans of the set', () => {
    expect(extractionInstructions(SKETCH_DESIGN)).toMatch(/floor plans/i);
  });

  /*
   * A reader asked for a QR code answers with the mark the transcription puts
   * where the picture was — `[QR code]` — and that value is worse than none: it
   * is non-empty, so everything downstream reads it as a code that was
   * successfully read, and the report then says nothing at all about a step
   * that never happened. This is the whole of COMM-133 (ADR-0034).
   */
  it('never asks a reader for a QR code, on any type that prints one', () => {
    for (const type of VerificationProfile.CADASTRE.qrCarriers) {
      const prompt = extractionInstructions(
        VerificationProfile.CADASTRE.specFor(type),
      );

      expect(prompt, `${type.value} was asked for its QR code`).not.toContain(
        '- qr_code:',
      );
    }
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
