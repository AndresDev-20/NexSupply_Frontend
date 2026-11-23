// Pedido sugerido (D-COMP-10) con el backend simulado: escoger el proveedor, ajustar cantidades
// y crear la compra en borrador.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '../../test/renderWithProviders'
import { BASIC_PLAN, buildUser, healthyResponse, mockApi, ok, restoreApi, session } from '../../test/mockApi'

const PLAN = { ...BASIC_PLAN, features: [...BASIC_PLAN.features, 'purchases'] }
const ALL = ['purchases.view', 'purchases.create', 'suppliers.view', 'inventory.view', 'inventory.cost_view']
const CONTEGRAL = { id: 7, documentType: 'NIT', documentNumber: '900123456', legalName: 'Contegral S.A.S.', tradeName: 'Contegral', isActive: true }
const SUGGESTIONS = {
  supplier: { id: 7, name: 'Contegral', phone: '3001234567' },
  coverDays: 15,
  historyDays: 30,
  rows: [
    { productId: 5, code: 'P-00005', name: 'Concentrado cerdos', unitSymbol: 'kg', presentationId: 3, presentationName: 'Bulto 40 kg', available: '80.000', dailyAverage: '20.000', minStock: '0.000', reason: 'sales', suggestedQuantity: '6.000', unitCost: '80000.0000', estimatedTotal: '480000.00', taxRate: 'excluded' },
    { productId: 6, code: 'P-00006', name: 'Sal mineralizada', unitSymbol: 'kg', presentationId: null, presentationName: null, available: '2.000', dailyAverage: '0.000', minStock: '10.000', reason: 'min_stock', suggestedQuantity: '8.000', unitCost: '3000.0000', estimatedTotal: '24000.00', taxRate: '5' },
  ],
}

const page = (rows) => ({ status: 200, body: { success: true, data: rows, meta: { page: 1, pageSize: 20, total: rows.length, totalPages: 1 }, message: 'ok' } })

const baseRoutes = (permissions = ALL) => ({
  'GET /auth/me': session(buildUser({ permissions }), PLAN),
  'GET /health': healthyResponse,
  'GET /notifications/unread-count': ok({ unread: 0 }),
  'GET /notifications': page([]),
  'GET /branding': ok({ name: 'Agro El Campo', logo: null }),
  'GET /me/preferences': ok({ theme: 'system' }),
  'GET /suppliers': page([CONTEGRAL]),
  'GET /purchases/reorder-suggestions': ok(SUGGESTIONS),
})

beforeEach(() => window.localStorage.clear())
afterEach(() => restoreApi())

/** Escoge a Contegral cuando ya cargaron los proveedores. */
async function chooseSupplier(user) {
  await screen.findByRole('option', { name: 'Contegral' })
  await user.selectOptions(screen.getByLabelText('Proveedor'), 'Contegral')
}

describe('Pedido sugerido', () => {
  it('al escoger el proveedor pide la sugerencia con los días a cubrir y la muestra', async () => {
    const user = userEvent.setup()
    const calls = mockApi(baseRoutes())
    renderApp('/compras/pedido-sugerido')

    expect(await screen.findByText('Escoge un proveedor para ver qué pedirle.')).toBeInTheDocument()
    expect(calls.some((call) => call.url === '/purchases/reorder-suggestions')).toBe(false)
    await chooseSupplier(user)

    const row = (await screen.findByText('Concentrado cerdos')).closest('tr')
    expect(calls.find((call) => call.url === '/purchases/reorder-suggestions').params).toEqual({ supplierId: '7', coverDays: 15 })
    expect(within(row).getByLabelText('Cantidad de Concentrado cerdos')).toHaveValue('6')
    expect(within(row).getByText('$ 480.000')).toBeInTheDocument()
    expect(screen.getByText('Sin ventas: hasta el mínimo')).toBeInTheDocument()

    // Otros días a cubrir: otra consulta
    const days = screen.getByLabelText(/^Días a cubrir/)
    await user.clear(days)
    await user.type(days, '30')
    await waitFor(() => expect(calls.some((call) => call.url === '/purchases/reorder-suggestions' && call.params.coverDays === 30)).toBe(true))
  })

  it('con la cantidad editada y un producto desmarcado crea la compra en borrador', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ ...baseRoutes(), 'POST /purchases': ok({ id: 12, status: 'draft' }), 'GET /purchases/12': () => new Promise(() => {}) })
    const { router } = renderApp('/compras/pedido-sugerido')

    await chooseSupplier(user)
    const quantity = await screen.findByLabelText('Cantidad de Concentrado cerdos')
    await user.clear(quantity)
    await user.type(quantity, '10')
    expect(screen.getByText('$ 800.000')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Crear compra en borrador' }))

    await waitFor(() => expect(calls.some((call) => call.method === 'POST' && call.url === '/purchases')).toBe(true))
    expect(calls.find((call) => call.method === 'POST').data).toEqual({
      supplierId: 7,
      notes: 'Pedido sugerido para 15 días',
      items: [
        { productId: 5, presentationId: 3, quantity: '10', unitPrice: '80000.0000', taxRate: 'excluded' },
        { productId: 6, quantity: '8', unitPrice: '3000.0000', taxRate: '5' },
      ],
    })
    expect(await screen.findByText('Compra en borrador creada: ajústala y confírmala cuando llegue la mercancía')).toBeInTheDocument()
    await waitFor(() => expect(router.state.location.pathname).toBe('/compras/12'))
  })

  it('lo desmarcado no va en la compra', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ ...baseRoutes(), 'POST /purchases': ok({ id: 12, status: 'draft' }), 'GET /purchases/12': () => new Promise(() => {}) })
    renderApp('/compras/pedido-sugerido')

    await chooseSupplier(user)
    await user.click(await screen.findByLabelText('Pedir Sal mineralizada'))
    expect(screen.getByText(/1 producto · total aproximado/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Crear compra en borrador' }))

    await waitFor(() => expect(calls.some((call) => call.method === 'POST' && call.url === '/purchases')).toBe(true))
    expect(calls.find((call) => call.method === 'POST').data.items).toEqual([{ productId: 5, presentationId: 3, quantity: '6', unitPrice: '80000.0000', taxRate: 'excluded' }])
  })
})
