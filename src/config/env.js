// Único punto de lectura de las variables VITE_*.
// Todo lo que está aquí llega al navegador: nunca debe contener secretos.

function readPositiveInt(value, fallback) {
  const number = Number(value)
  return Number.isInteger(number) && number > 0 ? number : fallback
}

export const env = Object.freeze({
  // '/api/v1' (mismo dominio) o la dirección completa de la API, ej. https://api.dominio.com/api/v1 (D-DEP-1).
  // Sin barra final, para armar rutas como `${apiBaseUrl}/branding/logo`
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/+$/, ''),
  apiTimeoutMs: readPositiveInt(import.meta.env.VITE_API_TIMEOUT_MS, 15000),
  isDevelopment: import.meta.env.DEV,
})

/** Logo del negocio, servido por la API (también cuando la API está en otro subdominio). */
export const BRANDING_LOGO_SRC = `${env.apiBaseUrl}/branding/logo`

// Zona horaria y formato del negocio (Colombia). Son fijos: el backend los expone en
// GET /settings (fixed.timezone, fixed.currency) pero no se configuran (D-CFG-1).
export const BUSINESS_TIMEZONE = 'America/Bogota'
export const BUSINESS_LOCALE = 'es-CO'
