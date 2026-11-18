import { CLIENT_ERROR_CODES, normalizeApiError } from './apiError'

describe('normalizeApiError', () => {
  it('conserva el error estándar del backend', () => {
    const error = {
      response: {
        status: 400,
        headers: { 'x-request-id': 'abc-123' },
        data: {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Los datos enviados no son válidos', details: [{ field: 'name' }] },
        },
      },
    }

    expect(normalizeApiError(error)).toEqual({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Los datos enviados no son válidos',
      details: [{ field: 'name' }],
      requestId: 'abc-123',
    })
  })

  it('503 con formato estándar sigue siendo SERVICE_UNAVAILABLE (la API responde, la base no)', () => {
    const error = {
      response: {
        status: 503,
        headers: {},
        data: { success: false, error: { code: 'SERVICE_UNAVAILABLE', message: 'La base de datos no está disponible' } },
      },
    }
    expect(normalizeApiError(error).code).toBe('SERVICE_UNAVAILABLE')
  })

  it.each([502, 503, 504])('%i sin formato de la API (proxy) se trata como sin conexión', (status) => {
    const error = { response: { status, headers: {}, data: '' } }
    expect(normalizeApiError(error).code).toBe(CLIENT_ERROR_CODES.NETWORK_ERROR)
  })

  it('respuesta inesperada → UNKNOWN_ERROR con mensaje en español', () => {
    const result = normalizeApiError({ response: { status: 500, headers: {}, data: '<html>' } })
    expect(result.code).toBe(CLIENT_ERROR_CODES.UNKNOWN_ERROR)
    expect(result.message).toMatch(/error inesperado/)
  })

  it('tiempo agotado → TIMEOUT', () => {
    expect(normalizeApiError({ code: 'ECONNABORTED', request: {} }).code).toBe(CLIENT_ERROR_CODES.TIMEOUT)
  })

  it('sin respuesta → NETWORK_ERROR', () => {
    expect(normalizeApiError({ request: {} }).code).toBe(CLIENT_ERROR_CODES.NETWORK_ERROR)
  })

  it('error sin información → UNKNOWN_ERROR', () => {
    expect(normalizeApiError(undefined).code).toBe(CLIENT_ERROR_CODES.UNKNOWN_ERROR)
  })
})
