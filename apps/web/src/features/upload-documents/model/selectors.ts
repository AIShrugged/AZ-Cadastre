import { createSelector } from "@reduxjs/toolkit"

import type { RootState } from "@/store/store"

export const selectDocuments = (state: RootState) => state.uploadDocuments.files

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
