// Fase 8 — Inventario físico, ficha veterinaria, documentos, lote en el ajuste y avisos.
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '../../test/renderWithProviders'
import { BASIC_PLAN, buildUser, fail, healthyResponse, mockApi, ok, restoreApi, session } from '../../test/mockApi'

const PLAN = { ...BASIC_PLAN, features: [...BASIC_PLAN.features, 'purchases'] }
const ALL = ['inventory.view', 'inventory.update', 'inventory.prices', 'inventory.cost_view', 'inventory.adjust', 'inventory.count', 'inventory.count_apply', 'categories.manage', 'settings.update']
const KG = { id: 2, name: 'Kilogramo', symbol: 'kg', allowsDecimals: true, isActive: true }
const UND = { id: 1, name: 'Unidad', symbol: 'und', allowsDecimals: false, isActive: true }
const TREE = [
  {
    id: 1,
    parentId: null,
    name: 'Medicamentos veterinarios',
    defaultTaxRate: 'excluded',
    expiredSalePolicy: 'forbidden',
    isVeterinary: true,
    isActive: true,
    productCount: 1,
    children: [{ id: 2, parentId: 1, name: 'Antiparasitarios', defaultTaxRate: 'excluded', expiredSalePolicy: 'forbidden', isVeterinary: true, isActive: true, productCount: 1 }],
  },
]
const VET_INFO = { activeIngredient: 'Ivermectina', concentration: '1 %', icaRegistration: '1234-DB', manufacturer: 'Lab Agro', species: 'Bovinos', administrationRoute: 'Subcutánea', withdrawalMeatDays: '28.0', withdrawalMilkDays: null, requiresPrescription: true }

function buildProduct(overrides = {}) {
  return {
    id: 5,
    code: 'P-00005',
    name: 'Ivomec 500 ml',
    description: null,
    category: { id: 2, name: 'Antiparasitarios', parent: { id: 1, name: 'Medicamentos veterinarios' } },
    unit: UND,
    barcode: null,
    salePrice: '98000.00',
    taxRate: 'excluded',
    taxRateLabel: 'Excluido',
    minStock: '2.000',
    tracksBatches: true,
    expiredSalePolicy: null,
    effectiveExpiredSalePolicy: 'forbidden',
    isActive: true,
    stock: '10.000',
    isLowStock: false,
    isOutOfStock: false,
    presentations: [],
    suppliers: [],
    purchasePrice: '80000.0000',
    profit: '18000.00',
    profitPercent: '22.50',
    averageCost: '80000.0000',
    stockValue: '800000.00',
    isVeterinary: true,
    veterinaryInfo: VET_INFO,
    ...overrides,
  }
}

const SUMMARY = { productsInScope: 3, counted: 1, pending: 2, withDifference: 1, shortageValue: '10000.00', surplusValue: '0.00', netValue: '-10000.00' }
function buildCount(overrides = {}) {
  return {
    id: 3,
    number: 'IF-000003',
    status: 'open',
    statusLabel: 'En conteo',
    category: null,
    notes: 'Fin de mes',
    createdBy: { id: 1, fullName: 'Robinson Barrios' },
    createdAt: '2026-11-16T15:00:00.000Z',
    appliedBy: null,
    appliedAt: null,
    cancelledBy: null,
    cancelledAt: null,
    cancelReason: null,
    summary: SUMMARY,
    ...overrides,
  }
}
const FEED_ROW = {
  product: { id: 8, code: 'P-00008', name: 'Concentrado cerdos', unit: { id: 2, symbol: 'kg', allowsDecimals: true }, tracksBatches: false, presentations: [{ id: 4, name: 'Bulto 40 kg', factor: '40.000' }] },
  currentStock: '100.000',
  count: null,
}
const SALT_ROW = {
  product: { id: 9, code: 'P-00009', name: 'Sal mineralizada', unit: { id: 2, symbol: 'kg', allowsDecimals: true }, tracksBatches: false, presentations: [] },
  currentStock: '20.000',
  count: { countedQuantity: '15.000', systemQuantity: '20.000', difference: '-5.000', differenceValue: '-10000.00', countedAt: '2026-11-16T15:10:00.000Z', countedBy: { id: 1, fullName: 'Robinson Barrios' } },
}

const page = (rows) => ({ status: 200, body: { success: true, data: rows, meta: { page: 1, pageSize: 20, total: rows.length, totalPages: 1 }, message: 'ok' } })

const baseRoutes = (permissions = ALL) => ({
  'GET /auth/me': session(buildUser({ permissions }), PLAN),
  'GET /health': healthyResponse,
  'GET /notifications/unread-count': ok({ unread: 0 }),
  'GET /branding': ok({ name: 'Agro El Campo', logo: null }),
  'GET /me/preferences': ok({ theme: 'system' }),
  'GET /categories': ok(TREE),
  'GET /units': ok([UND, KG]),
  'GET /products/5': ok(buildProduct()),
  'GET /products/5/movements': page([{ id: 1 }]),
  'GET /products/5/documents': ok([]),
  'GET /batches/products/5': ok([]),
})

afterEach(() => restoreApi())

describe('inventario físico', () => {
  it('lista los inventarios, resalta el que está en conteo y filtra por estado', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ ...baseRoutes(), 'GET /inventory-counts': (call) => page(call.params.status === 'open' ? [buildCount()] : [buildCount(), buildCount({ id: 2, number: 'IF-000002', status: 'applied', statusLabel: 'Aplicado' })]) })
    renderApp('/inventario/conteos')

    expect(await screen.findByRole('link', { name: /IF-000003 en conteo/ })).toHaveAttribute('href', '/inventario/conteos/3')
    expect(screen.getByText('1 de 3 productos contados')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Inventario físico' })).toBeInTheDocument()
    // Con uno abierto no se ofrece abrir otro
    expect(screen.queryByRole('button', { name: 'Nuevo inventario físico' })).not.toBeInTheDocument()
    expect(await screen.findByRole('link', { name: /IF-000002/ })).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Aplicados' }))
    expect(calls.filter((call) => call.url === '/inventory-counts').at(-1).params).toMatchObject({ status: 'applied', page: 1 })
  })

  it('abre un inventario de una categoría y lleva a contarlo', async () => {
    const user = userEvent.setup()
    const calls = mockApi({
      ...baseRoutes(),
      'GET /inventory-counts': page([]),
      'POST /inventory-counts': ok(buildCount({ category: { id: 1, name: 'Medicamentos veterinarios' } })),
      'GET /inventory-counts/3': ok(buildCount()),
      'GET /inventory-counts/3/items': page([FEED_ROW]),
    })
    renderApp('/inventario/conteos')

    await user.click(await screen.findByRole('button', { name: 'Nuevo inventario físico' }))
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo inventario físico' })
    await user.click(within(dialog).getByRole('radio', { name: /Una categoría/ }))
    await user.click(within(dialog).getByRole('button', { name: 'Empezar a contar' }))
    expect(within(dialog).getByText('Elige la categoría que vas a contar')).toBeInTheDocument()
    await user.click(within(dialog).getByLabelText(/^Categoría/))
    await user.type(within(dialog).getByRole('searchbox', { name: 'Buscar categoría o subcategoría' }), 'medicamentos')
    await user.keyboard('{Enter}')
    await user.type(within(dialog).getByLabelText('Nota'), 'Cierre de mes')
    await user.click(within(dialog).getByRole('button', { name: 'Empezar a contar' }))

    expect(await screen.findByText('Inventario IF-000003 abierto')).toBeInTheDocument()
    expect(calls.find((call) => call.method === 'POST').data).toEqual({ categoryId: 1, notes: 'Cierre de mes' })
    expect(await screen.findByRole('heading', { name: /IF-000003/ })).toBeInTheDocument()
  })

  it('registra lo contado en bultos, muestra las diferencias y aplica el inventario', async () => {
    const user = userEvent.setup()
    const calls = mockApi({
      ...baseRoutes(),
      'GET /inventory-counts/3': ok(buildCount()),
      'GET /inventory-counts/3/items': page([FEED_ROW, SALT_ROW]),
      'PUT /inventory-counts/3/items/8': ok({ productId: 8, countedQuantity: '80.000', systemQuantity: '100.000', difference: '-20.000' }),
      'POST /inventory-counts/3/apply': ok(buildCount({ status: 'applied', statusLabel: 'Aplicado', summary: { ...SUMMARY, withDifference: 2 } })),
    })
    renderApp('/inventario/conteos/3')

    expect(await screen.findByText(/de 3 productos contados/)).toBeInTheDocument()
    expect(await screen.findByText('−5 kg')).toBeInTheDocument()
    expect(screen.getByText('Sin contar', { selector: '.count-cell__pending' })).toBeInTheDocument()

    await user.type(screen.getByLabelText('Cantidad contada de Concentrado cerdos'), '2')
    await user.selectOptions(screen.getByLabelText('Unidad de Concentrado cerdos'), '4')
    await user.click(screen.getByRole('button', { name: 'Guardar Concentrado cerdos' }))
    expect(calls.find((call) => call.method === 'PUT').data).toEqual({ quantity: '2', presentationId: 4, mode: 'set' })

    // Sumar a lo ya contado (escáner)
    const addCalls = mockApi({ ...baseRoutes(), 'GET /inventory-counts/3': ok(buildCount()), 'GET /inventory-counts/3/items': page([FEED_ROW, SALT_ROW]), 'PUT /inventory-counts/3/items/9': ok({}) })
    await user.type(screen.getByLabelText('Cantidad contada de Sal mineralizada'), '3')
    await user.click(screen.getByRole('button', { name: 'Sumar a lo contado de Sal mineralizada' }))
    expect(addCalls.find((call) => call.method === 'PUT').data).toEqual({ quantity: '3', mode: 'add' })

    restoreApi()
    const applyCalls = mockApi({
      ...baseRoutes(),
      'GET /inventory-counts/3': ok(buildCount()),
      'GET /inventory-counts/3/items': page([FEED_ROW, SALT_ROW]),
      'POST /inventory-counts/3/apply': ok(buildCount({ status: 'applied', statusLabel: 'Aplicado', summary: { ...SUMMARY, withDifference: 2 } })),
      'GET /products': page([]),
    })
    await user.click(screen.getByRole('button', { name: 'Aplicar inventario' }))
    const dialog = await screen.findByRole('dialog', { name: 'Aplicar el inventario IF-000003' })
    expect(within(dialog).getByText(/Los 2 productos sin contar no se tocan/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Sí, aplicar' }))
    expect(await screen.findByText('Inventario IF-000003 aplicado: 2 ajustes')).toBeInTheDocument()
    expect(applyCalls.some((call) => call.method === 'POST' && call.url === '/inventory-counts/3/apply')).toBe(true)
  })

  it('muestra el error del servidor al aplicar y pide el motivo para anular', async () => {
    const user = userEvent.setup()
    const calls = mockApi({
      ...baseRoutes(),
      'GET /inventory-counts/3': ok(buildCount()),
      'GET /inventory-counts/3/items': page([SALT_ROW]),
      'POST /inventory-counts/3/apply': fail(409, 'OPERATION_NOT_ALLOWED', 'Sal mineralizada: el faltante (5.000) es mayor que la existencia actual (2.000). Vuelve a contarlo antes de aplicar'),
      'POST /inventory-counts/3/cancel': ok(buildCount({ status: 'cancelled', statusLabel: 'Anulado', cancelReason: 'Se contó mal la bodega' })),
    })
    renderApp('/inventario/conteos/3')

    await user.click(await screen.findByRole('button', { name: 'Aplicar inventario' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Sí, aplicar' }))
    expect(await screen.findByText(/Vuelve a contarlo antes de aplicar/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Anular' }))
    const dialog = await screen.findByRole('dialog', { name: 'Anular el inventario IF-000003' })
    await user.type(within(dialog).getByLabelText(/^Motivo/), 'Se contó mal la bodega')
    await user.click(within(dialog).getByRole('button', { name: 'Anular inventario' }))
    expect(await screen.findByText('Inventario IF-000003 anulado')).toBeInTheDocument()
    expect(calls.find((call) => call.url === '/inventory-counts/3/cancel').data).toEqual({ reason: 'Se contó mal la bodega' })
  })

  it('quien solo ve el inventario no puede contar ni aplicar', async () => {
    mockApi({ ...baseRoutes(['inventory.view']), 'GET /inventory-counts/3': ok(buildCount()), 'GET /inventory-counts/3/items': page([FEED_ROW]) })
    renderApp('/inventario/conteos/3')
    expect(await screen.findByText('Concentrado cerdos')).toBeInTheDocument()
    expect(screen.queryByLabelText('Cantidad contada de Concentrado cerdos')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Aplicar inventario' })).not.toBeInTheDocument()
  })
})

describe('ficha veterinaria y documentos', () => {
  it('muestra la ficha, la marca de fórmula y edita la ficha en su paso', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ ...baseRoutes(), 'PATCH /products/5': (call) => ok(buildProduct({ veterinaryInfo: { ...VET_INFO, ...call.data.veterinaryInfo } })) })
    renderApp('/inventario/productos/5')

    expect(await screen.findByText('Requiere fórmula')).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: /Ficha veterinaria/ }))
    expect(screen.getByText('Ivermectina')).toBeInTheDocument()
    expect(screen.getByText('28 días')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Editar' }))
    const dialog = await screen.findByRole('dialog', { name: 'Editar producto' })
    await user.click(within(dialog).getByRole('button', { name: 'Siguiente' }))
    expect(within(dialog).getByLabelText(/^Principio activo/)).toHaveValue('Ivermectina')
    await user.type(within(dialog).getByLabelText(/^Retiro en leche/), 'x')
    await user.click(within(dialog).getByRole('button', { name: 'Siguiente' }))
    expect(within(dialog).getByText('Escribe los días (ej. 28 o 3,5) o déjalo vacío')).toBeInTheDocument()
    await user.clear(within(dialog).getByLabelText(/^Retiro en leche/))
    await user.type(within(dialog).getByLabelText(/^Retiro en leche/), '3,5')
    await user.click(within(dialog).getByRole('button', { name: 'Siguiente' }))
    await user.click(within(dialog).getByRole('button', { name: 'Siguiente' }))
    await user.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByText('Ivomec 500 ml actualizado')).toBeInTheDocument()
    expect(calls.find((call) => call.method === 'PATCH').data.veterinaryInfo).toEqual({
      activeIngredient: 'Ivermectina',
      concentration: '1 %',
      icaRegistration: '1234-DB',
      manufacturer: 'Lab Agro',
      species: 'Bovinos',
      administrationRoute: 'Subcutánea',
      withdrawalMeatDays: '28',
      withdrawalMilkDays: '3.5',
      requiresPrescription: true,
    })
  })

  it('lista, agrega y quita documentos del producto', async () => {
    const user = userEvent.setup()
    const document = { id: 4, productId: 5, documentType: 'ica_registration', documentTypeLabel: 'Registro ICA', title: 'Registro ICA 2026', expiresOn: '2020-01-01', isExpired: true, fileName: 'ica.pdf', mimeType: 'application/pdf', fileSize: 20480, uploadedBy: { id: 1, fullName: 'Robinson Barrios' }, uploadedAt: '2026-11-16T15:00:00.000Z' }
    const calls = mockApi({
      ...baseRoutes(),
      'GET /products/5/documents': ok([document]),
      'POST /products/5/documents': ok({ ...document, id: 5, title: 'Ficha técnica' }),
      'DELETE /products/5/documents/4': ok(null),
    })
    renderApp('/inventario/productos/5')

    await user.click(await screen.findByRole('tab', { name: /Documentos/ }))
    expect(await screen.findByText('Registro ICA 2026')).toBeInTheDocument()
    expect(screen.getByText('Vencido')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Agregar documento' }))
    const dialog = await screen.findByRole('dialog', { name: 'Agregar documento' })
    await user.click(within(dialog).getByRole('button', { name: 'Guardar documento' }))
    expect(within(dialog).getByText('Elige el archivo')).toBeInTheDocument()
    const file = new File(['%PDF-1.4'], 'ficha tecnica.pdf', { type: 'application/pdf' })
    await user.upload(within(dialog).getByLabelText('Elegir el archivo del documento'), file)
    expect(within(dialog).getByLabelText(/^Nombre/)).toHaveValue('ficha tecnica')
    await user.selectOptions(within(dialog).getByLabelText(/^Tipo/), 'technical_sheet')
    await user.click(within(dialog).getByRole('button', { name: 'Guardar documento' }))
    expect(await screen.findByText('Ficha técnica agregado')).toBeInTheDocument()
    const sent = calls.find((call) => call.method === 'POST').data
    expect(sent.get('documentType')).toBe('technical_sheet')
    expect(sent.get('file').name).toBe('ficha tecnica.pdf')

    await user.click(screen.getByRole('button', { name: 'Quitar Registro ICA 2026' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Quitar documento' })).getByRole('button', { name: 'Quitar' }))
    expect(await screen.findByText('Registro ICA 2026 fue quitado')).toBeInTheDocument()
  })

  it('el ajuste de salida permite escoger el lote', async () => {
    const user = userEvent.setup()
    const batch = { id: 11, lotNumber: 'L-1990', expirationDate: '2026-12-01', availableQuantity: '4.000', receivedQuantity: '5.000', daysToExpire: 15, expiryStatus: 'expiring', supplier: null, unitCost: '80000.0000' }
    const calls = mockApi({ ...baseRoutes(), 'GET /batches/products/5': ok([batch]), 'POST /products/5/adjustments': ok(buildProduct({ stock: '9.000' })) })
    renderApp('/inventario/productos/5')

    await user.click(await screen.findByRole('button', { name: 'Ajustar existencia' }))
    const dialog = await screen.findByRole('dialog', { name: 'Ajustar existencia' })
    await user.type(within(dialog).getByLabelText(/^Cantidad/), '1')
    await within(dialog).findByRole('option', { name: /L-1990/ })
    await user.selectOptions(within(dialog).getByLabelText('Lote'), '11')
    await user.selectOptions(within(dialog).getByLabelText(/^Motivo/), 'expired')
    await user.click(within(dialog).getByRole('button', { name: 'Registrar ajuste' }))
    expect(await screen.findByText(/Existencia ajustada/)).toBeInTheDocument()
    expect(calls.find((call) => call.method === 'POST').data).toMatchObject({ direction: 'out', quantity: '1', batchId: 11, reason: 'expired' })
  })
})

describe('configuración de avisos', () => {
  it('cambia los días de aviso y el resumen de existencias bajas', async () => {
    const user = userEvent.setup()
    const values = { 'inventory.expiry_alert_days': 30, 'inventory.document_alert_days': 30, 'purchases.payable_alert_days': 5, 'inventory.low_stock_alert': true }
    const calls = mockApi({
      ...baseRoutes(),
      'GET /settings': ok({ values, fixed: {}, logo: null }),
      'PATCH /settings': (call) => ok({ values: { ...values, ...call.data.values }, fixed: {}, logo: null }),
    })
    renderApp('/configuracion/avisos')

    expect(await screen.findByText('Documentos por vencer')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Avisos' })).toBeInTheDocument()
    const documents = screen.getAllByRole('group', { name: 'Avisar con' })[1]
    await user.click(within(documents).getByRole('radio', { name: '60 días' }))
    await user.click(screen.getByRole('switch', { name: /Resumen diario/ }))
    await user.click(screen.getByRole('button', { name: /Guardar/ }))
    expect(await screen.findByText('Avisos guardados')).toBeInTheDocument()
    expect(calls.find((call) => call.method === 'PATCH').data.values).toEqual({ 'inventory.document_alert_days': 60, 'inventory.low_stock_alert': false })
  })
})
