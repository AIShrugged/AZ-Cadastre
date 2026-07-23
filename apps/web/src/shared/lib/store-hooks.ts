import { useDispatch, useSelector } from "react-redux"
import type { ThunkDispatch, UnknownAction } from "@reduxjs/toolkit"

/**
 * App-independent, thunk-aware dispatch type. The precise store type lives in
 * `app/store`; lower layers (features, entities) only need a dispatch that
 * accepts thunks and actions, so this stays generic to avoid an upward import
 * into the app layer. Selectors carry their own (structural) state typing.
 */
export type AppDispatch = ThunkDispatch<unknown, unknown, UnknownAction>

export const useAppDispatch = () => useDispatch<AppDispatch>()

export const useAppSelector = useSelector
