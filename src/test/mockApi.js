// Simula el backend reemplazando el "adapter" de Axios (la pieza que hace la
// petición real). Así las pruebas pasan por los interceptores verdaderos:
// normalización de errores y renovación automática de la sesión.
import { AxiosError } from 'axios'
import { httpClient } from '../api/httpClient'

/**
 * Al terminar cada prueba ninguna petición debe salir a la red: si la aplicación todavía montada pide
 * algo (un aviso que se refresca, una pantalla que se recarga), recibe "sin conexión" en vez de
 * intentar una petición real que jsdom no puede hacer (y que ensuciaba la corrida).
 */
export function restoreApi() {
  httpClient.defaults.adapter = (config) => Promise.reject(new AxiosError('Network Error', AxiosError.ERR_NETWORK, config, {}))
}

/** Respuesta exitosa con el formato estándar de la API. */
export const ok = (data = null, message = 'Operación exitosa') => ({ status: 200, body: { success: true, data, message } })

/** Respuesta de error con el formato estándar de la API. */
export const fail = (status, code, message = 'Error', details = []) => ({
  status,
  body: { success: false, error: { code, message, details } },
})

/** Falla de red: el servidor no responde. */
export const NETWORK_DOWN = Symbol('NETWORK_DOWN')

/**
 * routes: { 'GET /auth/me': respuesta | (llamada) => respuesta }
 * Devuelve la lista de llamadas realizadas, para verificarlas en la prueba.
 */
export function mockApi(routes) {
  const calls = []

  httpClient.defaults.adapter = async (config) => {
    const method = config.method.toUpperCase()
    const url = config.url
    // FormData (subida de archivos) se entrega tal cual; JSON se convierte a objeto
    const data = typeof config.data === 'string' ? JSON.parse(config.data) : config.data
    const call = { method, url, data, params: config.params, headers: config.headers }
    calls.push(call)

    const handler = routes[`${method} ${url}`]
    if (!handler) throw new Error(`Sin respuesta simulada para ${method} ${url}`)

    const result = typeof handler === 'function' ? await handler(call, calls) : handler
    if (result === NETWORK_DOWN) {
      throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, config, {})
    }

    const response = { data: result.body, status: result.status, statusText: '', headers: {}, config, request: {} }
    if (result.status >= 400) {
      throw new AxiosError(`Request failed with status code ${result.status}`, AxiosError.ERR_BAD_RESPONSE, config, {}, response)
    }
    return response
  }

  return calls
}

/** Plan de prueba con el formato de /auth/me. */
export const BASIC_PLAN = {
  code: 'basic',
  name: 'Básico',
  features: ['administration', 'audit', 'notifications', 'system', 'settings', 'inventory', 'cash'],
  limits: { maxBranches: 1 },
}

/** Permisos efectivos de un Administrador en el plan básico. */
export const ADMIN_PERMISSIONS = [
  'audit.view',
  'branches.create',
  'branches.deactivate',
  'branches.update',
  'branches.view',
  'roles.create',
  'roles.delete',
  'roles.update',
  'roles.view',
  'users.create',
  'users.deactivate',
  'users.delete',
  'users.reset_password',
  'users.update',
  'users.view',
]

/** Respuesta de /auth/me o del login: { user, plan, branches? } (branches: sedes a las que entra, Fase 17). */
export const session = (user = buildUser(), plan = BASIC_PLAN, branches) => ok({ user, plan, ...(branches && { branches }) })

/** Usuario de prueba con el formato de /auth/me. Por defecto sin permisos. */
export function buildUser(overrides = {}) {
  return {
    permissions: [],
    id: 1,
    username: 'robinson',
    email: 'robinson@agro.com',
    fullName: 'Robinson Barrios',
    mustChangePassword: false,
    lastLoginAt: null,
    role: { id: 1, name: 'Administrador', systemRole: 'administrator' },
    branch: { id: 1, code: 'MAIN', name: 'Sede principal' },
    ...overrides,
  }
}

export const healthyResponse = ok(
  { status: 'ok', database: 'up', time: '2026-11-17T01:00:00.000Z', timezone: 'America/Bogota' },
  'Servicio en funcionamiento',
)
