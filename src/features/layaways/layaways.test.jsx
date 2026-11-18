// Fase 10b — Apartados y saldo a favor.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '../../test/renderWithProviders'
import { BASIC_PLAN, buildUser, healthyResponse, mockApi, ok, restoreApi, session } from '../../test/mockApi'

const PLAN = { ...BASIC_PLAN, features: [...BASIC_PLAN.features, 'sales', 'cash', 'customers'] }
const ALL = ['sales.create', 'sales.view', 'cash.view', 'customers.view', 'layaways.view', 'layaways.create', 'layaways.deliver', 'layaways.extend', 'layaways.cancel']
const METHODS = [
  { id: 1, name: 'Efectivo', isCash: true, requiresReference: false, isActive: true },
  { id: 2, name: 'Nequi', isCash: false, requiresReference: true, isActive: true },
  { id: 6, name: 'Saldo a favor', isCash: false, requiresReference: false, isActive: true, isCustomerCredit: true },
]
const TOOL = { id: 8, code: 'P-00008', name: 'Guadaña', unit: { id: 1, name: 'Unidad', symbol: 'und', allowsDecimals: false }, salePrice: '200000.00', taxRate: 'excluded', barcode: '7700000000099', stock: '3.000', reservedStock: '0.000', tracksBatches: false, expiredSalePolicy: 'authorization', presentations: [], matchedPresentationId: null }
const SESSION = { id: 9, register: { id: 1, name: 'Mostrador' }, openedAt: '2026-11-17T12:00:00.000Z', status: 'open' }
const TOTALS = { subtotal: '400000.00', lineDiscountTotal: '0.00', globalDiscount: '0.00', discountTotal: '0.00', discountPercent: '0.00', taxBase: '400000.00', taxTotal: '0.00', totalBeforeRounding: '400000.00', roundingAdjustment: '0.00', total: '400000.00' }
const PREVIEW = { totals: TOTALS, lines: [{ productId: 8, presentationId: null, gross: '400000.00', lineDiscount: '0.00', total: '400000.00' }], requires: { discount: false, expired: false }, warnings: { belowCost: [], expired: [] }, taxEnabled: false }
const CUSTOMER = { id: 4, name: 'Pedro Gómez', phone: '3001234567', balance: '0.00', creditBalance: '0.00' }

const LAYAWAY = {
  id: 1,
  number: 'APA-000001',
  status: 'active',
  statusLabel: 'Pagando',
  isOverdue: false,
  daysToDue: 30,
  dueDate: '2026-12-17',
  customer: { ...CUSTOMER, documentType: 'CC', documentNumber: '1075' },
  subtotal: '400000.00',
  discountTotal: '0.00',
  taxEnabled: false,
  taxTotal: '0.00',
  total: '400000.00',
  amountPaid: '100000.00',
  balance: '300000.00',
  createdAt: '2026-11-17T15:00:00.000Z',
  createdBy: { id: 1, fullName: 'Robinson Barrios' },
  items: [{ id: 1, productName: 'Guadaña', productCode: 'P-00008', unitSymbol: 'und', presentationName: null, quantity: '2.000', unitPrice: '200000.00', gross: '400000.00', lineDiscount: '0.00', total: '400000.00' }],
  installments: [{ id: 1, installmentNumber: 1, dueDate: '2026-12-17', amount: '400000.00', paidAmount: '100000.00', pending: '300000.00' }],
  payments: [{ id: 3, number: 'AB-000003', paidAt: '2026-11-17T15:00:00.000Z', method: 'Efectivo', status: 'active', amount: '100000.00' }],
  sale: null,
}
const BUSINESS = { name: 'Agro El Campo', nit: '900123456-7', address: 'Calle 1', phone: null, whatsapp: null, hasLogo: false }
const RECEIPT_SETTINGS = { title: 'Comprobante de venta', legalNotice: 'Documento comercial interno. No es una factura electrónica.', paperFormat: '80mm', showLogo: false, taxRegime: 'No responsable de IVA', footerMessage: null }

const page = (rows, meta = {}) => ({ status: 200, body: { success: true, data: rows, meta: { page: 1, pageSize: 20, total: rows.length, totalPages: 1, ...meta }, message: 'ok' } })

const baseRoutes = (permissions = ALL) => ({
  'GET /auth/me': session(buildUser({ permissions }), PLAN),
  'GET /health': healthyResponse,
  'GET /notifications/unread-count': ok({ unread: 0 }),
  'GET /notifications': page([]),
  'GET /branding': ok({ name: 'Agro El Campo', logo: null }),
  'GET /me/preferences': ok({ theme: 'system' }),
  'GET /payment-methods': ok(METHODS),
  'GET /cash-sessions': page([SESSION]),
  'GET /sales/catalog': ok([TOOL]),
  'POST /sales/preview': ok(PREVIEW),
  'GET /customers': page([CUSTOMER]),
  'GET /layaways/terms': ok({ minDownPaymentPercent: 20, minDownPayment: '80000.00', defaultDueDate: '2026-12-17' }),
  'GET /layaways/1/receipt': ok({ layaway: LAYAWAY, business: BUSINESS, receipt: RECEIPT_SETTINGS }),
})

afterEach(() => {
  restoreApi()
  window.localStorage.clear()
})

/** Agrega 2 guadañas y escoge al cliente. */
async function prepareSale(user, customer = CUSTOMER) {
  const search = await screen.findByLabelText('Escanea o busca el producto')
  await user.type(search, '7700000000099{Enter}')
  expect(await screen.findByText('Guadaña')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Sumar 1 a Guadaña' }))
  await user.type(screen.getByLabelText('Cliente'), 'Pedro')
  await user.click(await screen.findByRole('button', { name: new RegExp(customer.name) }))
  await waitFor(() => expect(screen.getByRole('button', { name: /Cobrar/ })).toBeEnabled())
}

describe('apartar desde el punto de venta', () => {
  it('exige el abono mínimo y aparta con el cliente; muestra el comprobante de apartado', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ ...baseRoutes(), 'POST /layaways': { status: 201, body: { success: true, data: LAYAWAY, message: 'Apartado APA-000001 registrado' } } })
    renderApp('/ventas/punto-de-venta')
    await prepareSale(user)

    const pay = screen.getByRole('form', { name: 'Cobro' })
    await user.click(within(pay).getByRole('radio', { name: 'Apartar' }))
    expect(await within(pay).findByText('Mínimo $ 80.000 (20 % del total)')).toBeInTheDocument()
    await user.type(within(pay).getByLabelText(/^Abono inicial/), '50.000')
    // El total del botón "cuenta" hasta $ 400.000 (animación): se busca por el inicio
    await user.click(within(pay).getByRole('button', { name: /^Apartar/ }))
    expect(await within(pay).findByText('El abono inicial mínimo es $ 80.000 (20 %)')).toBeInTheDocument()
    expect(calls.some((call) => call.url === '/layaways' && call.method === 'POST')).toBe(false)

    await user.click(within(pay).getByRole('button', { name: 'El mínimo' }))
    expect(within(pay).getByText('$ 320.000')).toBeInTheDocument()
    await user.click(within(pay).getByRole('button', { name: /^Apartar/ }))

    const body = await waitFor(() => {
      const call = calls.find((item) => item.method === 'POST' && item.url === '/layaways')
      expect(call).toBeTruthy()
      return call.data
    })
    expect(body).toMatchObject({ cashSessionId: 9, customerId: 4, items: [{ productId: 8, quantity: '2' }], payments: [{ paymentMethodId: 1, amount: '80000' }], paymentMode: 'free' })
    expect(body.idempotencyKey).toEqual(expect.any(String))

    const receipt = await screen.findByRole('dialog', { name: 'Apartado APA-000001' })
    expect(within(receipt).getByText('¡Producto apartado!')).toBeInTheDocument()
    expect(within(receipt).getByText('Comprobante de apartado')).toBeInTheDocument()
    expect(within(receipt).getByRole('button', { name: /Imprimir tirilla/ })).toBeInTheDocument()
    expect(within(receipt).getByRole('link', { name: /Ver el apartado/ })).toHaveAttribute('href', '/apartados/1')
  })

  it('"Saldo a favor" solo aparece si el cliente tiene saldo', async () => {
    const user = userEvent.setup()
    mockApi({ ...baseRoutes(), 'GET /customers': page([{ ...CUSTOMER, creditBalance: '50000.00' }]) })
    renderApp('/ventas/punto-de-venta')
    const search = await screen.findByLabelText('Escanea o busca el producto')
    await user.type(search, '7700000000099{Enter}')
    const pay = await screen.findByRole('form', { name: 'Cobro' })
    expect(within(pay).queryByRole('radio', { name: /Saldo a favor/ })).not.toBeInTheDocument()
    await user.type(screen.getByLabelText('Cliente'), 'Pedro')
    await user.click(await screen.findByRole('button', { name: /Pedro Gómez/ }))
    expect(await within(pay).findByRole('radio', { name: /Saldo a favor/ })).toHaveTextContent(/Tiene \$\s50\.000/)
    expect(screen.getByText(/Saldo a favor \$ 50\.000/)).toBeInTheDocument()
  })
})

describe('lista y detalle de apartados', () => {
  it('muestra el resumen y filtra los vencidos', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ ...baseRoutes(), 'GET /layaways': page([LAYAWAY], { summary: { active: 1, overdue: 0, readyToDeliver: 2, pendingBalance: '300000.00' } }) })
    renderApp('/apartados')
    expect(await screen.findByRole('link', { name: 'APA-000001' })).toHaveAttribute('href', '/apartados/1')
    const tiles = screen.getByRole('region', { name: 'Resumen de apartados' })
    expect(within(tiles).getByText('Por entregar')).toBeInTheDocument()
    expect(within(tiles).getByText('$ 300.000')).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Vencidos' }))
    await waitFor(() => expect(calls.filter((call) => call.url === '/layaways').at(-1).params).toMatchObject({ status: 'overdue' }))
  })

  it('entrega un apartado pagado y abre el comprobante de la venta', async () => {
    const user = userEvent.setup()
    const paid = { ...LAYAWAY, status: 'paid', statusLabel: 'Pagado, por entregar', amountPaid: '400000.00', balance: '0.00', daysToDue: 30 }
    const sale = { id: 40, number: 'V-000040', saleType: 'layaway', saleTypeLabel: 'Apartado', customer: { id: 4, name: 'Pedro Gómez', isFinalConsumer: false }, seller: { id: 1, fullName: 'Robinson Barrios' }, register: { id: 1, name: 'Mostrador' }, subtotal: '400000.00', discountTotal: '0.00', taxEnabled: false, taxTotal: '0.00', roundingAdjustment: '0.00', total: '400000.00', amountPaid: '400000.00', creditAmount: '0.00', createdAt: '2026-11-18T15:00:00.000Z', layaway: { id: 1, number: 'APA-000001' }, items: LAYAWAY.items, payments: [] }
    const calls = mockApi({
      ...baseRoutes(),
      'GET /layaways/1': ok(paid),
      'POST /layaways/1/deliver': { status: 201, body: { success: true, data: { layaway: { ...paid, status: 'delivered' }, sale }, message: 'Apartado APA-000001 entregado: venta V-000040' } },
      'GET /sales/40/receipt': ok({ sale, business: BUSINESS, receipt: RECEIPT_SETTINGS, emailEnabled: false }),
    })
    renderApp('/apartados/1')
    expect(await screen.findByText('Pagado: listo para entregar')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Entregar' }))
    const dialog = await screen.findByRole('dialog', { name: 'Entregar el apartado APA-000001' })
    await user.click(within(dialog).getByRole('button', { name: 'Entregar' }))
    await waitFor(() => expect(calls.find((call) => call.url === '/layaways/1/deliver').data).toEqual({ cashSessionId: 9 }))
    const receipt = await screen.findByRole('dialog', { name: 'Comprobante V-000040' })
    expect(within(receipt).getAllByText('Pagado con abonos del apartado APA-000001').length).toBeGreaterThan(0)
  })

  it('al cancelar reparte lo abonado y avisa si no suma', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ ...baseRoutes(), 'GET /layaways/1': ok(LAYAWAY), 'POST /layaways/1/cancel': ok({ ...LAYAWAY, status: 'cancelled' }, 'Apartado APA-000001 cancelado') })
    renderApp('/apartados/1')
    await user.click(await screen.findByRole('button', { name: 'Cancelar' }))
    const dialog = await screen.findByRole('dialog', { name: 'Cancelar el apartado APA-000001' })
    // Por defecto todo queda a favor
    expect(within(dialog).getByLabelText(/^Saldo a favor/)).toHaveValue('100.000')
    await user.clear(within(dialog).getByLabelText(/^Saldo a favor/))
    await user.type(within(dialog).getByLabelText(/^Saldo a favor/), '60.000')
    await user.type(within(dialog).getByLabelText(/^Se retiene/), '10.000')
    await user.type(within(dialog).getByLabelText(/¿Por qué se cancela\?/), 'El cliente desistió')
    expect(within(dialog).getByText('Falta repartir $ 30.000')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar apartado' }))
    expect(await within(dialog).findByText('Falta repartir $ 30.000', { selector: '.alert *' })).toBeInTheDocument()

    await user.type(within(dialog).getByLabelText(/^Se le devuelve/), '30.000')
    expect(within(dialog).getByText('¡Repartido completo!')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar apartado' }))
    await waitFor(() =>
      expect(calls.find((call) => call.url === '/layaways/1/cancel').data).toEqual({ reason: 'El cliente desistió', retainedAmount: '10000', refundAmount: '30000', creditAmount: '60000', cashSessionId: 9, refundPaymentMethodId: 1 }),
    )
  })
})
