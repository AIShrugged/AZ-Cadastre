import { createSelector } from "@reduxjs/toolkit"

import type { Attachment } from "./types"

/**
 * The slice of app state this feature mounts under. Typed structurally so the
 * selectors compose with the full RootState (defined in app/store) without an
 * upward import into the app layer.
 */
type MountedState = { uploadDocuments: { files: Attachment[] } }

export const selectDocuments = (state: MountedState) => state.uploadDocuments.files

/** Files that count toward the package (anything not rejected outright). */
export const selectValidCount = createSelector(
  selectDocuments,
  (files) => files.filter((f) => f.status !== "error").length,
)

/** Files fully transferred and read. */
export const selectReadyCount = createSelector(
  selectDocuments,
  (files) => files.filter((f) => f.status === "ready").length,
)
