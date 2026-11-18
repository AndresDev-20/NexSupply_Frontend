// Renovación automática de la sesión y eventos de sesión del cliente HTTP.
import { httpClient, setAuthEventHandler } from './httpClient'
import { fail, mockApi, NETWORK_DOWN, ok, restoreApi } from '../test/mockApi'

const expired = fail(401, 'TOKEN_EXPIRED', 'Tu sesión expiró')

let events
beforeEach(() => {
  events = []
  setAuthEventHandler((event) => events.push(event))
})
afterEach(() => {
  restoreApi()
  setAuthEventHandler(() => {})
})

describe('renovación automática de la sesión', () => {
  it('si el token venció, renueva y repite la petición sin que el usuario lo note', async () => {
    let attempt = 0
    const calls = mockApi({
      'GET /products': () => (++attempt === 1 ? expired : ok([{ id: 1 }])),
      'POST /auth/refresh': ok({ user: {} }),
    })

    const res = await httpClient.get('/products')

    expect(res.data.data).toEqual([{ id: 1 }])
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual(['GET /products', 'POST /auth/refresh', 'GET /products'])
    expect(events).toEqual([])
  })

  it('varias peticiones vencidas al mismo tiempo comparten UNA sola renovación', async () => {
    const seen = new Set()
    const calls = mockApi({
      'GET /a': () => (seen.has('a') ? ok('A') : (seen.add('a'), expired)),
      'GET /b': () => (seen.has('b') ? ok('B') : (seen.add('b'), expired)),
      'POST /auth/refresh': () => new Promise((resolve) => setTimeout(() => resolve(ok({})), 20)),
    })

    const [a, b] = await Promise.all([httpClient.get('/a'), httpClient.get('/b')])

    expect([a.data.data, b.data.data]).toEqual(['A', 'B'])
    expect(calls.filter((c) => c.url === '/auth/refresh')).toHaveLength(1)
  })

  it('si no puede renovar, avisa "expired" y rechaza con error normalizado', async () => {
    mockApi({
      'GET /products': expired,
      'POST /auth/refresh': fail(401, 'UNAUTHORIZED', 'Tu sesión terminó. Inicia sesión de nuevo'),
    })

    await expect(httpClient.get('/products')).rejects.toMatchObject({ status: 401, code: 'UNAUTHORIZED' })
    expect(events).toEqual(['expired'])
  })

  it('si el usuario fue desactivado mientras renovaba, avisa "inactive"', async () => {
    mockApi({
      'GET /products': expired,
      'POST /auth/refresh': fail(403, 'USER_INACTIVE', 'Tu usuario está desactivado'),
    })

    await expect(httpClient.get('/products')).rejects.toMatchObject({ code: 'USER_INACTIVE' })
    expect(events).toEqual(['inactive'])
  })

  it('no intenta renovar cuando falla el propio inicio de sesión', async () => {
    const calls = mockApi({ 'POST /auth/login': fail(401, 'INVALID_CREDENTIALS', 'Usuario o contraseña incorrectos') })

    await expect(httpClient.post('/auth/login', {})).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
    expect(calls).toHaveLength(1)
    expect(events).toEqual([])
  })

  it('/auth/me con token vencido sí renueva (así se restaura la sesión al abrir la app)', async () => {
    let attempt = 0
    mockApi({
      'GET /auth/me': () => (++attempt === 1 ? expired : ok({ user: { id: 1 } })),
      'POST /auth/refresh': ok({}),
    })
    const res = await httpClient.get('/auth/me')
    expect(res.data.data.user.id).toBe(1)
  })
})

describe('eventos de sesión', () => {
  it('UNAUTHORIZED fuera de /auth avisa que la sesión terminó', async () => {
    mockApi({ 'GET /products': fail(401, 'UNAUTHORIZED') })
    await expect(httpClient.get('/products')).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    expect(events).toEqual(['expired'])
  })

  it('UNAUTHORIZED de /auth/me al abrir la app NO es un evento (simplemente no hay sesión)', async () => {
    mockApi({ 'GET /auth/me': fail(401, 'UNAUTHORIZED') })
    await expect(httpClient.get('/auth/me')).rejects.toBeTruthy()
    expect(events).toEqual([])
  })

  it('PASSWORD_CHANGE_REQUIRED avisa que debe cambiar la contraseña', async () => {
    mockApi({ 'GET /products': fail(403, 'PASSWORD_CHANGE_REQUIRED') })
    await expect(httpClient.get('/products')).rejects.toMatchObject({ code: 'PASSWORD_CHANGE_REQUIRED' })
    expect(events).toEqual(['password_change_required'])
  })

  it('una falla de red se normaliza como NETWORK_ERROR sin eventos de sesión', async () => {
    mockApi({ 'GET /products': NETWORK_DOWN })
    await expect(httpClient.get('/products')).rejects.toMatchObject({ code: 'NETWORK_ERROR' })
    expect(events).toEqual([])
  })
})
