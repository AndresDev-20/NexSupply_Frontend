import { configureStore } from '@reduxjs/toolkit'
import { setupListeners } from '@reduxjs/toolkit/query'
import { baseApi } from '../api/baseApi'
import { setAuthEventHandler, setBranchProvider } from '../api/httpClient'
import authReducer, { handleAuthEvent } from '../features/auth/authSlice'

// Se exporta una fábrica para que las pruebas creen un store limpio por caso
export function makeStore(preloadedState) {
  const store = configureStore({
    reducer: {
      [baseApi.reducerPath]: baseApi.reducer,
      auth: authReducer,
      // Fase 10: carrito del POS
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
    preloadedState,
  })

  // Vuelve a consultar al recuperar el foco o la conexión
  setupListeners(store.dispatch)

  // El cliente HTTP avisa aquí cuando la sesión termina o requiere cambio de contraseña
  setAuthEventHandler((event) => store.dispatch(handleAuthEvent(event)))

  // Cada petición viaja con la sede en la que se trabaja (Fase 17)
  setBranchProvider(() => store.getState().auth.activeBranchId)

  return store
}

export const store = makeStore()
