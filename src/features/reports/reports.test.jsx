// Fase 13 — Centro de informes.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '../../test/renderWithProviders'
import { BASIC_PLAN, buildUser, fail, healthyResponse, mockApi, ok, restoreApi, session } from '../../test/mockApi'
import { expectAccessible } from '../../test/axe'

const PLAN = { ...BASIC_PLAN, features: [...BASIC_PLAN.features, 'reports'] }
const CATALOG = [
  {
    area: 'sales',
    label: 'Ventas',
    reports: [
      { key: 'sales_by_day', title: 'Ventas por día', description: 'Cuánto se vendió cada día.', filters: ['dateRange', 'seller'], defaults: {}, excel: true, pdf: true },
      { key: 'top_products', title: 'Productos más y menos vendidos', description: 'Cantidad y valor por producto.', filters: ['dateRange', 'category', 'order'], defaults: {}, excel: true, pdf: false },
    ],
  },
  {
    area: 'profit',
    label: 'Ganancias',
    reports: [{ key: 'profit_summary', title: 'Ganancia bruta y neta', description: 'Ventas netas, costo y ganancia.', filters: ['dateRange'], defaults: {}, excel: true, pdf: true }],
  },
]
const SALES_BY_DAY = {
  key: 'sales_by_day',
  columns: [
    { key: 'day', label: 'Día', type: 'date' },
    { key: 'count', label: 'Ventas', type: 'integer', total: true },
    { key: 'total', label: 'Vendido', type: 'money', total: true },
  ],
  rows: [
    { day: '2026-11-16', count: 3, total: '250000.00' },
    { day: '2026-11-17', count: 2, total: '150000.00' },
  ],
  totals: { count: 5, total: '400000.00' },
  summary: null,
}
const PROFIT = {
  key: 'profit_summary',
  columns: [
    { key: 'concept', label: 'Concepto', type: 'text' },
    { key: 'value', label: 'Valor', type: 'money' },
    { key: 'share', label: '% de las ventas netas', type: 'percent' },
  ],
  rows: [
    { concept: '= Ventas netas', value: '300000.00', share: '100.00', kind: 'subtotal' },
    { concept: '= Ganancia neta', value: '30000.00', share: '10.00', kind: 'result' },
  ],
  totals: null,
  summary: { sales: 2, netSales: '300000.00', cost: '240000.00', grossProfit: '60000.00', grossMargin: '20.00', expenses: '30000.00', expensesCount: 1, netProfit: '30000.00', netMargin: '10.00' },
}

const baseRoutes = (permissions = ['reports.sales', 'reports.profit', 'inventory.cost_view', 'reports.export']) => ({
  'GET /auth/me': session(buildUser({ permissions }), PLAN),
  'GET /health': healthyResponse,
  'GET /notifications/unread-count': ok({ unread: 0 }),
  'GET /notifications': { status: 200, body: { success: true, data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 }, message: 'ok' } },
  'GET /branding': ok({ name: 'Agro El Campo', logo: null }),
  'GET /me/preferences': ok({ theme: 'system' }),
  'GET /reports': ok(CATALOG),
  'GET /reports/options': ok({ categories: [{ id: 1, name: 'Alimentos' }], sellers: [{ id: 2, name: 'Robinson Barrios' }], suppliers: [], registers: [] }),
  'GET /reports/sales_by_day': ok(SALES_BY_DAY),
  'GET /reports/profit_summary': ok(PROFIT),
})

afterEach(() => {
  restoreApi()
})

describe('centro de informes', () => {
  it('muestra los informes por área y abre uno con su tabla y totales', async () => {
    const user = userEvent.setup()
    const calls = mockApi(baseRoutes())
    renderApp('/informes')
    const sales = await screen.findByRole('region', { name: 'Ventas' })
    expect(within(sales).getByText('Productos más y menos vendidos')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Ganancias' })).toBeInTheDocument()

    await user.click(within(sales).getByRole('button', { name: /Ventas por día/ }))
    const view = await screen.findByRole('region', { name: 'Ventas por día' })
    expect(await within(view).findByText('$ 250.000')).toBeInTheDocument()
    expect(within(view).getByText('16/11/2026')).toBeInTheDocument()
    // Fila de totales
    const footer = view.querySelector('tfoot')
    expect(within(footer).getByText('Total')).toBeInTheDocument()
    expect(within(footer).getByText('$ 400.000')).toBeInTheDocument()
    // Por defecto, el mes actual; con el atajo "Hoy" cambia el periodo
    const first = calls.find((call) => call.url === '/reports/sales_by_day')
    expect(first.params.from).toMatch(/^\d{4}-\d{2}-01$/)
    await user.click(within(view).getByRole('button', { name: 'Hoy' }))
    await waitFor(() => {
      const last = calls.filter((call) => call.url === '/reports/sales_by_day').at(-1)
      expect(last.params.from).toBe(last.params.to)
    })
    expect(within(view).getByRole('button', { name: 'Excel' })).toBeInTheDocument()
    expect(within(view).getByRole('button', { name: 'PDF' })).toBeInTheDocument()
    await expectAccessible(document.body)

    await user.click(within(view).getByRole('button', { name: /Todos los informes/ }))
    expect(await screen.findByRole('region', { name: 'Ventas' })).toBeInTheDocument()
  })

  it('la ganancia muestra el resumen bruto y neto con su margen', async () => {
    mockApi(baseRoutes())
    renderApp('/informes?informe=profit_summary')
    const view = await screen.findByRole('region', { name: 'Ganancia bruta y neta' })
    expect(await within(view).findByText('Ganancia neta', { selector: '.report-card__label' })).toBeInTheDocument()
    expect(within(view).getByText('Margen 10 %')).toBeInTheDocument()
    expect(within(view).getByText('= Ganancia neta').closest('tr')).toHaveClass('report-row--result')
  })

  it('sin permiso de descargar no aparecen Excel ni PDF; los errores del servidor se muestran', async () => {
    const catalog = CATALOG.map((group) => ({ ...group, reports: group.reports.map((report) => ({ ...report, excel: false, pdf: false })) }))
    mockApi({ ...baseRoutes(['reports.sales']), 'GET /reports': ok([catalog[0]]), 'GET /reports/sales_by_day': fail(409, 'OPERATION_NOT_ALLOWED', 'El informe tiene más de 5.000 filas: acorta las fechas o usa los filtros') })
    renderApp('/informes?informe=sales_by_day')
    const view = await screen.findByRole('region', { name: 'Ventas por día' })
    expect(await within(view).findByText(/acorta las fechas/)).toBeInTheDocument()
    expect(within(view).queryByRole('button', { name: 'Excel' })).not.toBeInTheDocument()
  })

  it('sin ningún permiso de informes no se entra', async () => {
    mockApi(baseRoutes(['sales.view']))
    renderApp('/informes')
    expect(await screen.findByText('No tienes acceso a esta sección')).toBeInTheDocument()
  })
})
