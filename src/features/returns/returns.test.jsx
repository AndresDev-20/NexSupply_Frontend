// Fase 11 — Devoluciones, anulación de ventas y cuarentena.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '../../test/renderWithProviders'
import { BASIC_PLAN, buildUser, fail, healthyResponse, mockApi, ok, restoreApi, session } from '../../test/mockApi'

const PLAN = { ...BASIC_PLAN, features: [...BASIC_PLAN.features, 'sales', 'cash', 'customers', 'inventory'] }
const CASHIER = ['sales.create', 'sales.view', 'cash.view', 'inventory.view']
const METHODS = [
  { id: 1, name: 'Efectivo', isCash: true, requiresReference: false, isActive: true },
  { id: 2, name: 'Nequi', isCash: false, requiresReference: true, isActive: true },
]
const SESSION = { id: 9, register: { id: 1, name: 'Mostrador' }, openedAt: '2026-11-17T12:00:00.000Z', status: 'open' }
const SALE = {
  id: 31,
  number: 'V-000031',
  status: 'completed',
  saleType: 'cash',
  saleTypeLabel: 'Contado',
  customer: { id: 1, name: 'Consumidor final', isFinalConsumer: true },
  seller: { id: 1, fullName: 'Robinson Barrios' },
  register: { id: 1, name: 'Mostrador' },
  total: '300000.00',
  creditAmount: '0.00',
  returnedTotal: '0.00',
  receivable: null,
  createdAt: '2026-11-17T15:00:00.000Z',
}
const RETURNABLE = {
  sale: SALE,
  maxDays: 30,
  daysSinceSale: 0,
  isLate: false,
  lines: [{ saleItemId: 50, productName: 'Concentrado cerdos', presentationName: 'Bulto 40 kg', unitSymbol: 'kg', quantity: '3.000', returnedQuantity: '0.000', returnableQuantity: '3.000', total: '300000.00', returnedAmount: '0.00' }],
}
const RETURN = {
  id: 7,
  number: 'DV-000001',
  sale: { id: 31, number: 'V-000031' },
  customer: { id: 1, name: 'Consumidor final', isFinalConsumer: true },
  reason: 'Se equivocó de producto',
  total: '100000.00',
  debtReduction: '0.00',
  refundedAmount: '100000.00',
  refundMethod: { id: 1, name: 'Efectivo' },
  creditedAmount: '0.00',
  createdAt: '2026-11-17T16:00:00.000Z',
  createdBy: { id: 1, fullName: 'Robinson Barrios' },
  items: [{ id: 1, productName: 'Concentrado cerdos', unitSymbol: 'kg', presentationName: 'Bulto 40 kg', quantity: '1.000', unitPrice: '100000.00', total: '100000.00', condition: 'sellable', conditionLabel: 'Vuelve a la venta' }],
}
const RECEIPT = {
  business: { name: 'Agro El Campo', nit: '900123456-7', address: 'Calle 1', phone: null, whatsapp: null, hasLogo: false },
  receipt: { title: 'Comprobante de venta', legalNotice: 'Documento comercial interno. No es una factura electrónica.', paperFormat: '80mm', showLogo: false, taxRegime: 'No responsable de IVA', footerMessage: null },
}

const page = (rows, meta = {}) => ({ status: 200, body: { success: true, data: rows, meta: { page: 1, pageSize: 20, total: rows.length, totalPages: 1, ...meta }, message: 'ok' } })

const baseRoutes = (permissions = CASHIER) => ({
  'GET /auth/me': session(buildUser({ permissions }), PLAN),
  'GET /health': healthyResponse,
  'GET /notifications/unread-count': ok({ unread: 0 }),
  'GET /notifications': page([]),
  'GET /branding': ok({ name: 'Agro El Campo', logo: null }),
  'GET /me/preferences': ok({ theme: 'system' }),
  'GET /payment-methods': ok(METHODS),
  'GET /cash-sessions': page([SESSION]),
  'GET /sales': page([SALE], { summary: { count: 1, total: '300000.00', credit: '0.00', paid: '300000.00', returned: '0.00' } }),
  'GET /sales/31/returnable': ok(RETURNABLE),
  'GET /sale-returns/7/receipt': ok({ saleReturn: RETURN, ...RECEIPT }),
})

afterEach(() => {
  restoreApi()
})

describe('devolver desde el historial de ventas', () => {
  it('sin permiso pide la clave del supervisor y reintenta; muestra el comprobante de devolución', async () => {
    const user = userEvent.setup()
    const calls = mockApi({
      ...baseRoutes(),
      'POST /sale-returns': (call) =>
        call.data.returnAuthorization ? { status: 201, body: { success: true, data: RETURN, message: 'Devolución DV-000001 registrada' } } : fail(409, 'AUTHORIZATION_REQUIRED', 'No tienes permiso para recibir devoluciones: pide la clave de un supervisor', [{ field: 'returnAuthorization', message: 'return' }]),
      'POST /sales/authorizations': { status: 201, body: { success: true, data: { token: 'abc123', scope: 'return', authorizedBy: { id: 2, fullName: 'Supervisora' } }, message: 'ok' } },
    })
    renderApp('/ventas')
    await user.click(await screen.findByRole('button', { name: 'Devolver productos de V-000031' }))
    const dialog = await screen.findByRole('dialog', { name: 'Devolución de la venta V-000031' })

    // A Consumidor final solo se le devuelve dinero
    expect(within(dialog).getByRole('radio', { name: /Saldo a favor/ })).toBeDisabled()
    await user.click(within(dialog).getByRole('button', { name: 'Sumar 1 a Concentrado cerdos' }))
    expect(within(dialog).getByText('$ 100.000')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('radio', { name: /Cuarentena/ }))
    await user.type(within(dialog).getByLabelText(/¿Por qué devuelve\?/), 'Se equivocó de producto')
    await user.click(within(dialog).getByRole('button', { name: /^Devolver/ }))

    const auth = await screen.findByRole('dialog', { name: 'Autorizar devolución' })
    await user.type(within(auth).getByLabelText('Usuario de quien autoriza'), 'supervisora')
    await user.type(within(auth).getByLabelText('Contraseña'), 'clave-segura')
    await user.click(within(auth).getByRole('button', { name: 'Autorizar' }))

    const receipt = await screen.findByRole('dialog', { name: 'Devolución DV-000001' })
    expect(within(receipt).getByText('¡Devolución registrada!')).toBeInTheDocument()
    expect(within(receipt).getByText('Comprobante de devolución')).toBeInTheDocument()

    const posts = calls.filter((call) => call.method === 'POST' && call.url === '/sale-returns')
    expect(posts).toHaveLength(2)
    expect(posts[1].data).toMatchObject({
      saleId: 31,
      reason: 'Se equivocó de producto',
      items: [{ saleItemId: 50, quantity: '1', condition: 'quarantine' }],
      refund: { mode: 'money', paymentMethodId: 1 },
      cashSessionId: 9,
      returnAuthorization: 'abc123',
    })
    // Los dos intentos usan la misma clave: no se registra dos veces
    expect(posts[1].data.idempotencyKey).toBe(posts[0].data.idempotencyKey)
  })

  it('anula una venta con motivo', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ ...baseRoutes(['sales.create', 'sales.view', 'sales.cancel', 'cash.view']), 'POST /sales/31/cancel': ok({ ...SALE, status: 'cancelled' }, 'Venta V-000031 anulada') })
    renderApp('/ventas')
    await user.click(await screen.findByRole('button', { name: 'Anular V-000031' }))
    const dialog = await screen.findByRole('dialog', { name: 'Anular la venta V-000031' })
    await user.click(within(dialog).getByRole('button', { name: 'Anular venta' }))
    expect(await within(dialog).findByText('Escribe el motivo (mínimo 5 caracteres)')).toBeInTheDocument()
    await user.type(within(dialog).getByLabelText(/^Motivo/), 'Se registró dos veces')
    await user.click(within(dialog).getByRole('button', { name: 'Anular venta' }))
    await waitFor(() => expect(calls.find((call) => call.url === '/sales/31/cancel').data).toEqual({ reason: 'Se registró dos veces' }))
    expect(await screen.findByText('Venta V-000031 anulada')).toBeInTheDocument()
  })

  it('una venta anulada no muestra devolver ni anular', async () => {
    mockApi({ ...baseRoutes(), 'GET /sales': page([{ ...SALE, status: 'cancelled' }], { summary: { count: 0, total: '0.00', credit: '0.00', paid: '0.00', returned: '0.00' } }) })
    renderApp('/ventas')
    expect(await screen.findByText('Anulada')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Devolver productos de V-000031' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Anular V-000031' })).not.toBeInTheDocument()
  })
})

describe('devoluciones y cuarentena', () => {
  it('la lista de devoluciones muestra el resumen y cómo se reintegró', async () => {
    mockApi({ ...baseRoutes(), 'GET /sale-returns': page([RETURN], { summary: { count: 1, total: '100000.00', refunded: '100000.00', credited: '0.00' } }) })
    renderApp('/ventas/devoluciones')
    expect(await screen.findByText('DV-000001')).toBeInTheDocument()
    expect(screen.getByText('Efectivo $ 100.000')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Resumen de devoluciones' })).getByText('Dinero devuelto')).toBeInTheDocument()
  })

  it('en cuarentena se decide: vuelve a la venta', async () => {
    const user = userEvent.setup()
    const item = { id: 3, product: { id: 5, code: 'P-00005', name: 'Concentrado cerdos', unitSymbol: 'kg' }, quantity: '40.000', unitCost: '2000.0000', value: '80000.00', reason: 'Bulto abierto', saleReturn: { id: 7, number: 'DV-000001' }, status: 'pending', statusLabel: 'Por decidir', createdAt: '2026-11-17T16:00:00.000Z' }
    const calls = mockApi({
      ...baseRoutes([...CASHIER, 'inventory.quarantine']),
      'GET /quarantine': page([item], { summary: { pending: 1, pendingValue: '80000.00' } }),
      'POST /quarantine/3/release': ok({ ...item, status: 'released' }, 'Concentrado cerdos volvió a la venta'),
    })
    renderApp('/inventario/cuarentena')
    expect(await screen.findByText('Concentrado cerdos')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Resumen de la cuarentena' })).getByText('$ 80.000')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Vuelve a la venta' }))
    await user.click(await screen.findByRole('button', { name: 'Volver a la venta' }))
    await waitFor(() => expect(calls.some((call) => call.method === 'POST' && call.url === '/quarantine/3/release')).toBe(true))
    expect(await screen.findByText('Concentrado cerdos volvió a la venta')).toBeInTheDocument()
  })

  it('sin el permiso de cuarentena solo se ve, no se decide', async () => {
    const item = { id: 3, product: { id: 5, code: 'P-00005', name: 'Concentrado cerdos', unitSymbol: 'kg' }, quantity: '40.000', unitCost: '2000.0000', value: '80000.00', reason: 'Bulto abierto', saleReturn: null, status: 'pending', statusLabel: 'Por decidir', createdAt: '2026-11-17T16:00:00.000Z' }
    mockApi({ ...baseRoutes(), 'GET /quarantine': page([item], { summary: { pending: 1, pendingValue: '80000.00' } }) })
    renderApp('/inventario/cuarentena')
    expect(await screen.findByText('Concentrado cerdos')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Vuelve a la venta' })).not.toBeInTheDocument()
  })
})
