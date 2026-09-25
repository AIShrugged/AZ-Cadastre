import {
  VerificationProfile,
  type DocumentTypeSpec,
} from '../../../domain/value-objects/index.js';

/*
 * What the reader of a document is told: the paper it is holding, the keys the
 * profile asks of that paper, and what each of those keys means where its name
 * is not enough. Pure and apart from the adapter that calls OpenRouter, for the
 * reason the classifier's prompt is (`classifier-prompt.ts`): since the schemas
 * were brought up to the acceptance contract this is a long statement of what
 * to read off a sheet, and a statement that long is worth asserting on without
 * a network client in the way.
 */
export function extractionInstructions(spec: DocumentTypeSpec): string {
  return [
    'You read structured values off one scanned document submitted to the',
    'Azerbaijani real estate registration authority. The applicant handed it',
    'in over the counter; an inspector is checking the values you return',
    'against the sheets themselves.',
    '',
    `The document is a ${spec.type.value}. ${spec.description}`,
    '',
    'You are given each of its sheets twice: as a transcription and as the',
    'scan the transcription was made from. Where they disagree, the scan is',
    'the document and the transcription is one reading of it. Transcription',
    'marks: [hw: ...] handwritten, [stamp: ...] a stamp, <?text> a doubtful',
    'reading, [blank page] an empty sheet.',
    '',
    'Its text is usually Azerbaijani (Latin or Cyrillic script), sometimes',
    'Russian or English.',
    '',
    'Return JSON. For each key below give an object, or null when the document',
    'does not carry that value. Use ONLY these keys:',
    fieldList(spec),
    '',
    'Shape: {"fields":{"<key>":{"value":"<as printed>","sheet":<the sheet',
    'number you read it on>,"evidence":"<a short literal quote from that',
    'sheet\'s transcription containing the value>","confidence":<0..1>}}}',
    '',
    'Rules:',
    '- Transcribe values exactly as printed, in their own script. Do not',
    '  translate, transliterate or expand names and addresses.',
    '- Give a name in its base form. Azerbaijani prints names in oblique cases',
    '  on forms — "Əliyeva Rübabə Kavı qızına" is the same name as "Əliyeva',
    '  Rübabə Kavı qızı"; return the base form, without the case ending.',
    '- Write every date as DD.MM.YYYY, whatever form it appears in. Never',
    '  adjust a year to make it look plausible: copy the year that is printed.',
    // A paper that amends, extracts from or reports on another paper states
    // that other paper's date as well, and states it where a reader looks for
    // a date: in the printed subject line above the body, while the paper's
    // own date is filled in by hand on the blank. Reading the cited date as
    // the document's own is COMM-169.
    "- A date key means this document's own date, unless the key says",
    '  otherwise. A document that amends, extracts from, cites or reports on',
    '  another one states that other date too, often in its subject line:',
    "  that is not this document's date. A day or a month filled in by hand",
    "  on a printed blank is this document's date as much as a printed one.",
    '- A surname printed in capitals stays in capitals.',
    '- Give the value alone, without its printed label.',
    // The contract asks a drawing for its turning points, its drawing schedule
    // and its span dimensions — values a sheet prints as a list and not as one
    // word. Without this the model answers with the first entry and the rest of
    // the list is lost silently.
    '- Where a key asks for several values the sheet prints as a list, give',
    '  them all as one value, in the order printed, separated by semicolons.',
    '  Give what is printed and nothing more: never extend, renumber or',
    '  complete a list.',
    // Two figures printed side by side under one heading — a documentary area
    // and an actual one — are the case a reader is most likely to answer twice
    // with the same number. One sheet, two keys, and the sheet may state only
    // one of them.
    '- Two keys are two values. Where the document states one of a pair and',
    '  not the other, answer the one it states and give null for the other —',
    '  never copy a figure across to fill a key in.',
    "- `evidence` must be text that actually appears in that sheet's",
    '  transcription. If you read the value off the scan and the transcription',
    '  does not contain it, give the nearest text that does appear, or an',
    '  empty string — never invent a quote.',
    '- `confidence` is your own: how sure you are of this value, on this',
    '  document. Say 0.3 when you are guessing at faint handwriting.',
    '- Never infer, compute or invent a value that is not on the document.',
    '  A null is worth more to the inspector than a plausible guess: they',
    '  check the ones we return.',
  ].join('\n');
}

/*
 * The keys, each with its label and — where the profile declared one — the
 * sentence that says which value is meant. Indented under the key rather than
 * run onto its line so that a key still reads as a key in a list of twenty.
 *
 * `qr_code` is left out of the list although the schema declares it: the code
 * is decoded from the symbol and never read off the page (ADR-0034). Asked for
 * it, a reader answers with the mark the transcription puts where the picture
 * was — `[QR code]` — and a value that describes a picture is worse than no
 * value, because the rest of the system cannot tell it from a code.
 */
function fieldList(spec: DocumentTypeSpec): string {
  return spec.schema.specs
    .filter(field => !field.key.equals(VerificationProfile.QR_CODE))
    .map(field =>
      field.note === null
        ? `- ${field.key.value}: ${field.label}`
        : `- ${field.key.value}: ${field.label}\n    ${field.note}`,
    )
    .join('\n');
}
