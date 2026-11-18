// Instancia única de Axios para toda la aplicación.
//
// Renovación automática de la sesión (decisión D3):
// 1. Una petición responde 401 TOKEN_EXPIRED (el token de acceso de 15 min venció).
// 2. Se llama UNA sola vez a /auth/refresh, aunque haya varias peticiones esperando.
// 3. Si renueva, se repite la petición original y el usuario no nota nada.
// 4. Si no puede renovar, se avisa a la aplicación que la sesión terminó.
import axios from 'axios'
import { env } from '../config/env'
import { normalizeApiError } from './apiError'

export const httpClient = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: env.apiTimeoutMs,
  // Envía las cookies httpOnly de sesión
  withCredentials: true,
  headers: {
    Accept: 'application/json',
    // Cabecera personalizada obligatoria: parte de la protección CSRF (decisión D3)
    'X-Requested-With': 'XMLHttpRequest',
  },
})

// Rutas donde un 401 es una respuesta normal y NO debe intentar renovar la sesión
const NO_REFRESH_PATHS = ['/auth/login', '/auth/refresh', '/auth/logout', '/auth/forgot-password', '/auth/reset-password']

/**
 * Eventos de sesión que la aplicación debe atender (los recibe el store):
 *   'expired'                   → la sesión terminó y no se pudo renovar
 *   'inactive'                  → el usuario fue desactivado
 *   'password_change_required'  → debe cambiar su contraseña antes de seguir
 */
let authEventHandler = () => {}
export function setAuthEventHandler(handler) {
  authEventHandler = handler
}

/**
 * Sede activa (Fase 17): el store dice en qué sede se trabaja y cada petición la envía en la
 * cabecera X-Branch-Id. El backend verifica que el usuario entre a esa sede.
 * Las rutas /auth no la llevan: allí se averigua precisamente a qué sedes entra.
 */
let branchProvider = () => null
export function setBranchProvider(provider) {
  branchProvider = provider
}

httpClient.interceptors.request.use((config) => {
  const branchId = branchProvider()
  if (branchId && !requestPath(config).startsWith('/auth/')) config.headers.set('X-Branch-Id', String(branchId))
  return config
})

let refreshInFlight = null

/** Renueva la sesión. Si ya hay una renovación en curso, espera esa misma. */
export function refreshSession() {
  if (!refreshInFlight) {
    refreshInFlight = httpClient.post('/auth/refresh').finally(() => {
      refreshInFlight = null
    })
  }
  return refreshInFlight
}

function requestPath(config) {
  return String(config?.url ?? '').split('?')[0]
}

async function handleResponseError(error) {
  // Un error que ya pasó por aquí (por ejemplo el del refresh) sale tal cual
  if (error?.isNormalized) return Promise.reject(error)

  const original = error?.config
  const status = error?.response?.status
  const code = error?.response?.data?.error?.code
  const path = requestPath(original)

  if (status === 401 && code === 'TOKEN_EXPIRED' && original && !original._retried && !NO_REFRESH_PATHS.includes(path)) {
    original._retried = true
    try {
      await refreshSession()
      return httpClient.request(original)
    } catch (refreshError) {
      authEventHandler(refreshError?.code === 'USER_INACTIVE' ? 'inactive' : 'expired')
      return Promise.reject(refreshError?.isNormalized ? refreshError : markNormalized(normalizeApiError(refreshError)))
    }
  }

  const normalized = markNormalized(normalizeApiError(error))

  // Fuera de /auth, estos códigos significan que la sesión dejó de servir
  if (!path.startsWith('/auth/')) {
    if (normalized.code === 'UNAUTHORIZED') authEventHandler('expired')
    if (normalized.code === 'USER_INACTIVE') authEventHandler('inactive')
  }
  if (normalized.code === 'PASSWORD_CHANGE_REQUIRED') authEventHandler('password_change_required')

  return Promise.reject(normalized)
}

// Marca no enumerable: no aparece al mostrar o comparar el error
function markNormalized(normalized) {
  if (!normalized.isNormalized) Object.defineProperty(normalized, 'isNormalized', { value: true, enumerable: false })
  return normalized
}

// Todo error sale ya normalizado: { status, code, message, details, requestId }
httpClient.interceptors.response.use((response) => response, handleResponseError)
