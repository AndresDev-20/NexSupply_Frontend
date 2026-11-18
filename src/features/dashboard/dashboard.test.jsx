// Fase 14 — Dashboard (D-DASH-1 a D-DASH-7).
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '../../test/renderWithProviders'
import { BASIC_PLAN, buildUser, healthyResponse, mockApi, ok, restoreApi, session } from '../../test/mockApi'
import { expectAccessible } from '../../test/axe'

const PLAN = { ...BASIC_PLAN, features: [...BASIC_PLAN.features, 'sales', 'reports', 'dashboard'] }
const metric = (value, previous, change) => ({ value, previous, change })
const hours = Array.from({ length: 24 }, (_, hour) => ({ key: String(hour).padStart(2, '0'), total: hour <= 10 ? '0.00' : null, count: hour <= 10 ? 0 : null, previousKey: String(hour).padStart(2, '0'), previousTotal: '0.00' }))
hours[9] = { ...hours[9], total: '300000.00', count: 2, previousTotal: '200000.00' }

const OWNER_DATA = {
  period: 'today',
  range: { from: '2026-11-17', to: '2026-11-17', previousFrom: '2026-11-16', previousTo: '2026-11-16' },
  sales: { scope: 'business', total: metric('300000.00', '200000.00', '50.00'), count: metric(2, 1, '100.00'), average: metric('150000.00', '200000.00', '-25.00'), credit: metric('100000.00', '0.00', null), chart: { bucket: 'hour', points: hours } },
  products: {
    top: [{ code: 'P-00001', name: 'Concentrado cerdos', category: 'Alimentos', quantity: '120.000', unit: 'kg', total: '300000.00' }],
    categories: [{ category: 'Alimentos', total: '300000.00', share: '100.00' }],
  },
  profit: {
    netSales: metric('300000.00', '0.00', null),
    cost: metric('240000.00', '0.00', null),
    grossProfit: metric('60000.00', '0.00', null),
    grossMargin: '20.00',
    expenses: metric('30000.00', '20000.00', '50.00'),
    netProfit: metric('30000.00', '0.00', null),
    netMargin: '10.00',
    chart: null,
  },
  cash: { scope: 'business', expectedCash: '200000.00', sessions: [{ id: 7, register: 'Mostrador', status: 'open', openedAt: '2026-11-17T12:00:00.000Z', openedBy: 'Robinson Barrios', expectedCash: '200000.00', isOverdue: false }] },
  receivables: { balance: '100000.00', overdue: '0.00', customers: 1, customersOverdue: 0 },
  payables: { balance: '0.00', count: 0, overdue: '0.00', overdueCount: 0 },
  attention: [
    { key: 'outOfStock', label: 'Productos agotados', severity: 'danger', link: '/inventario/productos', count: 0 },
    { key: 'lowStock', label: 'Productos con existencia baja', severity: 'warning', link: '/inventario/productos', count: 1 },
  ],
  generatedAt: '2026-11-17T15:00:00.000Z',
}

const routes = (data, permissions = ['reports.sales']) => ({
  'GET /auth/me': session(buildUser({ permissions }), PLAN),
  'GET /health': healthyResponse,
  'GET /notifications/unread-count': ok({ unread: 0 }),
  'GET /notifications': { status: 200, body: { success: true, data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 }, message: 'ok' } },
  'GET /branding': ok({ name: 'Agro El Campo', logo: null }),
  'GET /me/preferences': ok({ theme: 'system' }),
  'GET /dashboard': typeof data === 'function' ? data : ok(data),
})

// La primera vez se descarga Recharts (pesado): con la máquina ocupada puede pasar de 3 s
const FIRST_LOAD = { timeout: 10000 }

afterEach(() => {
  restoreApi()
})

// Más tiempo por prueba: la primera descarga Recharts y revisa muchas cosas
describe('dashboard', { timeout: 15000 }, () => {
  it('el dueño ve cifras con su variación, avisos pendientes, más vendidos, caja y cartera', async () => {
    mockApi(routes(OWNER_DATA))
    renderApp('/')
    expect(await screen.findByRole('heading', { name: /^Buen(os|as) (días|tardes|noches), Robinson$/ }, FIRST_LOAD)).toBeInTheDocument()
    expect(await screen.findByText('Vendido', {}, FIRST_LOAD)).toBeInTheDocument()
    expect(await screen.findByText('Servidor en línea')).toBeInTheDocument()

    const sold = screen.getByText('Vendido').closest('article')
    expect(within(sold).getByText('$ 300.000')).toBeInTheDocument()
    expect(within(sold).getByText('+50 % vs. ayer a esta hora')).toBeInTheDocument()
    expect(within(sold.parentElement).getByText('-25 % vs. ayer a esta hora').closest('.dash-kpi__trend')).toHaveClass('dash-kpi__trend--bad')
    // Si el periodo anterior fue cero no hay porcentaje
    expect(within(screen.getByText('Fiado').closest('article')).getByText('Sin datos de ayer a esta hora')).toBeInTheDocument()
    // Que los gastos suban es malo: la flecha va en rojo
    const expenses = screen.getByText('Gastos').closest('article')
    expect(within(expenses).getByText('+50 % vs. ayer a esta hora').closest('.dash-kpi__trend')).toHaveClass('dash-kpi__trend--bad')
    expect(within(screen.getByText('Ganancia neta').closest('article')).getByText('Margen 10 %')).toBeInTheDocument()

    // Solo los avisos con algo pendiente, y cada uno lleva a su pantalla
    const attention = screen.getByRole('region', { name: 'Requiere atención' })
    expect(within(attention).getByRole('link', { name: /Productos con existencia baja/ })).toHaveAttribute('href', '/inventario/productos')
    expect(within(attention).queryByText('Productos agotados')).not.toBeInTheDocument()

    expect(within(screen.getByRole('region', { name: 'Más vendidos' })).getByText('Concentrado cerdos')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Cajas' })).getByRole('link', { name: /Mostrador/ })).toHaveAttribute('href', '/caja/turnos/7')
    expect(within(screen.getByRole('region', { name: 'Por cobrar y por pagar' })).getByText('$ 100.000')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Ventas por categoría' })).toBeInTheDocument()
    await expectAccessible(document.body)
  })

  it('los botones de periodo vuelven a pedir las cifras', async () => {
    const user = userEvent.setup()
    const calls = mockApi(routes((config) => ok({ ...OWNER_DATA, period: config.params.period })))
    renderApp('/')
    await screen.findByText('Vendido', {}, FIRST_LOAD)
    expect(calls.filter((call) => call.url === '/dashboard').at(-1).params).toEqual({ period: 'today' })

    await user.click(screen.getByRole('button', { name: 'Mes' }))
    await waitFor(() => expect(calls.filter((call) => call.url === '/dashboard').at(-1).params).toEqual({ period: 'month' }))
    expect(screen.getByRole('button', { name: 'Mes' })).toHaveAttribute('aria-pressed', 'true')
    expect(await screen.findAllByText(/vs\. el mes pasado/)).not.toHaveLength(0)
  })

  it('el cajero ve "Mis ventas" y su caja; sin avisos dice que todo está en orden', async () => {
    const data = { ...OWNER_DATA, sales: { ...OWNER_DATA.sales, scope: 'mine' }, products: null, profit: null, receivables: null, payables: null, attention: [], cash: { scope: 'mine', expectedCash: '0.00', sessions: [] } }
    mockApi(routes(data, ['sales.view']))
    renderApp('/')
    expect(await screen.findByRole('heading', { name: 'Mis ventas' }, FIRST_LOAD)).toBeInTheDocument()
    expect(screen.queryByText('Ganancia neta')).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Más vendidos' })).not.toBeInTheDocument()
    expect(screen.getByText('Todo en orden. No hay nada pendiente.')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Mi caja' })).getByText('No tienes un turno abierto.')).toBeInTheDocument()
  })

  it('sin ninguna cifra para ver muestra un mensaje en vez de un panel vacío', async () => {
    mockApi(routes({ ...OWNER_DATA, sales: null, products: null, profit: null, cash: null, receivables: null, payables: null, attention: [] }, []))
    renderApp('/')
    expect(await screen.findByText(/Aún no tienes cifras para ver aquí/, {}, FIRST_LOAD)).toBeInTheDocument()
  })
})
