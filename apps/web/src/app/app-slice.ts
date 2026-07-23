import { createSlice } from '@reduxjs/toolkit'

// Placeholder slice so the store has at least one valid reducer.
// Remove once real slices / RTK Query apis are added.
const appSlice = createSlice({
  name: 'app',
  initialState: { ready: true },
  reducers: {},
})

export default appSlice.reducer
