import { combineReducers, configureStore } from '@reduxjs/toolkit'
import { api } from '@/shared/api'
import { uploadDocumentsReducer } from '@/features/upload-documents'
import appReducer from './app-slice'

const rootReducer = combineReducers({
  app: appReducer,
  uploadDocuments: uploadDocumentsReducer,
  [api.reducerPath]: api.reducer,
})

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(api.middleware),
})

export type RootState = ReturnType<typeof rootReducer>
export type AppStore = typeof store
export type AppDispatch = typeof store.dispatch
