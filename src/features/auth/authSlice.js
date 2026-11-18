// Estado de la sesión en Redux.
//
// status:
//   'checking'        → al abrir la app, mientras se consulta /auth/me
//   'authenticated'   → hay usuario
//   'unauthenticated' → no hay sesión
// notice: aviso para la pantalla de inicio de sesión ('expired' | 'inactive' | 'logged_out')
// user.permissions: permisos efectivos (rol + plan) calculados por el backend
// plan: { code, name, features, limits } del plan contratado
// branches: sedes a las que entra el usuario; activeBranchId: la sede en la que trabaja (Fase 17)
import { createSlice } from '@reduxjs/toolkit'
import { authApi } from './authApi'
import { baseApi } from '../../api/baseApi'
import { readStoredBranch, writeStoredBranch } from './activeBranch'

// welcome: datos para la animación de bienvenida tras un inicio de sesión exitoso
// (solo al iniciar sesión, no al restaurar una sesión existente)
const initialState = { status: 'checking', user: null, plan: null, branches: [], activeBranchId: null, notice: null, welcome: null }

/**
 * Sede en la que se trabaja: la que se escogió en esta pestaña si sigue disponible,
 * si no la principal del usuario, si no la primera (D-INT-3).
 */
function pickBranch(branches, user, wanted) {
  const has = (id) => branches.some((branch) => branch.id === id)
  if (wanted && has(wanted)) return wanted
  if (user?.branch?.id && has(user.branch.id)) return user.branch.id
  return branches[0]?.id ?? null
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    sessionEnded(state, action) {
      state.status = 'unauthenticated'
      state.user = null
      state.plan = null
      state.branches = []
      state.activeBranchId = null
      state.notice = action.payload ?? null
      state.welcome = null
    },
    passwordChangeRequired(state) {
      if (state.user) state.user.mustChangePassword = true
    },
    branchSelected(state, action) {
      if (state.branches.some((branch) => branch.id === action.payload)) state.activeBranchId = action.payload
    },
    noticeCleared(state) {
      state.notice = null
    },
    welcomeFinished(state) {
      state.welcome = null
    },
  },
  extraReducers: (builder) => {
    const setSession = (state, action) => {
      state.status = 'authenticated'
      state.user = action.payload.user
      state.plan = action.payload.plan ?? null
      state.branches = action.payload.branches ?? []
      state.activeBranchId = pickBranch(state.branches, state.user, state.activeBranchId ?? readStoredBranch())
      state.notice = null
    }

    builder
      .addMatcher(authApi.endpoints.getMe.matchFulfilled, setSession)
      .addMatcher(authApi.endpoints.login.matchFulfilled, (state, action) => {
        setSession(state, action)
        state.welcome = { fullName: action.payload.user.fullName }
      })
      .addMatcher(authApi.endpoints.getMe.matchRejected, (state, action) => {
        // Una consulta cancelada no dice nada sobre la sesión
        if (action.meta?.condition || action.error?.name === 'AbortError') return
        if (state.status === 'checking') state.status = 'unauthenticated'
      })
      .addMatcher(authApi.endpoints.changePassword.matchFulfilled, (state, action) => {
        state.user = action.payload.user
      })
  },
})

export const { sessionEnded, passwordChangeRequired, branchSelected, noticeCleared, welcomeFinished } = authSlice.actions
export default authSlice.reducer

// Selectores
export const selectAuth = (state) => state.auth
export const selectCurrentUser = (state) => state.auth.user
export const selectPlan = (state) => state.auth.plan
export const selectBranches = (state) => state.auth.branches
export const selectActiveBranchId = (state) => state.auth.activeBranchId
export const selectActiveBranch = (state) => state.auth.branches.find((branch) => branch.id === state.auth.activeBranchId) ?? null

const EMPTY = []
export const selectPermissions = (state) => state.auth.user?.permissions ?? EMPTY

/** Consulta /auth/me al abrir la aplicación (renueva la sesión si el token venció). */
export const restoreSession = () => (dispatch) =>
  dispatch(authApi.endpoints.getMe.initiate(undefined, { subscribe: false, forceRefetch: true }))

/**
 * Cierra la sesión: avisa al servidor, limpia el estado y borra el caché de datos.
 * Aunque el servidor falle, la sesión local se cierra igual.
 */
export const logoutUser = () => async (dispatch) => {
  try {
    await dispatch(authApi.endpoints.logout.initiate()).unwrap()
  } finally {
    dispatch(sessionEnded('logged_out'))
    dispatch(baseApi.util.resetApiState())
  }
}

/**
 * Cambia la sede en la que se trabaja (solo en esta pestaña). Se borra el caché para que
 * todas las pantallas vuelvan a pedir sus datos a la sede nueva.
 */
export const selectBranch = (branchId) => (dispatch, getState) => {
  if (branchId === getState().auth.activeBranchId) return
  dispatch(branchSelected(branchId))
  if (getState().auth.activeBranchId !== branchId) return
  writeStoredBranch(branchId)
  dispatch(baseApi.util.resetApiState())
}

/** Traduce los eventos del cliente HTTP (ver httpClient.js) a acciones del store. */
export const handleAuthEvent = (event) => (dispatch, getState) => {
  if (event === 'password_change_required') {
    dispatch(passwordChangeRequired())
    return
  }
  // Solo tiene sentido terminar una sesión que existe
  if (getState().auth.status !== 'authenticated') return
  dispatch(sessionEnded(event))
  dispatch(baseApi.util.resetApiState())
}
