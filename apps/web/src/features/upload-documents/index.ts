/**
 * upload-documents — the feature that lets an inspector attach submitted
 * documents to a new Verification Package: a dropzone, per-file transfer with
 * progress, and validation. State lives in the `uploadDocuments` slice; the
 * transport (`api/upload-api`) is a fake for now.
 */

// Public UI
export { Dropzone } from "./ui/dropzone"
export { UploadedList } from "./ui/uploaded-list"

// Model — reducer (register in the store), thunks, selectors, types
export { default as uploadDocumentsReducer } from "./model/slice"
export {
  enqueueDocuments,
  removeDocument,
  clearDocuments,
  allCleared,
} from "./model/slice"
export {
  selectDocuments,
  selectValidCount,
  selectReadyCount,
} from "./model/selectors"
export type {
  Attachment,
  FileKind,
  UploadStatus,
  UploadErrorKind,
} from "./model/types"

// Constants for the picker/input in the host surface
export { ACCEPT, MAX_MB, MAX_BYTES } from "./lib/file"
