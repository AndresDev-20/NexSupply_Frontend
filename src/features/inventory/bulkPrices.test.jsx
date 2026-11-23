// Cambiar precios en bloque (D-PRE-2) con el backend simulado: vista previa con antes y después,
// desmarcar productos, aplicar y la confirmación de precios por debajo del costo.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '../../test/renderWithProviders'
import { BASIC_PLAN, buildUser, fail, healthyResponse, mockApi, ok, restoreApi, session } from '../../test/mockApi'

const PRICES = ['inventory.view', 'inventory.prices']
const TREE = [{ id: 1, parentId: null, name: 'Alimentos', defaultTaxRate: 'excluded', expiredSalePolicy: 'allow', isActive: true, productCount: 2, children: [] }]
const ROWS = [
  { productId: 5, code: 'P-00005', name: 'Concentrado cerdos', unitSymbol: 'kg', salePrice: '2000.00', newSalePrice: '2100.00', presentations: [{ id: 3, name: 'Bulto 40 kg', salePrice: '80000.00', newSalePrice: '84000.00' }] },
  { productId: 6, code: 'P-00006', name: 'Sal mineralizada', unitSymbol: 'kg', salePrice: '3000.00', newSalePrice: '3200.00', presentations: [] },
]

const page = (rows) => ({ status: 200, body: { success: true, data: rows, meta: { page: 1, pageSize: 20, total: rows.length, totalPages: 1 }, message: 'ok' } })

const baseRoutes = (permissions = PRICES) => ({
  'GET /auth/me': session(buildUser({ permissions }), BASIC_PLAN),
  'GET /health': healthyResponse,
  'GET /notifications/unread-count': ok({ unread: 0 }),
  'GET /notifications': page([]),
  'GET /branding': ok({ name: 'Agro El Campo', logo: null }),
  'GET /me/preferences': ok({ theme: 'system' }),
  'GET /categories': ok(TREE),
  'GET /suppliers': page([]),
  'POST /products/bulk-prices/preview': ok({ count: ROWS.length, rows: ROWS }),
})

beforeEach(() => window.localStorage.clear())
afterEach(() => restoreApi())

/** Escribe el cambio y pide la vista previa. */
async function previewChange(user, { direction = 'Subir', value = '5' } = {}) {
  await user.selectOptions(await screen.findByLabelText('¿Subir o bajar?'), direction)
  await user.type(screen.getByLabelText(/^Porcentaje/), value)
  await user.click(screen.getByRole('button', { name: 'Ver cómo quedan' }))
  return screen.findByRole('region', { name: 'Vista previa' })
}

describe('Cambiar precios en bloque', () => {
  it('«Ver cómo quedan» manda el cambio (bajar = negativo) y muestra el precio de antes y el nuevo', async () => {
    const user = userEvent.setup()
    const calls = mockApi(baseRoutes())
    renderApp('/inventario/cambiar-precios')

    const preview = await previewChange(user, { direction: 'Bajar', value: '5' })
    expect(calls.find((call) => call.url === '/products/bulk-prices/preview').data).toEqual({ change: { type: 'percent', value: '-5' }, includePurchasePrice: false })

    const row = within(preview).getByText('Concentrado cerdos').closest('tr')
    expect(within(row).getByText('$ 2.000')).toBeInTheDocument()
    expect(within(row).getByText('$ 2.100')).toBeInTheDocument()
    expect(within(row).getByText('$ 84.000')).toBeInTheDocument()
    expect(within(preview).getByText(/2 de 2 productos marcados/)).toBeInTheDocument()
  })

  it('sin valor no pide la vista previa', async () => {
    const user = userEvent.setup()
    const calls = mockApi(baseRoutes())
    renderApp('/inventario/cambiar-precios')
    await user.click(await screen.findByRole('button', { name: 'Ver cómo quedan' }))
    expect(screen.getByText('Escribe el porcentaje (ej. 5)')).toBeInTheDocument()
    expect(calls.some((call) => call.url === '/products/bulk-prices/preview')).toBe(false)
  })

  it('desmarcar uno y aplicar manda solo los productos marcados', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ ...baseRoutes(), 'POST /products/bulk-prices/apply': { status: 200, body: { success: true, data: { updated: 1, unchanged: 0, belowCost: 0 }, message: 'Precios actualizados en 1 producto' } } })
    renderApp('/inventario/cambiar-precios')

    const preview = await previewChange(user)
    await user.click(within(preview).getByLabelText('Cambiar Sal mineralizada'))
    await user.click(within(preview).getByRole('button', { name: 'Aplicar a 1 producto' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Cambiar precios' })).getByRole('button', { name: 'Cambiar precios' }))

    await waitFor(() => expect(calls.some((call) => call.url === '/products/bulk-prices/apply')).toBe(true))
    expect(calls.find((call) => call.url === '/products/bulk-prices/apply').data).toEqual({ productIds: [5], change: { type: 'percent', value: '5' }, includePurchasePrice: false, confirmBelowCost: false })
    expect(await screen.findByText('Precios actualizados en 1 producto')).toBeInTheDocument()
  })

  it('si quedan bajo el costo pide confirmación y reintenta con confirmBelowCost', async () => {
    const user = userEvent.setup()
    const calls = mockApi({
      ...baseRoutes(),
      'POST /products/bulk-prices/apply': (call) =>
        call.data.confirmBelowCost
          ? { status: 200, body: { success: true, data: { updated: 2, unchanged: 0, belowCost: 1 }, message: 'Precios actualizados en 2 productos' } }
          : fail(409, 'CONFIRMATION_REQUIRED', 'Un producto queda por debajo del costo: Sal mineralizada. Confirma si quieres dejarlos así'),
    })
    renderApp('/inventario/cambiar-precios')

    const preview = await previewChange(user, { direction: 'Bajar', value: '30' })
    await user.click(within(preview).getByRole('button', { name: 'Aplicar a 2 productos' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Cambiar precios' })).getByRole('button', { name: 'Cambiar precios' }))

    const warning = await screen.findByRole('dialog', { name: 'Precios por debajo del costo' })
    expect(within(warning).getByText(/Sal mineralizada/)).toBeInTheDocument()
    await user.click(within(warning).getByRole('button', { name: 'Sí, cambiar así' }))

    expect(await screen.findByText('Precios actualizados en 2 productos')).toBeInTheDocument()
    const applies = calls.filter((call) => call.url === '/products/bulk-prices/apply')
    expect(applies.map((call) => call.data.confirmBelowCost)).toEqual([false, true])
    expect(applies[1].data).toMatchObject({ productIds: [5, 6], change: { type: 'percent', value: '-30' } })
  })
})
