// Fase 15 — Apariencia, temporadas, atajos de teclado y accesibilidad (D-UX-1 a D-UX-5).
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '../../../test/renderWithProviders'
import { BASIC_PLAN, buildUser, fail, healthyResponse, mockApi, ok, restoreApi, session } from '../../../test/mockApi'
import { expectAccessible } from '../../../test/axe'

const PLAN = { ...BASIC_PLAN, features: [...BASIC_PLAN.features, 'sales', 'customers', 'reports', 'dashboard'] }
const CHRISTMAS = { key: 'christmas', label: 'Navidad', message: '¡Feliz Navidad!' }
const SETTINGS = {
  values: { 'appearance.palette': 'campo', 'appearance.seasonal_decorations': true },
  fixed: { currency: 'COP', timezone: 'America/Bogota' },
  logo: null,
}
const EMPTY_DASHBOARD = { period: 'today', range: {}, sales: null, products: null, profit: null, cash: null, receivables: null, payables: null, attention: [], generatedAt: '2026-11-17T15:00:00.000Z' }

const routes = ({ permissions = ['settings.update'], branding = {}, extra = {} } = {}) => ({
  'GET /auth/me': session(buildUser({ permissions }), PLAN),
  'GET /health': healthyResponse,
  'GET /notifications/unread-count': ok({ unread: 0 }),
  'GET /notifications': { status: 200, body: { success: true, data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 }, message: 'ok' } },
  'GET /branding': ok({ name: 'Agro El Campo', logo: null, palette: 'campo', season: null, ...branding }),
  'GET /me/preferences': ok({ theme: 'system' }),
  'GET /settings': ok(SETTINGS),
  'GET /dashboard': ok(EMPTY_DASHBOARD),
  ...extra,
})

const FIRST_LOAD = { timeout: 10000 }

afterEach(() => {
  restoreApi()
  delete document.documentElement.dataset.palette
  window.localStorage.clear()
})

describe('paleta del negocio (D-UX-3, D-UX-4)', { timeout: 15000 }, () => {
  it('la paleta guardada se aplica a toda la aplicación y queda guardada en el navegador', async () => {
    mockApi(routes({ branding: { palette: 'rio' } }))
    renderApp('/')
    await waitFor(() => expect(document.documentElement.dataset.palette).toBe('rio'), FIRST_LOAD)
    expect(window.localStorage.getItem('nexsupply.palette')).toBe('rio')
  })

  it('Apariencia: escoger una paleta la muestra al instante y al guardar la envía', async () => {
    const user = userEvent.setup()
    const calls = mockApi(routes({ extra: { 'PATCH /settings': ok({ ...SETTINGS, values: { ...SETTINGS.values, 'appearance.palette': 'tierra' } }) } }))
    renderApp('/configuracion/apariencia')
    const tierra = await screen.findByRole('radio', { name: /Tierra/ }, FIRST_LOAD)
    expect(screen.getByRole('radio', { name: /Campo/ })).toBeChecked()

    await user.click(tierra)
    expect(document.documentElement.dataset.palette).toBe('tierra')
    await user.click(screen.getByRole('button', { name: /Guardar/ }))
    await waitFor(() => expect(calls.find((call) => call.method.toLowerCase() === 'patch')?.data).toEqual({ values: { 'appearance.palette': 'tierra' } }))
    await expectAccessible(document.body)
  })

  it('al salir de Apariencia sin guardar vuelve la paleta guardada', async () => {
    const user = userEvent.setup()
    mockApi(routes())
    renderApp('/configuracion/apariencia')
    await user.click(await screen.findByRole('radio', { name: /Bosque/ }, FIRST_LOAD))
    expect(document.documentElement.dataset.palette).toBe('bosque')
    await user.click(screen.getByRole('link', { name: 'Inicio' }))
    await waitFor(() => expect(document.documentElement.dataset.palette).toBeUndefined())
  })
})

describe('adornos de temporada (D-UX-1, D-UX-2)', { timeout: 15000 }, () => {
  it('en Navidad se ven el mensaje y la guirnalda en la bienvenida; los lectores de pantalla ignoran la guirnalda', async () => {
    mockApi(routes({ branding: { season: CHRISTMAS } }))
    const { container } = renderApp('/')
    expect(await screen.findByText('¡Feliz Navidad!', {}, FIRST_LOAD)).toBeInTheDocument()
    const garlands = container.querySelectorAll('svg.seasonal')
    expect(garlands.length).toBeGreaterThanOrEqual(2) // menú y bienvenida
    garlands.forEach((svg) => expect(svg).toHaveAttribute('aria-hidden', 'true'))
    await expectAccessible(document.body)
  })

  it('el inicio de sesión también se adorna, y es accesible', async () => {
    mockApi({ 'GET /auth/me': fail(401, 'UNAUTHORIZED', 'Debes iniciar sesión para continuar'), 'GET /branding': ok({ name: 'Agro El Campo', logo: null, palette: 'campo', season: CHRISTMAS }) })
    renderApp('/iniciar-sesion')
    expect(await screen.findByText('¡Feliz Navidad!', {}, FIRST_LOAD)).toBeInTheDocument()
    await expectAccessible(document.body)
  })

  it('sin temporada no hay adornos', async () => {
    mockApi(routes())
    const { container } = renderApp('/')
    await screen.findByText(/Aún no tienes cifras/, {}, FIRST_LOAD)
    expect(container.querySelector('svg.seasonal')).toBeNull()
  })
})

describe('atajos de teclado (D-UX-5)', { timeout: 15000 }, () => {
  it('"g" y una letra llevan a la pantalla; "?" abre la ayuda con solo los atajos permitidos', async () => {
    const user = userEvent.setup()
    const { router } = (mockApi(routes({ permissions: ['settings.update', 'reports.sales'], extra: { 'GET /reports': ok([]) } })), renderApp('/'))
    await screen.findByText(/Aún no tienes cifras|Vendido/, {}, FIRST_LOAD)

    await user.keyboard('g')
    expect(screen.getByText(/escribe la letra de la pantalla/)).toBeInTheDocument()
    await user.keyboard('n')
    await waitFor(() => expect(router.state.location.pathname).toBe('/informes'))

    // Sin permiso de ventas, "g v" no hace nada
    await user.keyboard('gv')
    expect(router.state.location.pathname).toBe('/informes')

    await user.keyboard('?')
    const help = await screen.findByRole('dialog', { name: 'Atajos de teclado' })
    expect(within(help).getByText('Informes')).toBeInTheDocument()
    expect(within(help).queryByText('Punto de venta')).not.toBeInTheDocument()
    await expectAccessible(document.body)
  })

  it('escribiendo en un campo los atajos no hacen nada', async () => {
    const user = userEvent.setup()
    mockApi(routes())
    const { router } = renderApp('/configuracion/apariencia')
    await screen.findByRole('radio', { name: /Campo/ }, FIRST_LOAD)
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    await user.keyboard('gi')
    expect(router.state.location.pathname).toBe('/configuracion/apariencia')
    input.remove()
  })
})
