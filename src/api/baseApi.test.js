import { axiosBaseQuery } from './baseApi'
import { httpClient } from './httpClient'

describe('axiosBaseQuery', () => {
  const baseQuery = axiosBaseQuery()

  it('entrega solo "data" del sobre estándar y deja message y paginación en meta', async () => {
    vi.spyOn(httpClient, 'request').mockResolvedValue({
      headers: { 'x-request-id': 'req-1' },
      data: {
        success: true,
        data: [{ id: 1 }],
        meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
        message: 'Operación exitosa',
      },
    })

    const result = await baseQuery({ url: '/products', params: { page: 1 } })

    expect(httpClient.request).toHaveBeenCalledWith(expect.objectContaining({ url: '/products', method: 'GET', params: { page: 1 } }))
    expect(result).toEqual({
      data: [{ id: 1 }],
      meta: {
        message: 'Operación exitosa',
        pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
        requestId: 'req-1',
      },
    })
  })

  it('una página HTML en lugar del JSON es un error, no datos vacíos (D-DEP-1)', async () => {
    vi.spyOn(httpClient, 'request').mockResolvedValue({ status: 200, headers: {}, data: '<!doctype html><html></html>' })
    const result = await baseQuery({ url: '/auth/me' })
    expect(result.error).toMatchObject({ code: 'INVALID_RESPONSE' })
    expect(result.data).toBeUndefined()
  })

  it('una respuesta sin cuerpo (204) da data null', async () => {
    vi.spyOn(httpClient, 'request').mockResolvedValue({ status: 204, headers: {}, data: '' })
    expect((await baseQuery({ url: '/auth/logout', method: 'POST' })).data).toBeNull()
  })

  it('devuelve el error normalizado en { error }', async () => {
    const normalized = { status: 404, code: 'NOT_FOUND', message: 'El producto no existe', details: [], requestId: null }
    vi.spyOn(httpClient, 'request').mockRejectedValue(normalized)

    expect(await baseQuery({ url: '/products/99' })).toEqual({ error: normalized })
  })
})

describe('httpClient', () => {
  it('envía cookies y la cabecera anti-CSRF', () => {
    expect(httpClient.defaults.withCredentials).toBe(true)
    expect(httpClient.defaults.headers['X-Requested-With']).toBe('XMLHttpRequest')
    expect(httpClient.defaults.baseURL).toBe('/api/v1')
  })
})
