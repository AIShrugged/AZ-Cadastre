import { z } from 'zod';

import {
  DocumentCatalogue,
  DocumentType,
  type DocumentTypeSpec,
} from '../../../domain/value-objects/index.js';

/*
 * What the classifier is told and how its answer is read back. Pure and apart
 * from the adapter that calls OpenRouter, because the prompt is now the longest
 * single statement of policy in the context — the profile's own types, then the
 * statutory catalogue of grounds (ADR-0022) — and a statement that long is
 * worth asserting on without a network client in the way.
 */

export const AnswerSchema = z.object({
  type: z.string(),
  confidence: z.number().min(0).max(1).nullish(),
  reason: z.string().nullish(),
});

export type ClassifierAnswer = z.infer<typeof AnswerSchema>;

export function classificationInstructions(
  candidates: readonly DocumentTypeSpec[],
): string {
  return [
    'You classify one scanned document submitted to the Azerbaijani real',
    'estate registration authority. You are given its transcribed text — one',
    'document, though it may run over several sheets.',
    '',
    'The text is usually Azerbaijani (Latin script), sometimes Azerbaijani in',
    'Cyrillic script, sometimes Russian or English, and often a mix.',
    'Transcription is imperfect: headings may be misspelled, diacritics',
    'dropped (ə→e, ı→i, ş→s) and letters confused. Handwriting is marked',
    '[hw: ...], stamps [stamp: ...], doubtful readings <?like this>, and a',
    'blank sheet [blank page]. Judge by what the document evidently IS, not by',
    'an exact string match.',
    '',
    'Choose exactly one type key. The keys come in groups; read the group',
    'headings, they say what kind of paper each group holds.',
    '',
    'WHAT THE PROFILE ASKS FOR — only these answer a requirement:',
    '',
    ...candidates.map(candidate => describe(candidate)),
    '',
    'The groups below are NOT what the profile asks for. They are the papers',
    'that arrive in the same envelope anyway — the statutory grounds a right',
    'is registered on, the papers of the application, the service sheets of',
    'the registry — and naming one of them is a correct answer, not a',
    'failure: it tells the inspector what the sheet is instead of only what',
    'it is not. Several of these papers are described by the date they were',
    'issued in. The date is there to help you recognise the paper and for no',
    'other purpose: never reject a key because the document is dated outside',
    'the window, and never report the date as a fault. That is the profile’s',
    'question, not yours.',
    ...DocumentCatalogue.KNOWN.groups.flatMap(group => [
      '',
      `${group.title}:`,
      '',
      ...group.entries.map(entry => describe(entry)),
    ]),
    '',
    `- ${DocumentType.OUT_OF_PROFILE.value}`,
    '  You can tell what this document is and NOT ONE of the keys above names',
    '  it: neither a type of the profile, nor any ground under the Law or the',
    '  Decree, nor a paper of the application, nor a service sheet. The lists',
    '  above are the whole statutory catalogue of grounds plus everything a',
    '  submission is normally accompanied by, so this answer is a strong',
    '  claim — reach for a key above whenever the document is plausibly one of',
    '  them, and keep this one for a paper belonging to another matter',
    '  entirely. The package is expected to carry such documents; saying so is',
    '  a correct answer, not a failure.',
    '',
    `- ${DocumentType.UNKNOWN.value}`,
    '  You cannot tell what it is: the text is too damaged, too sparse, or',
    '  says nothing about what record it belongs to. Prefer this over a guess',
    '  you are not reasonably sure of — a wrong type is worse for the',
    "  inspector than an honest 'unknown'. Do NOT use it merely because the",
    `  document is not in the profile; that is ${DocumentType.OUT_OF_PROFILE.value}.`,
    '',
    'Weigh the whole document, above all its heading and its issuing body.',
    'A type mentioned in passing — a licence number quoted on an application —',
    'does not make the document that type. Annexes, licences and drawing sets',
    'belong to the document they were issued for.',
    '',
    // The word "JSON" is load-bearing: OpenAI refuses `response_format:
    // json_object` outright — 400, no completion — unless the conversation
    // says it somewhere.
    'Reply with ONLY this JSON object:',
    '{"type":"<key>","confidence":<0..1, how sure you are of that key>,',
    '"reason":"<up to 12 words>"}',
  ].join('\n');
}

function describe(candidate: DocumentTypeSpec): string {
  const headings = candidate.hints.map(hint => `"${hint}"`).join(', ');

  return [
    `- ${candidate.type.value}`,
    `  ${candidate.description}`,
    `  Usually headed: ${headings}.`,
  ].join('\n');
}

// The model's answer, or null when it wrote something that is not the object it
// was asked for. A model that answered with a bare key rather than an object is
// still answering, and `matchKey` reads the key straight out of the raw text —
// so null here is a fact to log, not a failure to raise.
export function readAnswer(raw: string): ClassifierAnswer | null {
  const json = raw.match(/\{[\s\S]*\}/)?.[0] ?? raw;

  try {
    const parsed = AnswerSchema.safeParse(JSON.parse(json));
    if (parsed.success) return parsed.data;
  } catch {
    // Not JSON at all. Same answer: nothing was read.
  }

  return null;
}

export function matchKey(
  raw: string,
  allowed: readonly DocumentType[],
): DocumentType {
  const answer = raw.toLowerCase();
  const exact = allowed.find(type => type.value === answer);
  if (exact) return exact;
  // The longest key contained in the answer, so "license_annex" is not read
  // as "license" when the model wrapped its choice in a sentence.
  const contained = allowed
    .filter(type => answer.includes(type.value))
    .sort((left, right) => right.value.length - left.value.length);

  return contained[0] ?? DocumentType.UNKNOWN;
}
