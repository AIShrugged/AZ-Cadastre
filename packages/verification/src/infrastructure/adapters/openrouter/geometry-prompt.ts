import type { DocumentTypeSpec } from '../../../domain/value-objects/index.js';

/*
 * What a reader of a drawing's geometry is told (COMM-165).
 *
 * Pure and apart from the adapter for the reason the extractor's instructions
 * are: this is the whole of what decides whether the picture an inspector opens
 * shows the axes of the drawing or shapes a reader invented, and a statement
 * that consequential is worth asserting on without a network client in the way.
 *
 * Two rules here are the same rules the span calculation is held to, and they
 * are repeated rather than referenced because a reader is told one thing at a
 * time: figures are copied as printed and never converted (ADR-0043), and a set
 * that marks no circled axes has none — the answer is an empty list of axes and
 * never gaps numbered by the reader (ADR-0044, COMM-160).
 */
export function geometryInstructions(spec: DocumentTypeSpec): string {
  return [
    'You read the geometry of building drawings. You are given the sheets of',
    'one set, each as a transcription and as the scan it was made from. For',
    'each sheet that carries a floor plan, a foundation plan or a roof plan,',
    'return the shapes on it. Ignore covers, general notes, location plans,',
    'site plans, sections and elevations: answer with no entry for them.',
    '',
    `The document is a ${spec.type.value}. ${spec.description}`,
    '',
    'All coordinates are fractions of the WHOLE IMAGE you were shown: x is 0 at',
    'the left edge of the image and 1 at its right edge, y is 0 at the top edge',
    'and 1 at the bottom. The image is the whole sheet — its border, its title',
    'block, its tables and the white margin around the drawing — and the plan',
    'itself usually occupies only part of it. x=0 is NOT the left edge of the',
    'plan. Give four decimal places. Never give a pixel.',
    '',
    'Before you answer, locate the plan on the image and note the fractions its',
    'left, right, top and bottom edges fall at. Every outline, axis and',
    'dimension line you return must lie inside those four numbers, and a room',
    'outline must enclose the name you read inside that room.',
    '',
    'Each picture is preceded by a line reading `--- SHEET n ---`. That `n` is',
    'what `sheet` must be: a number, not a string, and NOT the sheet number',
    "printed in the drawing's own title block, which is numbered differently.",
    '',
    'Return JSON, and only JSON:',
    '{"sheets":[{"sheet":<the number in this sheet\'s SHEET line>,',
    '  "rooms":[{"label":"<the name printed inside the room, or null>",',
    '    "outline":[{"x":0.0,"y":0.0}, …],',
    '    "walls":[{"from":<corner index>,"to":<corner index>,',
    '      "printed":"<the figure printed along this wall, or null>"}]}],',
    '  "axes":[{"mark":"<as printed in the circle>",',
    '    "from":{"x":0.0,"y":0.0},"to":{"x":0.0,"y":0.0}}],',
    '  "chains":[{"from":"<axis>","to":"<axis>","printed":"<the figure>",',
    '    "at":[{"x":0.0,"y":0.0},{"x":0.0,"y":0.0}]}]}]}',
    '',
    'Rules:',
    '- `outline` walks the corners of one room in order, all the way round;',
    '  do not repeat the first corner at the end. A room is at least three',
    '  corners. `walls` names corners by their position in `outline`, counting',
    '  from 0.',
    '- `printed` is copied exactly as it appears on the sheet — decimal comma',
    '  and all — and carries a unit only where one is printed beside the',
    '  figure. Never convert a figure and never work one out. Where no figure',
    '  is printed along a wall, `printed` is null.',
    '- An axis is a mark in a CIRCLE at the end of a line that runs across the',
    '  plan: the numerals 1, 2, 3 in one direction and the letters A, B, C in',
    '  the other. `mark` is what is printed in the circle.',
    '- Many sets dimension rooms and mark no axes at all. Where this sheet',
    '  carries no circled axis marks, `axes` and `chains` are empty lists. Do',
    '  NOT number the gaps between rooms yourself, do not treat a room',
    '  dimension as an axis spacing, and do not treat the mark at each end of',
    '  a cutting line — "1-1", "2-2", "A-A" — or a letter labelling a building',
    '  on a site plan as an axis.',
    '- `chains` is the dimension line that runs along the axes: one entry per',
    '  pair of ADJACENT axes, `at` being the two ends of that one dimension',
    '  segment. Leave out the overall dimension of the building and the outer',
    '  chain taken over the walls.',
    '- Answer only about what you can see. A sheet you can make nothing of',
    '  gets no entry; that is a better answer than a plausible one.',
  ].join('\n');
}
