// Cotizaciones (D-COT-1) con el backend simulado: la lista por estados, la ficha con «Vender esta
// cotización», el modo «Cotizar» del cobro y cotizar sin caja abierta.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '../../test/renderWithProviders'
import { BASIC_PLAN, buildUser, healthyResponse, mockApi, ok, restoreApi, session } from '../../test/mockApi'

const PLAN = { ...BASIC_PLAN, features: [...BASIC_PLAN.features, 'sales', 'cash', 'customers'] }
const ALL = ['sales.create', 'sales.view', 'cash.view', 'customers.view', 'quotes.view', 'quotes.create']
const FEED = { id: 5, code: 'P-00005', name: 'Concentrado cerdos', unit: { id: 2, name: 'Kilogramo', symbol: 'kg', allowsDecimals: true }, salePrice: '2200.00', taxRate: 'excluded', barcode: null, stock: '400.000', tracksBatches: false, expiredSalePolicy: 'authorization', presentations: [], matchedPresentationId: null }
const SESSION = { id: 9, register: { id: 1, name: 'Mostrador' }, openedAt: '2026-11-17T12:00:00.000Z', status: 'open' }
const TOTALS = { subtotal: '4400.00', lineDiscountTotal: '0.00', globalDiscount: '0.00', discountTotal: '0.00', discountPercent: '0.00', taxBase: '4400.00', taxTotal: '0.00', totalBeforeRounding: '4400.00', roundingAdjustment: '0.00', total: '4400.00' }
const PREVIEW = { totals: TOTALS, priceList: null, lines: [{ productId: 5, presentationId: null, unitPrice: '2200.00', gross: '4400.00', lineDiscount: '0.00', total: '4400.00' }], requires: { discount: false, expired: false }, warnings: { belowCost: [], expired: [] }, taxEnabled: false }

const CUSTOMER = { id: null, name: 'Pedro Gómez', phone: '3001234567', email: null, documentType: null, documentNumber: null, isFinalConsumer: false }
const quote = (id, number, state, stateLabel, extra = {}) => ({ id, number, state, stateLabel, validUntil: '2026-12-08', daysLeft: state === 'open' ? 15 : null, customer: CUSTOMER, priceList: null, seller: { id: 1, fullName: 'Robinson Barrios' }, subtotal: '4400.00', globalDiscount: '0.00', discountTotal: '0.00', taxTotal: '0.00', taxEnabled: false, roundingAdjustment: '0.00', total: '4400.00', notes: null, saleId: null, cancelledBy: null, cancelReason: null, createdAt: '2026-11-23T15:00:00.000Z', ...extra })
const OPEN = quote(5, 'COT-000005', 'open', 'Vigente')
const EXPIRED = quote(4, 'COT-000004', 'expired', 'Vencida')
const DETAIL = { ...OPEN, items: [{ id: 1, lineNumber: 1, productId: 5, presentationId: null, productCode: 'P-00005', productName: 'Concentrado cerdos', unitSymbol: 'kg', presentationName: null, quantity: '2.000', unitPrice: '2200.00', regularUnitPrice: '2200.00', gross: '4400.00', discountType: null, discountValue: null, lineDiscount: '0.00', total: '4400.00' }] }

const page = (rows) => ({ status: 200, body: { success: true, data: rows, meta: { page: 1, pageSize: 20, total: rows.length, totalPages: 1 }, message: 'ok' } })

const baseRoutes = (permissions = ALL) => ({
  'GET /auth/me': session(buildUser({ permissions }), PLAN),
  'GET /health': healthyResponse,
  'GET /notifications/unread-count': ok({ unread: 0 }),
  'GET /notifications': page([]),
  'GET /branding': ok({ name: 'Agro El Campo', logo: null }),
  'GET /me/preferences': ok({ theme: 'system' }),
  'GET /payment-methods': ok([{ id: 1, name: 'Efectivo', isCash: true, requiresReference: false, isActive: true }]),
  'GET /cash-sessions': page([SESSION]),
  'GET /customers': page([]),
  'GET /sales/catalog': ok([FEED]),
  'POST /sales/preview': ok(PREVIEW),
  'GET /quotes': (call) => page(call.params?.state ? [OPEN, EXPIRED].filter((row) => row.state === call.params.state) : [OPEN, EXPIRED]),
  'GET /quotes/5': ok(DETAIL),
})

beforeEach(() => window.localStorage.clear())
afterEach(() => restoreApi())

/** Busca el concentrado en el punto de venta y lo agrega al carrito. */
async function addFeed(user) {
  await user.type(await screen.findByRole('searchbox', { name: /Escanea o busca/ }), 'concen')
  await user.click(await screen.findByRole('button', { name: /Concentrado cerdos/ }))
}

describe('Cotizaciones', () => {
  it('lista las cotizaciones y filtra por estado', async () => {
    const user = userEvent.setup()
    const calls = mockApi(baseRoutes())
    renderApp('/ventas/cotizaciones')

    const row = (await screen.findByText('COT-000005')).closest('tr')
    expect(within(row).getByText('Pedro Gómez')).toBeInTheDocument()
    expect(within(row).getByText('Vigente')).toBeInTheDocument()
    expect(within(row).getByText('Vence en 15 días')).toBeInTheDocument()
    expect(screen.getByText('COT-000004')).toBeInTheDocument()

    await user.click(within(screen.getByRole('tablist', { name: 'Estado de las cotizaciones' })).getByRole('tab', { name: 'Vencidas' }))
    await waitFor(() => expect(screen.queryByText('COT-000005')).not.toBeInTheDocument())
    expect(calls.some((call) => call.url === '/quotes' && call.params?.state === 'expired')).toBe(true)
    expect(screen.getByText('COT-000004')).toBeInTheDocument()
  })

  it('«Vender esta cotización» abre el punto de venta con el carrito y sus precios', async () => {
    const user = userEvent.setup()
    const calls = mockApi(baseRoutes())
    renderApp('/ventas/cotizaciones/5')

    expect(await screen.findByRole('heading', { name: 'COT-000005' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Vender esta cotización' }))

    const banner = await screen.findByText(/Vendiendo la cotización/)
    expect(banner).toHaveTextContent('Vendiendo la cotización COT-000005 con sus precios.')
    expect(calls.some((call) => call.url === '/sales/catalog' && call.params?.search === 'P-00005')).toBe(true)
    expect(screen.getByLabelText('Cantidad de Concentrado cerdos')).toHaveValue('2')
    await waitFor(() => expect(calls.some((call) => call.url === '/sales/preview' && call.data.quoteId === 5)).toBe(true))
    expect(calls.filter((call) => call.url === '/quotes/5')).not.toHaveLength(0)
  })

  it('en el punto de venta, «Cotizar» manda la cotización sin pagos y abre su ficha', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ ...baseRoutes(), 'POST /quotes': ok(OPEN) })
    renderApp('/ventas/punto-de-venta')

    await addFeed(user)
    const pay = screen.getByRole('form', { name: 'Cobro' })
    await user.click(within(pay).getByRole('radio', { name: 'Cotizar' }))
    await waitFor(() => expect(calls.some((call) => call.url === '/sales/preview' && call.data.forQuote === true)).toBe(true))
    await user.type(within(pay).getByLabelText('¿Para quién?'), 'Pedro Gómez')
    await waitFor(() => expect(within(pay).getByRole('button', { name: /^Cotizar/ })).toBeEnabled())
    await user.click(within(pay).getByRole('button', { name: /^Cotizar/ }))

    expect(await screen.findByText('Cotización COT-000005 lista')).toBeInTheDocument()
    const body = calls.find((call) => call.method === 'POST' && call.url === '/quotes').data
    expect(body).toEqual({ idempotencyKey: expect.any(String), customerName: 'Pedro Gómez', customerPhone: null, items: [{ productId: 5, quantity: '1' }] })
    expect(body).not.toHaveProperty('payments')
    expect(await screen.findByRole('heading', { name: 'COT-000005' })).toBeInTheDocument()
  })

  it('sin caja abierta ofrece «Hacer una cotización» y solo deja cotizar', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ ...baseRoutes(), 'GET /cash-sessions': page([]), 'POST /quotes': ok(OPEN) })
    renderApp('/ventas/punto-de-venta')

    expect(await screen.findByText('No hay ninguna caja abierta')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Hacer una cotización' }))
    expect(await screen.findByText('No hay caja abierta: solo se puede cotizar.')).toBeInTheDocument()

    await addFeed(user)
    const pay = screen.getByRole('form', { name: 'Cobro' })
    expect(within(pay).queryByRole('radio', { name: 'Contado' })).not.toBeInTheDocument()
    await waitFor(() => expect(within(pay).getByRole('button', { name: /^Cotizar/ })).toBeEnabled())
    await user.click(within(pay).getByRole('button', { name: /^Cotizar/ }))
    await waitFor(() => expect(calls.some((call) => call.method === 'POST' && call.url === '/quotes')).toBe(true))
    expect(calls.find((call) => call.method === 'POST' && call.url === '/quotes').data).not.toHaveProperty('cashSessionId')
  })
})
