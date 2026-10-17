import { createSlice } from "@reduxjs/toolkit";

export const userslice = createSlice({
  name: "user",
  initialState: {
    user: null,
  },
  reducers: {
    login: (state, action) => {
      state.user = action.payload;
    },
    logout: (state) => {
      state.user = null;
    },
    setLanguage: (state, action) => {
  if (state.user) state.user.language = action.payload;
},
  },
});


export const { login, logout, setLanguage } = userslice.actions;
export const selectuser = (state) => state.user.user;
export default userslice.reducer;
