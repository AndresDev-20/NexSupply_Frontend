// Fase 10 — Punto de venta, cobro, autorización, comprobante e historial.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '../../test/renderWithProviders'
import { BASIC_PLAN, buildUser, fail, healthyResponse, mockApi, ok, restoreApi, session } from '../../test/mockApi'

const PLAN = { ...BASIC_PLAN, features: [...BASIC_PLAN.features, 'sales', 'cash', 'customers'] }
const ALL = ['sales.create', 'sales.view', 'sales.credit', 'cash.view', 'customers.view', 'inventory.cost_view']
const METHODS = [
  { id: 1, name: 'Efectivo', isCash: true, requiresReference: false, isActive: true },
  { id: 2, name: 'Nequi', isCash: false, requiresReference: true, isActive: true },
]
const FEED = {
  id: 5,
  code: 'P-00005',
  name: 'Concentrado cerdos',
  unit: { id: 2, name: 'Kilogramo', symbol: 'kg', allowsDecimals: true },
  salePrice: '2600.00',
  taxRate: 'excluded',
  barcode: '7700000000011',
  stock: '400.000',
  tracksBatches: false,
  expiredSalePolicy: 'authorization',
  presentations: [{ id: 3, name: 'Bulto 40 kg', factor: '40.000', salePrice: '100000.00', barcode: '7700000000028' }],
  matchedPresentationId: 3,
}
const SESSION = { id: 9, register: { id: 1, name: 'Mostrador' }, openedAt: '2026-11-17T12:00:00.000Z', status: 'open' }
const TOTALS = { subtotal: '200000.00', lineDiscountTotal: '0.00', globalDiscount: '0.00', discountTotal: '0.00', discountPercent: '0.00', taxBase: '200000.00', taxTotal: '0.00', totalBeforeRounding: '200000.00', roundingAdjustment: '0.00', total: '200000.00' }
const previewOf = (overrides = {}) => ({ totals: TOTALS, lines: [{ productId: 5, presentationId: 3, gross: '200000.00', lineDiscount: '0.00', total: '200000.00' }], requires: { discount: false, expired: false }, warnings: { belowCost: [], expired: [] }, taxEnabled: false, ...overrides })

const SALE = {
  id: 31,
  number: 'V-000031',
  saleType: 'cash',
  saleTypeLabel: 'Contado',
  customer: { id: 1, name: 'Consumidor final', isFinalConsumer: true },
  seller: { id: 1, fullName: 'Robinson Barrios' },
  register: { id: 1, name: 'Mostrador' },
  subtotal: '200000.00',
  discountTotal: '0.00',
  taxBase: '200000.00',
  taxTotal: '0.00',
  taxEnabled: false,
  roundingAdjustment: '0.00',
  total: '200000.00',
  amountPaid: '200000.00',
  creditAmount: '0.00',
  changeAmount: '50000.00',
  createdAt: '2026-11-17T15:00:00.000Z',
  items: [{ id: 1, productName: 'Concentrado cerdos', unitSymbol: 'kg', presentationName: 'Bulto 40 kg', quantity: '2.000', unitPrice: '100000.00', gross: '200000.00', lineDiscount: '0.00', total: '200000.00' }],
  payments: [{ id: 1, paymentMethod: { id: 1, name: 'Efectivo' }, isCash: true, amount: '200000.00', received: '250000.00', change: '50000.00' }],
}
const RECEIPT = {
  sale: SALE,
  business: { name: 'Agro El Campo', nit: '900123456-7', address: 'Calle 1', phone: null, whatsapp: null, hasLogo: false },
  receipt: { title: 'Comprobante de venta', legalNotice: 'Documento comercial interno. No es una factura electrónica.', paperFormat: '80mm', showLogo: false, taxRegime: 'No responsable de IVA', footerMessage: 'Gracias por su compra' },
  emailEnabled: true,
}

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
  'GET /sales/catalog': ok([FEED]),
  'POST /sales/preview': ok(previewOf()),
  'GET /sales/31/receipt': ok(RECEIPT),
  'GET /customers': page([]),
})

afterEach(() => {
  restoreApi()
  window.localStorage.clear()
})

/** Escanea el código del bulto y espera los totales del servidor. */
async function scanBulto(user) {
  const search = await screen.findByLabelText('Escanea o busca el producto')
  await user.type(search, '7700000000028{Enter}')
  expect(await screen.findByText('Concentrado cerdos')).toBeInTheDocument()
  // Entra como bulto (el código era el del bulto)
  expect(within(screen.getByRole('radiogroup', { name: 'Unidad de Concentrado cerdos' })).getByRole('radio', { name: 'Bulto 40 kg' })).toHaveAttribute('aria-checked', 'true')
  // "Cobrar" se activa cuando llegan los totales del servidor
  await waitFor(() => expect(screen.getByRole('button', { name: /Cobrar/ })).toBeEnabled())
}

describe('punto de venta', () => {
  it('sin caja abierta no se puede vender', async () => {
    mockApi({ ...baseRoutes(), 'GET /cash-sessions': page([]) })
    renderApp('/ventas/punto-de-venta')
    expect(await screen.findByText('No hay ninguna caja abierta')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir a Mis cajas de hoy' })).toBeInTheDocument()
  })

  it('escanea un bulto, suma con el botón y cobra en efectivo con cambio', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ ...baseRoutes(), 'POST /sales': ok(SALE) })
    renderApp('/ventas/punto-de-venta')

    await scanBulto(user)
    await user.click(screen.getByRole('button', { name: 'Sumar 1 a Concentrado cerdos' }))
    expect(screen.getByLabelText('Cantidad de Concentrado cerdos')).toHaveValue('2')
    await waitFor(() => expect(calls.filter((call) => call.url === '/sales/preview').at(-1).data).toEqual({ items: [{ productId: 5, presentationId: 3, quantity: '2' }] }))
    expect(await screen.findAllByText('$ 200.000')).not.toHaveLength(0)

    // El pago está a la vista en la tarjeta de la venta, con efectivo escogido
    const pay = screen.getByRole('form', { name: 'Cobro' })
    expect(within(pay).getByRole('radio', { name: 'Efectivo' })).toHaveAttribute('aria-checked', 'true')
    await user.type(within(pay).getByLabelText(/^Recibido/), '250.000')
    expect(await within(pay).findByText('$ 50.000')).toBeInTheDocument()
    await waitFor(() => expect(within(pay).getByRole('button', { name: /Cobrar/ })).toBeEnabled())
    await user.click(within(pay).getByRole('button', { name: /Cobrar/ }))

    expect(await screen.findByText('Venta V-000031 registrada')).toBeInTheDocument()
    const receipt = await screen.findByRole('dialog', { name: 'Comprobante V-000031' })
    expect(within(receipt).getByText('¡Venta registrada!')).toBeInTheDocument()
    expect(within(receipt).getByText('Entregar de cambio')).toBeInTheDocument()
    expect(within(receipt).getByText('Documento comercial interno. No es una factura electrónica.')).toBeInTheDocument()
    expect(within(receipt).getByRole('button', { name: /WhatsApp/ })).toBeInTheDocument()
    expect(within(receipt).getByRole('button', { name: /Enviar por correo/ })).toBeEnabled()
    expect(within(receipt).getByRole('button', { name: /Imprimir tirilla/ })).toBeInTheDocument()
    expect(within(receipt).getByRole('button', { name: /Imprimir carta/ })).toBeInTheDocument()
    // Vista previa en carta: tabla de productos
    await user.click(within(receipt).getByRole('radio', { name: 'Carta' }))
    expect(within(receipt).getByRole('columnheader', { name: 'Producto' })).toBeInTheDocument()
    const body = calls.find((call) => call.method === 'POST' && call.url === '/sales').data
    expect(body).toEqual({
      items: [{ productId: 5, presentationId: 3, quantity: '2' }],
      cashSessionId: 9,
      idempotencyKey: expect.stringMatching(/^[A-Za-z0-9_-]{8,64}$/),
      payments: [{ paymentMethodId: 1, amount: '200000', received: '250000' }],
    })

    // "Nueva venta" deja el carrito vacío
    await user.click(within(receipt).getByRole('button', { name: 'Nueva venta' }))
    expect(await screen.findByText('Busca o escanea un producto para empezar la venta.')).toBeInTheDocument()
  })

  it('vende medio bulto: «½ Bulto» manda 0,5 del bulto y vuelve al bulto completo con 1', async () => {
    const user = userEvent.setup()
    const calls = mockApi(baseRoutes())
    renderApp('/ventas/punto-de-venta')

    await scanBulto(user)
    const units = screen.getByRole('radiogroup', { name: 'Unidad de Concentrado cerdos' })
    await user.click(within(units).getByRole('radio', { name: '½ Bulto 40 kg' }))
    expect(within(units).getByRole('radio', { name: '½ Bulto 40 kg' })).toHaveAttribute('aria-checked', 'true')
    expect(within(units).getByRole('radio', { name: 'Bulto 40 kg' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByLabelText('Cantidad de Concentrado cerdos')).toHaveValue('0,5')
    // El servidor cobra la mitad del precio del bulto
    await waitFor(() => expect(calls.filter((call) => call.url === '/sales/preview').at(-1).data).toEqual({ items: [{ productId: 5, presentationId: 3, quantity: '0.5' }] }))

    await user.click(within(units).getByRole('radio', { name: 'Bulto 40 kg' }))
    expect(screen.getByLabelText('Cantidad de Concentrado cerdos')).toHaveValue('1')
  })

  it('si el servidor pide autorización, pide la clave del supervisor y reintenta con la misma clave de venta', async () => {
    const user = userEvent.setup()
    let attempts = 0
    const calls = mockApi({
      ...baseRoutes(),
      'POST /sales/preview': ok(previewOf({ requires: { discount: true, expired: false }, warnings: { belowCost: [], expired: [] } })),
      'POST /sales': () => {
        attempts += 1
        return attempts === 1 ? fail(409, 'AUTHORIZATION_REQUIRED', 'El descuento pasa tu tope', [{ field: 'discountAuthorization', message: 'discount' }]) : ok(SALE)
      },
      'POST /sales/authorizations': ok({ token: 'abc123token', scope: 'discount', authorizedBy: { id: 1, fullName: 'Robinson Barrios' } }),
    })
    renderApp('/ventas/punto-de-venta')

    await scanBulto(user)
    expect(await screen.findByText(/El descuento pasa tu tope\. Al cobrar se pedirá autorización/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Cobrar/ }))

    const auth = await screen.findByRole('dialog', { name: 'Autorizar descuento' })
    await user.type(within(auth).getByLabelText('Usuario de quien autoriza'), 'robinson')
    await user.type(within(auth).getByLabelText('Contraseña'), 'clave-de-prueba')
    await user.click(within(auth).getByRole('button', { name: 'Autorizar' }))

    expect(await screen.findByText('Venta V-000031 registrada')).toBeInTheDocument()
    const posts = calls.filter((call) => call.method === 'POST' && call.url === '/sales')
    expect(posts).toHaveLength(2)
    expect(posts[1].data.discountAuthorization).toBe('abc123token')
    expect(posts[1].data.idempotencyKey).toBe(posts[0].data.idempotencyKey)
    expect(calls.find((call) => call.url === '/sales/authorizations').data).toEqual({ username: 'robinson', password: 'clave-de-prueba', scope: 'discount' })
  })

  it('fiado: exige cliente y manda el resto a la cartera', async () => {
    const user = userEvent.setup()
    const customer = { id: 4, name: 'Pedro Gómez', phone: '3001234567', documentNumber: null, balance: '0.00' }
    const calls = mockApi({ ...baseRoutes(), 'GET /customers': page([customer]), 'POST /sales': ok({ ...SALE, saleType: 'credit', creditAmount: '150000.00' }) })
    renderApp('/ventas/punto-de-venta')
    await scanBulto(user)

    const pay = screen.getByRole('form', { name: 'Cobro' })
    await user.click(within(pay).getByRole('radio', { name: /Fiado/ }))
    await user.click(within(pay).getByRole('button', { name: /Registrar fiado/ }))
    expect(within(pay).getByText('Para fiar, escoge el cliente arriba')).toBeInTheDocument()

    // Se escoge el cliente sin salir del cobro
    await user.type(screen.getByLabelText('Cliente'), 'Pedro')
    await user.click(await screen.findByRole('button', { name: /Pedro Gómez/ }))
    expect(screen.getByRole('button', { name: 'Quitar el cliente (Consumidor final)' })).toBeInTheDocument()
    await user.type(within(pay).getByLabelText(/Paga algo ahora/), '50.000')
    expect(within(pay).getByRole('radio', { name: 'Efectivo' })).toHaveAttribute('aria-checked', 'true')
    expect(within(pay).getByText('$ 150.000', { selector: 'strong' })).toBeInTheDocument()
    // Con el cliente cambian los precios (su lista, D-PRE-1): se cobra con la vista previa nueva
    await waitFor(() => expect(within(pay).getByRole('button', { name: /Registrar fiado/ })).toBeEnabled())
    expect(calls.some((call) => call.url === '/sales/preview' && call.data.customerId === 4)).toBe(true)
    await user.click(within(pay).getByRole('button', { name: /Registrar fiado/ }))

    await screen.findByRole('dialog', { name: 'Comprobante V-000031' })
    expect(calls.find((call) => call.method === 'POST' && call.url === '/sales').data).toMatchObject({ customerId: 4, payments: [{ paymentMethodId: 1, amount: '50000' }], credit: { paymentMode: 'free' } })
  })
})

describe('historial de ventas', () => {
  it('muestra el resumen del periodo y abre el comprobante', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ ...baseRoutes(), 'GET /sales': page([{ ...SALE, profit: '20000.00' }], { summary: { count: 1, total: '200000.00', credit: '0.00', paid: '200000.00', profit: '20000.00' } }) })
    renderApp('/ventas')
    expect(await screen.findByText('V-000031')).toBeInTheDocument()
    expect(screen.getByText('Utilidad', { selector: '.cash-tile__label' })).toBeInTheDocument()
    expect(calls.find((call) => call.url === '/sales').params).toMatchObject({ from: expect.any(String), to: expect.any(String) })
    await user.click(screen.getByRole('button', { name: 'Ver comprobante V-000031' }))
    expect(await screen.findByRole('dialog', { name: 'Comprobante V-000031' })).toBeInTheDocument()
  })
})
