import { combineReducers, configureStore } from '@reduxjs/toolkit'
import appReducer from './app-slice'

const rootReducer = combineReducers({
  app: appReducer,
  // Add slice and RTK Query api reducers here.
})

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    // Concat RTK Query api middleware here, e.g. `.concat(api.middleware)`.
    getDefaultMiddleware(),
})

export type RootState = ReturnType<typeof rootReducer>
export type AppStore = typeof store
export type AppDispatch = typeof store.dispatch
