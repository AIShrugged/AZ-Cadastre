/**
 * supply-document — sending one document in for one of the gaps the package
 * publishes (COMM-80/COMM-81).
 *
 * Its own feature and not a mode of `upload-documents`, for the same reason the
 * contract publishes two operations: the batch is more of the envelope and
 * answers nothing in particular, while this file names the paper it is meant to
 * be and, on a replacement, the document it stands in for. Different asks,
 * different surfaces — a queue with a target bolted to it would have to mean
 * either "each of these" or "these together", and neither is something an
 * operator asks for.
 *
 * `DocumentGaps` is the whole panel, and it is what a surface mounts. The button
 * is not exported on its own: it is only ever correct beside the gap it was drawn
 * from, and handing it out would invite a screen to make up a target.
 */
export type { GapVoice } from './ui/document-gaps';
export { DocumentGaps } from './ui/document-gaps';
