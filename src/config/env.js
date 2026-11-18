// Único punto de lectura de las variables VITE_*.
// Todo lo que está aquí llega al navegador: nunca debe contener secretos.

function readPositiveInt(value, fallback) {
  const number = Number(value)
  return Number.isInteger(number) && number > 0 ? number : fallback
}

export const env = Object.freeze({
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  apiTimeoutMs: readPositiveInt(import.meta.env.VITE_API_TIMEOUT_MS, 15000),
  isDevelopment: import.meta.env.DEV,
})

// Zona horaria y formato del negocio (Colombia). Son fijos: el backend los expone en
// GET /settings (fixed.timezone, fixed.currency) pero no se configuran (D-CFG-1).
export const BUSINESS_TIMEZONE = 'America/Bogota'
export const BUSINESS_LOCALE = 'es-CO'
