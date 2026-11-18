// Fase 7 — Compras, cuentas por pagar y lotes con el backend simulado.
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '../../test/renderWithProviders'
import { BASIC_PLAN, buildUser, fail, healthyResponse, mockApi, ok, restoreApi, session } from '../../test/mockApi'
import { previewMultiply, previewSum } from '../../utils/moneyPreview'

const PLAN = { ...BASIC_PLAN, features: [...BASIC_PLAN.features, 'purchases'] }
const ALL = ['purchases.view', 'purchases.create', 'purchases.confirm', 'purchases.cancel', 'payables.pay', 'payables.cancel_payment', 'suppliers.view', 'inventory.view', 'inventory.cost_view', 'cash.view']
const SUPPLIER = { id: 7, documentType: 'NIT', documentNumber: '900123456', legalName: 'Agrohuila S.A.S.', tradeName: 'Agrohuila', paymentTermDays: 30, isActive: true }
const BULTO = { id: 3, name: 'Bulto 40 kg', factor: '40.000', salePrice: '100000.00', isActive: true }
const PRODUCT = {
  id: 5,
  code: 'P-00005',
  name: 'Concentrado cerdos',
  barcode: '7701234567890',
  unit: { id: 2, name: 'Kilogramo', symbol: 'kg', allowsDecimals: true },
  taxRate: 'excluded',
  tracksBatches: false,
  purchasePrice: '2100.0000',
  presentations: [BULTO],
  isActive: true,
}
const METHODS = [
  { id: 1, name: 'Efectivo', isCash: true, requiresReference: false, isActive: true },
  { id: 2, name: 'Transferencia', isCash: false, requiresReference: true, isActive: true },
]

function buildPurchase(overrides = {}) {
  return {
    id: 12,
    number: null,
    status: 'draft',
    statusLabel: 'Borrador',
    supplier: { ...SUPPLIER },
    supplierInvoiceNumber: 'FV-1001',
    invoiceDate: '2026-11-16',
    notes: null,
    globalDiscount: '0.00',
    freight: '40000.00',
    freightInInvoice: true,
    subtotal: '1840000.00',
    discountTotal: '0.00',
    taxTotal: '0.00',
    total: '1880000.00',
    payableTotal: '1880000.00',
    amountPaid: '0.00',
    balance: '0.00',
    paymentType: null,
    paymentStatus: null,
    dueDate: null,
    taxMode: null,
    isPreview: true,
    hasAttachment: false,
    attachment: null,
    payments: [],
    items: [
      {
        id: 1,
        product: { id: 5, code: 'P-00005', name: 'Concentrado cerdos', tracksBatches: false, unit: { id: 2, symbol: 'kg', allowsDecimals: true } },
        productName: 'Concentrado cerdos',
        unitSymbol: 'kg',
        presentation: { id: 3, name: 'Bulto 40 kg' },
        factor: '40.000',
        quantity: '20.000',
        unitPrice: '92000.0000',
        discount: '0.00',
        taxRate: 'excluded',
        taxRateLabel: 'Excluido',
        lotNumber: null,
        expirationDate: null,
        manufactureDate: null,
        baseQuantity: '800.000',
        taxAmount: '0.00',
        unitCost: '2350.0000',
      },
    ],
    ...overrides,
  }
}

const CONFIRMED = buildPurchase({ number: 'C-000001', status: 'confirmed', statusLabel: 'Confirmada', isPreview: false, paymentType: 'credit', dueDate: '2026-12-16', balance: '1880000.00', paymentStatus: 'pending', taxMode: 'in_cost', confirmedAt: '2026-11-16T15:00:00.000Z', confirmedBy: { id: 1, fullName: 'Robinson Barrios' } })

const page = (rows) => ({ status: 200, body: { success: true, data: rows, meta: { page: 1, pageSize: 20, total: rows.length, totalPages: 1 }, message: 'ok' } })

const baseRoutes = (permissions = ALL) => ({
  'GET /auth/me': session(buildUser({ permissions }), PLAN),
  'GET /health': healthyResponse,
  'GET /notifications/unread-count': ok({ unread: 0 }),
  'GET /branding': ok({ name: 'Agro El Campo', logo: null }),
  'GET /me/preferences': ok({ theme: 'system' }),
  'GET /suppliers': page([SUPPLIER]),
  'GET /payment-methods': ok(METHODS),
  'GET /purchases': page([]),
  'GET /products': page([PRODUCT]),
  'GET /products/5': ok(PRODUCT),
})

afterEach(() => restoreApi())

describe('vista previa de dinero', () => {
  it('multiplica y suma con enteros', () => {
    expect(previewMultiply('2100', '40')).toBe('84000.0000')
    expect(previewMultiply('0.1', '3')).toBe('0.3000')
    expect(previewSum(['0.1', '0.2', 'x'])).toBe('0.30')
  })
})

describe('lista de compras', () => {
  it('muestra el menú de compras y filtra por estado', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ ...baseRoutes(), 'GET /purchases': page([{ ...CONFIRMED, items: undefined }]) })
    renderApp('/compras')

    expect(await screen.findByRole('link', { name: /C-000001/ })).toHaveAttribute('href', '/compras/12')
    expect(screen.getByRole('link', { name: 'Cuentas por pagar' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Lotes y vencimientos' })).toBeInTheDocument()
    expect(screen.getByText('Por pagar', { selector: '.status-pill' })).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Borradores' }))
    expect(calls.filter((call) => call.url === '/purchases').at(-1).params).toMatchObject({ status: 'draft', page: 1 })
  })
})

describe('registrar una compra', () => {
  it('agrega productos en bultos con su precio propuesto y guarda el borrador', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ ...baseRoutes(), 'POST /purchases': ok(buildPurchase()), 'GET /purchases/12': ok(buildPurchase()) })
    renderApp('/compras/nueva')

    await screen.findByRole('option', { name: 'Agrohuila' })
    await user.selectOptions(screen.getByLabelText(/^Proveedor/), '7')
    await user.type(screen.getByLabelText(/^Número de factura/), 'FV-1001')
    await user.type(screen.getByLabelText('Agregar producto'), 'concentrado')
    await user.click(await screen.findByRole('option', { name: /Concentrado cerdos/ }))

    // Precio propuesto: el de compra por kg; al cambiar a bulto se multiplica por 40
    expect(screen.getByLabelText(/^Precio/)).toHaveValue('2.100')
    expect(screen.getByText('Por kg, sin IVA')).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Viene en'), '3')
    expect(screen.getByLabelText(/^Precio/)).toHaveValue('84.000')
    expect(screen.getByText('Por bulto 40 kg, sin IVA')).toBeInTheDocument()
    await user.clear(screen.getByLabelText(/^Precio/))
    await user.type(screen.getByLabelText(/^Precio/), '92.000')
    await user.type(screen.getByLabelText(/^Cantidad/), '20')
    expect(screen.getByText('= 800 kg')).toBeInTheDocument()
    expect(screen.getAllByText('$ 1.840.000').length).toBeGreaterThan(0)
    await user.type(screen.getByLabelText(/^Flete y otros costos/), '40.000')

    await user.click(screen.getByRole('button', { name: 'Guardar borrador' }))
    expect(await screen.findByText('Compra guardada como borrador')).toBeInTheDocument()
    expect(calls.find((call) => call.method === 'POST').data).toEqual({
      supplierId: 7,
      supplierInvoiceNumber: 'FV-1001',
      invoiceDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      notes: null,
      globalDiscount: '0',
      freight: '40000',
      freightInInvoice: true,
      items: [{ productId: 5, presentationId: 3, quantity: '20', unitPrice: '92000', discount: '0', taxRate: 'excluded', lotNumber: null, expirationDate: null, manufactureDate: null }],
    })
    // Ya guardado: el sistema muestra su cálculo y el costo real por kg
    expect(await screen.findByText(/Calculado por el sistema/)).toBeInTheDocument()
    expect(screen.getByText('$ 2.350 / kg')).toBeInTheDocument()
  })

  it('valida antes de guardar', async () => {
    const user = userEvent.setup()
    mockApi(baseRoutes())
    renderApp('/compras/nueva')
    await user.type(await screen.findByLabelText('Agregar producto'), 'concentrado')
    await user.click(await screen.findByRole('option', { name: /Concentrado cerdos/ }))
    await user.click(screen.getByRole('button', { name: 'Guardar borrador' }))
    expect(screen.getByText('Selecciona el proveedor')).toBeInTheDocument()
    expect(screen.getByText('Escribe la cantidad')).toBeInTheDocument()
  })

  it('confirmar de contado con transferencia', async () => {
    const user = userEvent.setup()
    let confirmed = false
    const calls = mockApi({
      ...baseRoutes(),
      'GET /purchases/12': () => ok(confirmed ? { ...CONFIRMED, paymentType: 'cash', balance: '0.00', amountPaid: '1880000.00', paymentStatus: 'paid' } : buildPurchase()),
      'PATCH /purchases/12': ok(buildPurchase()),
      'POST /purchases/12/confirm': () => {
        confirmed = true
        return ok({ ...CONFIRMED, priceWarnings: [{ productId: 5, name: 'Concentrado cerdos', purchasePrice: '2350.0000', salePrice: '2300.00', profit: '-50.00' }] })
      },
    })
    renderApp('/compras/12')

    await user.click(await screen.findByRole('button', { name: 'Confirmar compra' }))
    const dialog = await screen.findByRole('dialog', { name: 'Confirmar compra' })
    expect(within(dialog).getByText('$ 1.880.000')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('radio', { name: /De contado/ }))
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar compra' }))
    expect(within(dialog).getByText('Selecciona el método de pago')).toBeInTheDocument()

    await user.selectOptions(within(dialog).getByLabelText(/^Método de pago/), '2')
    await user.type(within(dialog).getByLabelText(/^Referencia/), 'TR-55')
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar compra' }))

    expect(await screen.findByText('Compra C-000001 confirmada: los productos entraron al inventario')).toBeInTheDocument()
    expect(calls.find((call) => call.url === '/purchases/12/confirm').data).toEqual({ paymentType: 'cash', payment: { paymentMethodId: 2, paymentReference: 'TR-55' } })
    // Detalle con el aviso de precio de venta en pérdida
    expect(await screen.findByText('Revisa el precio de venta')).toBeInTheDocument()
  })

  it('lotes vencidos: pide confirmar y vuelve a enviar con la confirmación', async () => {
    const user = userEvent.setup()
    const calls = mockApi({
      ...baseRoutes(),
      'GET /purchases/12': ok(buildPurchase()),
      'PATCH /purchases/12': ok(buildPurchase()),
      'POST /purchases/12/confirm': (call) =>
        call.data.confirmExpiredLots ? ok(CONFIRMED) : fail(409, 'CONFIRMATION_REQUIRED', 'La compra trae lotes ya vencidos', [{ field: 'items[0].expirationDate', message: 'El lote L-1 de Vacuna ya está vencido' }]),
    })
    renderApp('/compras/12')

    await user.click(await screen.findByRole('button', { name: 'Confirmar compra' }))
    const dialog = await screen.findByRole('dialog', { name: 'Confirmar compra' })
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar compra' }))
    expect(await within(dialog).findByText(/Línea 1: El lote L-1 de Vacuna ya está vencido/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Recibir de todas formas' }))
    expect(await screen.findByText(/C-000001 confirmada/)).toBeInTheDocument()
    expect(calls.filter((call) => call.url === '/purchases/12/confirm').at(-1).data).toMatchObject({ paymentType: 'credit', dueDate: '2026-12-16', confirmExpiredLots: true })
  })

  it('sin permiso para confirmar no aparece el botón', async () => {
    mockApi({ ...baseRoutes(['purchases.view', 'purchases.create', 'suppliers.view']), 'GET /purchases/12': ok(buildPurchase()) })
    renderApp('/compras/12')
    expect(await screen.findByRole('button', { name: 'Guardar borrador' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirmar compra' })).not.toBeInTheDocument()
  })
})

describe('compra confirmada', () => {
  it('registra un pago con "Pagar todo" y anula la compra con motivo', async () => {
    const user = userEvent.setup()
    const calls = mockApi({
      ...baseRoutes(),
      'GET /purchases/12': ok(CONFIRMED),
      'POST /purchases/12/payments': ok({ ...CONFIRMED, balance: '0.00' }),
      'POST /purchases/12/cancel': ok({ ...CONFIRMED, status: 'cancelled' }),
    })
    renderApp('/compras/12')

    expect(await screen.findByText('$ 2.350 / kg')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Registrar pago' }))
    const dialog = await screen.findByRole('dialog', { name: 'Registrar pago' })
    await user.click(within(dialog).getByRole('button', { name: 'Pagar todo' }))
    expect(within(dialog).getByText('Queda pagada')).toBeInTheDocument()
    await user.selectOptions(within(dialog).getByLabelText(/^Método de pago/), '2')
    await user.type(within(dialog).getByLabelText(/^Referencia/), 'TR-9')
    await user.click(within(dialog).getByRole('button', { name: 'Registrar pago' }))
    expect(await screen.findByText('Pago de $ 1.880.000 registrado. Compra pagada')).toBeInTheDocument()
    expect(calls.find((call) => call.url === '/purchases/12/payments').data).toEqual({ amount: '1880000', paymentMethodId: 2, paymentReference: 'TR-9', notes: null })

    await user.click(screen.getByRole('button', { name: 'Anular compra' }))
    const cancel = await screen.findByRole('dialog', { name: 'Anular compra' })
    await user.click(within(cancel).getByRole('button', { name: 'Anular compra' }))
    expect(within(cancel).getByText('Escribe el motivo (mínimo 5 caracteres)')).toBeInTheDocument()
    await user.type(within(cancel).getByLabelText(/^Motivo/), 'Factura duplicada')
    await user.click(within(cancel).getByRole('button', { name: 'Anular compra' }))
    expect(await screen.findByText('Compra C-000001 anulada')).toBeInTheDocument()
  })
})

describe('cuentas por pagar y lotes', () => {
  it('muestra el saldo por proveedor y deja pagar desde la lista', async () => {
    const user = userEvent.setup()
    mockApi({
      ...baseRoutes(),
      'GET /payables/summary': ok({ totals: { balance: '1880000.00', overdue: '0.00', suppliers: 1 }, suppliers: [{ supplier: SUPPLIER, purchases: 1, balance: '1880000.00', overdue: '0.00', nextDueDate: '2026-12-16' }] }),
      'GET /purchases': page([{ ...CONFIRMED, items: undefined }]),
    })
    renderApp('/compras/cuentas-por-pagar')

    expect(await screen.findByText('Proveedores con saldo')).toBeInTheDocument()
    expect(screen.getByText(/próximo vencimiento 16\/12\/2026/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Pagar' }))
    expect(await screen.findByRole('dialog', { name: 'Registrar pago' })).toBeInTheDocument()
  })

  it('lista los lotes por vencer con los días que faltan', async () => {
    mockApi({
      ...baseRoutes(),
      'GET /batches/expiring': {
        status: 200,
        body: {
          success: true,
          data: [{ id: 1, product: { id: 5, code: 'P-00009', name: 'Vacuna aftosa', unitSymbol: 'und' }, lotNumber: 'L-100', expirationDate: '2026-11-26', daysToExpire: 10, expiryStatus: 'expiring', availableQuantity: '10.000', receivedQuantity: '10.000', supplier: SUPPLIER, receivedAt: '2026-11-16T15:00:00.000Z' }],
          meta: { page: 1, pageSize: 20, total: 1, totalPages: 1, alertDays: 30 },
          message: 'ok',
        },
      },
    })
    renderApp('/inventario/lotes')
    expect(await screen.findByText('Vacuna aftosa')).toBeInTheDocument()
    expect(screen.getByText('En 10 días')).toBeInTheDocument()
    expect(screen.getByText(/próximos 30 días/)).toBeInTheDocument()
  })
})

describe('pago en efectivo', () => {
  it('no pide caja: la caja es solo para las ventas (D-COMP-8)', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ ...baseRoutes(), 'GET /purchases/12': ok(buildPurchase()), 'PATCH /purchases/12': ok(buildPurchase()), 'POST /purchases/12/confirm': ok({ ...CONFIRMED, paymentType: 'cash', balance: '0.00', paymentStatus: 'paid' }) })
    renderApp('/compras/12')

    await user.click(await screen.findByRole('button', { name: 'Confirmar compra' }))
    const dialog = await screen.findByRole('dialog', { name: 'Confirmar compra' })
    await user.click(within(dialog).getByRole('radio', { name: /De contado/ }))
    await user.selectOptions(within(dialog).getByLabelText(/^Método de pago/), '1')
    expect(within(dialog).getByText(/No sale de la caja/)).toBeInTheDocument()
    expect(within(dialog).queryByLabelText(/caja/i)).not.toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar compra' }))
    await screen.findByText(/C-000001/)
    expect(calls.find((call) => call.url === '/purchases/12/confirm').data).toEqual({ paymentType: 'cash', payment: { paymentMethodId: 1 } })
  })
})
