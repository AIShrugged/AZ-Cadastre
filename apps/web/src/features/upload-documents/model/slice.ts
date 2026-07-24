import {
  createSlice,
  nanoid,
  type PayloadAction,
} from "@reduxjs/toolkit"
import axios from "axios"

import type { AppDispatch } from "@/shared/lib/store-hooks"
import { uploadDocument } from "../api/upload-api"
import { fileKind, MAX_BYTES } from "../lib/file"
import type { Attachment } from "./types"

type UploadDocumentsState = {
  files: Attachment[]
}

const initialState: UploadDocumentsState = {
  files: [],
}

/**
 * In-flight aborters, kept outside the store because `AbortController` is not
 * serializable. Keyed by attachment id; used to cancel a transfer when its row
 * is removed or the list is cleared.
 */
const aborters = new Map<string, AbortController>()

const uploadDocumentsSlice = createSlice({
  name: "uploadDocuments",
  initialState,
  reducers: {
    fileAdded(state, action: PayloadAction<Attachment>) {
      state.files.push(action.payload)
    },
    fileRemoved(state, action: PayloadAction<string>) {
      state.files = state.files.filter((f) => f.id !== action.payload)
    },
    allCleared(state) {
      state.files = []
    },
    uploadProgress(
      state,
      action: PayloadAction<{ id: string; progress: number }>,
    ) {
      const f = state.files.find((f) => f.id === action.payload.id)
      if (f && f.status === "uploading") f.progress = action.payload.progress
    },
    uploadSucceeded(
      state,
      action: PayloadAction<{
        id: string
        key: string
        contentType: Attachment["contentType"]
      }>,
    ) {
      const f = state.files.find((f) => f.id === action.payload.id)
      if (f) {
        f.status = "ready"
        f.progress = 100
        f.key = action.payload.key
        f.contentType = action.payload.contentType
      }
    },
    uploadFailed(state, action: PayloadAction<{ id: string }>) {
      const f = state.files.find((f) => f.id === action.payload.id)
      if (f) {
        f.status = "error"
        f.error = "failed"
      }
    },
  },
})

export const {
  fileAdded,
  fileRemoved,
  allCleared,
  uploadProgress,
  uploadSucceeded,
  uploadFailed,
} = uploadDocumentsSlice.actions

export default uploadDocumentsSlice.reducer

// ─── Thunks ───────────────────────────────────────────────────────────────────

/** Validate, register, and begin transfer for a batch of picked/dropped files. */
export function enqueueDocuments(list: FileList | File[]) {
  return (dispatch: AppDispatch) => {
    for (const file of Array.from(list)) {
      const id = nanoid()
      const kind = fileKind(file.name)

      if (!kind) {
        dispatch(
          fileAdded({
            id,
            name: file.name,
            size: file.size,
            kind: "image",
            status: "error",
            progress: 0,
            error: "format",
          }),
        )
        continue
      }
      if (file.size > MAX_BYTES) {
        dispatch(
          fileAdded({
            id,
            name: file.name,
            size: file.size,
            kind,
            status: "error",
            progress: 0,
            error: "size",
          }),
        )
        continue
      }

      dispatch(
        fileAdded({
          id,
          name: file.name,
          size: file.size,
          kind,
          status: "uploading",
          progress: 0,
        }),
      )
      dispatch(startUpload(id, file))
    }
  }
}

/** Drive one file's transfer, translating transport events into store actions. */
function startUpload(id: string, file: File) {
  return async (dispatch: AppDispatch) => {
    const controller = new AbortController()
    aborters.set(id, controller)
    try {
      const { key, contentType } = await uploadDocument(file, {
        signal: controller.signal,
        onProgress: (progress) => dispatch(uploadProgress({ id, progress })),
      })
      dispatch(uploadSucceeded({ id, key, contentType }))
    } catch (err) {
      // A removed/cleared row aborts its own transfer — that's not a failure.
      if (axios.isCancel(err)) return
      dispatch(uploadFailed({ id }))
    } finally {
      aborters.delete(id)
    }
  }
}

/** Remove a file and cancel its transfer if still running. */
export function removeDocument(id: string) {
  return (dispatch: AppDispatch) => {
    aborters.get(id)?.abort()
    aborters.delete(id)
    dispatch(fileRemoved(id))
  }
}

/** Clear the whole list, cancelling any in-flight transfers. */
export function clearDocuments() {
  return (dispatch: AppDispatch) => {
    for (const controller of aborters.values()) controller.abort()
    aborters.clear()
    dispatch(allCleared())
  }
}
