// Fase 19 — «Esta sucursal / Todas» en informes, dashboard y cartera, y la sucursal en el
// estado de cuenta y en el recibo de un abono que bajó deudas de otra sucursal.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '../../test/renderWithProviders'
import { BASIC_PLAN, buildUser, healthyResponse, mockApi, ok, restoreApi, session } from '../../test/mockApi'

const CENTRO = { id: 1, code: 'MAIN', name: 'Centro' }
const NORTE = { id: 2, code: 'NOR', name: 'Norte' }
const FEATURES = [...BASIC_PLAN.features, 'sales', 'reports', 'dashboard', 'customers']
const INTERMEDIATE = { ...BASIC_PLAN, code: 'intermediate', name: 'Intermedio', features: [...FEATURES, 'multi_branch', 'branch_transfers', 'consolidated_reports'], limits: { maxBranches: null } }
const BASIC = { ...BASIC_PLAN, features: FEATURES }
const PERMISSIONS = ['reports.sales', 'receivables.view', 'customers.view']

const page = (rows, meta = {}) => ({ status: 200, body: { success: true, data: rows, meta: { page: 1, pageSize: 20, total: rows.length, totalPages: 1, ...meta }, message: 'ok' } })
const metric = (value, previous, change) => ({ value, previous, change })

const CATALOG = [{ area: 'sales', label: 'Ventas', reports: [{ key: 'sales_by_day', title: 'Ventas por día', description: 'Cuánto se vendió cada día.', filters: ['dateRange'], defaults: {}, excel: true, pdf: true }] }]
const report = (branches) => ({
  key: 'sales_by_day',
  columns: [
    { key: 'day', label: 'Día', type: 'date' },
    { key: 'total', label: 'Vendido', type: 'money', total: true },
  ],
  rows: [{ day: '2026-11-17', total: branches.length > 1 ? '800000.00' : '500000.00' }],
  totals: { total: branches.length > 1 ? '800000.00' : '500000.00' },
  summary: null,
  branches,
})

const hours = Array.from({ length: 24 }, (_, hour) => ({ key: String(hour).padStart(2, '0'), total: null, count: null, previousKey: String(hour).padStart(2, '0'), previousTotal: '0.00' }))
const dashboard = (consolidated) => ({
  period: 'today',
  consolidated,
  branches: consolidated ? [CENTRO, NORTE] : [CENTRO],
  range: { from: '2026-11-17', to: '2026-11-17', previousFrom: '2026-11-16', previousTo: '2026-11-16' },
  sales: { scope: 'business', total: metric(consolidated ? '800000.00' : '500000.00', '0.00', null), count: metric(4, 0, null), average: metric('200000.00', '0.00', null), credit: metric('0.00', '0.00', null), chart: { bucket: 'hour', points: hours } },
  products: null,
  profit: null,
  cash: null,
  receivables: null,
  payables: null,
  attention: [],
  byBranch: consolidated
    ? [
        { id: 1, name: 'Centro', sales: metric('500000.00', '400000.00', '25.00'), count: 2 },
        { id: 2, name: 'Norte', sales: metric('300000.00', '0.00', null), count: 2 },
      ]
    : null,
  generatedAt: '2026-11-17T15:00:00.000Z',
})

function routes(plan = INTERMEDIATE, branches = [CENTRO, NORTE], overrides = {}) {
  return {
    'GET /auth/me': session(buildUser({ permissions: PERMISSIONS, branch: CENTRO }), plan, branches),
    'GET /health': healthyResponse,
    'GET /notifications/unread-count': ok({ unread: 0 }),
    'GET /notifications': page([]),
    'GET /branding': ok({ name: 'Agro El Campo', logo: null }),
    'GET /me/preferences': ok({ theme: 'system' }),
    'GET /reports': ok(CATALOG),
    'GET /reports/sales_by_day': (call) => ok(report(call.params?.branch === 'all' ? [CENTRO, NORTE] : [CENTRO])),
    'GET /dashboard': (call) => ok(dashboard(call.params?.branch === 'all')),
    ...overrides,
  }
}

afterEach(() => restoreApi())

describe('informes', () => {
  it('con «Todas» se piden las sucursales del usuario y se dice qué se sumó', async () => {
    const user = userEvent.setup()
    const calls = mockApi(routes())
    renderApp('/informes?informe=sales_by_day')
    const scope = await screen.findByRole('group', { name: 'Sucursales que se suman' })
    expect(within(scope).getByRole('button', { name: /Centro/ })).toHaveAttribute('aria-pressed', 'true')
    await user.click(within(scope).getByRole('button', { name: 'Todas (2)' }))
    expect(await screen.findByText(/Suma Centro, Norte/)).toBeInTheDocument()
    await waitFor(() => expect(calls.filter((call) => call.url === '/reports/sales_by_day').at(-1).params).toMatchObject({ branch: 'all' }))
  })

  it('en el plan básico (o con una sola sucursal) no hay selector', async () => {
    mockApi(routes(BASIC, [CENTRO]))
    renderApp('/informes?informe=sales_by_day')
    expect(await screen.findByText('Ventas por día')).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Sucursales que se suman' })).not.toBeInTheDocument()
  })
})

describe('dashboard', { timeout: 15000 }, () => {
  it('con «Todas» suma las sucursales y compara una contra otra', async () => {
    const user = userEvent.setup()
    const calls = mockApi(routes())
    renderApp('/')
    const scope = await screen.findByRole('group', { name: 'Sucursales que se suman' }, { timeout: 10000 })
    expect(screen.queryByRole('heading', { name: 'Comparación por sucursal' })).not.toBeInTheDocument()
    await user.click(within(scope).getByRole('button', { name: 'Todas (2)' }))
    const panel = (await screen.findByRole('heading', { name: 'Comparación por sucursal' })).closest('section')
    expect(within(panel).getByText('Centro')).toBeInTheDocument()
    expect(within(panel).getByText('Norte')).toBeInTheDocument()
    expect(within(panel).getByText('$ 800.000 entre todas')).toBeInTheDocument()
    expect(calls.filter((call) => call.url === '/dashboard').at(-1).params).toEqual({ period: 'today', branch: 'all' })
  })
})

describe('cartera', () => {
  it('con «Todas» trae las deudas de las sucursales del usuario y dice de cuál es cada una', async () => {
    const user = userEvent.setup()
    const debt = (id, branch, balance) => ({ id, number: `CXC-00000${id}`, description: 'Venta fiada', customer: { id: 4, name: 'Pedro Gómez', phone: '3001234567' }, branch, status: 'open', balance, total: balance, dueDate: null, nextDue: null, isOverdue: false, paymentModeLabel: 'Libre' })
    const calls = mockApi(
      routes(INTERMEDIATE, [CENTRO, NORTE], {
        'GET /receivables': (call) => page(call.params?.branch === 'all' ? [debt(1, CENTRO, '300000.00'), debt(2, NORTE, '200000.00')] : [debt(1, CENTRO, '300000.00')]),
        'GET /receivables/summary': (call) => ok({ balance: call.params?.branch === 'all' ? '500000.00' : '300000.00', overdue: '0.00', dueThisWeek: '0.00', customersWithDebt: 1, customersOverdue: 0 }),
      }),
    )
    renderApp('/cartera')
    expect(await screen.findByText('CXC-000001')).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Sucursal' })).not.toBeInTheDocument()
    await user.click(within(screen.getByRole('group', { name: 'Sucursales que se suman' })).getByRole('button', { name: 'Todas (2)' }))
    expect(await screen.findByText('CXC-000002')).toBeInTheDocument()
    expect(screen.getAllByRole('columnheader', { name: 'Sucursal' }).length).toBeGreaterThan(0)
    expect(await screen.findByText('$ 500.000')).toBeInTheDocument()
    expect(calls.filter((call) => call.url === '/receivables/summary').at(-1).params).toEqual({ branch: 'all' })
  })
})
