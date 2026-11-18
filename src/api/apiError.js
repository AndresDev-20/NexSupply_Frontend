// Convierte cualquier error de Axios en un objeto uniforme, con el mismo
// formato que define el backend: { status, code, message, details, requestId }.
// Así los componentes nunca tienen que entender la estructura interna de Axios.

export const CLIENT_ERROR_CODES = Object.freeze({
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
})

// 502, 503 y 504 sin el formato de la API: el proxy no logró llegar al backend
const GATEWAY_STATUSES = [502, 503, 504]

const MESSAGES = {
  NETWORK_ERROR: 'No hay conexión con el servidor. Revisa tu conexión a internet e inténtalo de nuevo.',
  TIMEOUT: 'El servidor tardó demasiado en responder. Inténtalo de nuevo.',
  UNKNOWN_ERROR: 'Ocurrió un error inesperado. Si persiste, contacta al administrador.',
}

export function normalizeApiError(error) {
  const response = error?.response
  const requestId = response?.headers?.['x-request-id'] ?? null

  // El servidor respondió con el formato estándar de error
  if (response?.data?.success === false && response.data.error?.code) {
    const { code, message, details } = response.data.error
    return { status: response.status, code, message, details: details ?? [], requestId }
  }

  // Un intermediario (proxy de Vite, Nginx) respondió porque la API no está disponible
  if (response && GATEWAY_STATUSES.includes(response.status)) {
    return { status: response.status, code: CLIENT_ERROR_CODES.NETWORK_ERROR, message: MESSAGES.NETWORK_ERROR, details: [], requestId }
  }

  // El servidor respondió, pero no con el formato esperado
  if (response) {
    return { status: response.status, code: CLIENT_ERROR_CODES.UNKNOWN_ERROR, message: MESSAGES.UNKNOWN_ERROR, details: [], requestId }
  }

  if (error?.code === 'ECONNABORTED' || error?.code === 'ETIMEDOUT') {
    return { status: null, code: CLIENT_ERROR_CODES.TIMEOUT, message: MESSAGES.TIMEOUT, details: [], requestId: null }
  }

  if (error?.request) {
    return { status: null, code: CLIENT_ERROR_CODES.NETWORK_ERROR, message: MESSAGES.NETWORK_ERROR, details: [], requestId: null }
  }

  return { status: null, code: CLIENT_ERROR_CODES.UNKNOWN_ERROR, message: MESSAGES.UNKNOWN_ERROR, details: [], requestId: null }
}
