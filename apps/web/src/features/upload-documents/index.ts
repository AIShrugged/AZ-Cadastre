/**
 * upload-documents — the feature that lets an inspector attach submitted
 * documents to a Verification Package: a dropzone, per-file transfer with
 * progress, and validation. State lives in the `uploadDocuments` slice.
 *
 * One feature and not two, for a new package and an open one alike: the bytes
 * take one road to the store — `documents/presign` signs the URL, the browser
 * PUTs, and the keys are handed to whichever operation the surface is for — and
 * a second copy of that road is exactly what the contract forbids. `AddFiles`
 * is the whole panel for an open package; `Dropzone` and `UploadedList` are the
 * parts, for a surface that arranges them itself.
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

// Constants for the picker/input in the host surface
export { ACCEPT, MAX_MB, MAX_BYTES } from './lib/file';
