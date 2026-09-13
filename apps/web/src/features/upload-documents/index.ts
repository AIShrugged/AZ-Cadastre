/**
 * upload-documents — the feature that lets an inspector attach submitted
 * documents to a Verification Package: a dropzone, per-file transfer with
 * progress, and validation. State lives in the `uploadDocuments` slice.
 *
 * One feature and not two, for a new package and an open one alike: the bytes
 * take one road to the store — `uploadDocument` in `shared/api`, the same one
 * every other surface that sends a file uses — and the keys are handed to
 * whichever operation the surface is for. `AddFiles` is the whole panel for an
 * open package; `Dropzone` and `UploadedList` are the parts, for a surface that
 * arranges them itself.
 *
 * The batch and the targeted supply are two features and not one: this one is
 * more of the envelope, answering nothing in particular, and `supply-document`
 * sends one file in for one published gap. They are different asks, and the
 * contract publishes them as two operations for the same reason.
 */

// Public UI
export { AddFiles } from './ui/add-files';
export { Dropzone } from './ui/dropzone';
export { UploadedList } from './ui/uploaded-list';

// Model — reducer (register in the store), thunks, selectors, types
export { default as uploadDocumentsReducer } from './model/slice';
export {
  enqueueDocuments,
  removeDocument,
  clearDocuments,
  allCleared,
} from './model/slice';
export {
  selectDocuments,
  selectValidCount,
  selectReadyCount,
} from './model/selectors';
export { attachedFiles } from './lib/attached';
export type {
  Attachment,
  FileKind,
  UploadStatus,
  UploadErrorKind,
} from './model/types';

/*
 * What file the store takes — the extensions, the ceiling and the `accept`
 * string — is NOT re-exported here. It is one rule for every surface that offers
 * a picker, so it lives in `@/shared/lib/document-file` and each of them imports
 * it from there rather than through whichever feature happened to own it first.
 */
