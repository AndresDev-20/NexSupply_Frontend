// Productos animales (D-ANI-1) con el backend simulado: tipo Animal en Nuevo producto, lotes en la
// ficha (recibir, muerte, precio), precio del lote en Compras y escoger el lote en el punto de venta.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '../../test/renderWithProviders'
import { BASIC_PLAN, buildUser, healthyResponse, mockApi, ok, restoreApi, session } from '../../test/mockApi'
import { previewAnimalPrice, validatePricing } from './products/animalPricing'

const PLAN = { ...BASIC_PLAN, features: [...BASIC_PLAN.features, 'sales', 'cash', 'customers', 'purchases'] }
const INVENTORY = ['inventory.view', 'inventory.create', 'inventory.update', 'inventory.prices', 'inventory.cost_view', 'inventory.initial_stock', 'inventory.adjust', 'suppliers.view']
const UND = { id: 1, name: 'Unidad', symbol: 'und', allowsDecimals: false, isActive: true }
const KG = { id: 2, name: 'Kilogramo', symbol: 'kg', allowsDecimals: true, isActive: true }
const TREE = [{ id: 1, parentId: null, name: 'Animales', defaultTaxRate: 'excluded', expiredSalePolicy: 'allow', isActive: true, productCount: 0, children: [] }]
const page = (rows) => ({ status: 200, body: { success: true, data: rows, meta: { page: 1, pageSize: 20, total: rows.length, totalPages: 1 }, message: 'ok' } })

const LOT = {
  id: 7,
  lotNumber: 'A-000007',
  productId: 9,
  receivedOn: '2026-11-18',
  days: 4,
  receivedQuantity: '50.000',
  availableQuantity: '45.000',
  deadQuantity: '2.000',
  soldQuantity: '3.000',
  baseSalePrice: '2000.00',
  dailyIncrease: '200.00',
  maxSalePrice: '3000.00',
  priceToday: '2800.00',
  unitCost: '1500.0000',
  supplier: null,
}
function buildChicken(overrides = {}) {
  return {
    id: 9,
    code: 'P-00009',
    name: 'Pollo de engorde',
    productKind: 'animal',
    category: { id: 1, name: 'Animales', parent: null },
    unit: UND,
    salePrice: '0.00',
    taxRate: 'excluded',
    taxRateLabel: 'Excluido',
    minStock: '0.000',
    tracksBatches: false,
    isActive: true,
    stock: '45.000',
    isOutOfStock: false,
    isLowStock: false,
    presentations: [],
    suppliers: [],
    purchasePrice: '0.0000',
    profit: '0.00',
    profitPercent: null,
    averageCost: '1500.0000',
    stockValue: '67500.00',
    ...overrides,
  }
}

const inventoryRoutes = (permissions = INVENTORY) => ({
  'GET /auth/me': session(buildUser({ permissions }), PLAN),
  'GET /health': healthyResponse,
  'GET /notifications/unread-count': ok({ unread: 0 }),
  'GET /branding': ok({ name: 'Agro El Campo', logo: null }),
  'GET /me/preferences': ok({ theme: 'system' }),
  'GET /categories': ok(TREE),
  'GET /units': ok([UND, KG]),
  'GET /suppliers': page([]),
  'GET /products': page([]),
  'GET /products/9': ok(buildChicken()),
  'GET /products/9/movements': page([]),
  'GET /products/9/animal-lots': ok([LOT]),
})

afterEach(() => {
  restoreApi()
  window.localStorage.clear()
})

describe('precio del lote (vista previa)', () => {
  it('sube cada día y no pasa del tope', () => {
    expect(previewAnimalPrice('2000', '200', 0, '')).toBe('2000.00')
    expect(previewAnimalPrice('2000', '200', 4, '')).toBe('2800.00')
    expect(previewAnimalPrice('2000', '200', 30, '3000')).toBe('3000.00')
    expect(validatePricing({ baseSalePrice: '2.000', dailyIncrease: '200', maxSalePrice: '1.000' }).errors).toEqual({ maxSalePrice: 'El tope no puede ser menor que el precio inicial' })
  })
})

describe('Nuevo producto: tipo Animal', () => {
  it('pide precio de compra, precio de venta, lo que sube y cuántos llegan: recibe el primer lote de una vez', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ ...inventoryRoutes(), 'POST /products': ok(buildChicken({ stock: '0.000' })) })
    renderApp('/inventario/productos')

    await user.click(await screen.findByRole('button', { name: 'Nuevo producto' }))
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo producto' })
    await user.click(within(dialog).getByRole('radio', { name: /Animal/ }))
    await user.type(within(dialog).getByLabelText(/^Nombre/), 'Pollo de engorde')
    // Solo unidades sin decimales
    const unitSelect = within(dialog).getByLabelText(/^Unidad base/)
    expect(within(unitSelect).queryByRole('option', { name: /Kilogramo/ })).not.toBeInTheDocument()
    await user.selectOptions(unitSelect, '1')
    await user.click(within(dialog).getByLabelText(/^Categoría/))
    await user.click(within(dialog).getByRole('option', { name: /Animales/ }))
    await user.click(within(dialog).getByRole('button', { name: 'Siguiente' }))

    // Con cuántos llegan, exige el precio de venta
    await user.type(within(dialog).getByLabelText(/^¿Cuántos llegan hoy\?/), '50')
    await user.click(within(dialog).getByRole('button', { name: 'Siguiente' }))
    expect(within(dialog).getByText('Escribe el precio de venta de hoy')).toBeInTheDocument()
    await user.type(within(dialog).getByLabelText(/^Precio de compra/), '1.500')
    await user.type(within(dialog).getByLabelText(/^Precio de venta/), '2.000')
    await user.type(within(dialog).getByLabelText(/^Sube cada día/), '200')
    expect(within(dialog).getByRole('status')).toHaveTextContent('Hoy $ 2.000 · en 7 días $ 3.400 · en 30 días $ 8.000')
    // Nada de «precio inicial» ni «precio máximo»
    expect(within(dialog).queryByText(/precio inicial/i)).not.toBeInTheDocument()
    expect(within(dialog).queryByLabelText(/^Precio máximo/)).not.toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Siguiente' }))
    // Sin el paso de empaques: va directo a Proveedores
    await user.click(within(dialog).getByRole('button', { name: 'Crear producto' }))

    await screen.findByText(/Pollo de engorde creado con el código/)
    const body = calls.find((call) => call.method === 'POST').data
    expect(body).toMatchObject({ productKind: 'animal', unitId: 1, tracksBatches: false, expiredSalePolicy: null, purchasePrice: '1500', salePrice: '2000', firstLot: { quantity: '50', dailyIncrease: '200' } })
    expect(body.presentations).toBeUndefined()
    expect(body.initialStock).toBeUndefined()
  })
})

describe('ficha del animal', () => {
  it('muestra los lotes con el precio de hoy; recibe un lote y registra una muerte', async () => {
    const user = userEvent.setup()
    const calls = mockApi({
      ...inventoryRoutes(),
      'POST /products/9/animal-lots': ok({ ...LOT, id: 8, lotNumber: 'A-000008', receivedQuantity: '30.000', availableQuantity: '30.000', priceToday: '2000.00' }),
      'POST /products/9/animal-lots/7/deaths': ok({ ...LOT, availableQuantity: '43.000', deadQuantity: '4.000' }),
    })
    renderApp('/inventario/productos/9')

    const lots = await screen.findByRole('table', { name: 'Lotes de animales' })
    expect(within(lots).getByText('A-000007')).toBeInTheDocument()
    expect(within(lots).getByText('$ 2.800')).toBeInTheDocument()
    expect(within(lots).getByText('45 de 50')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ajustar existencia' })).not.toBeInTheDocument()
    expect(screen.getByText('Por lote')).toBeInTheDocument()

    // Recibir lote
    await user.click(screen.getByRole('button', { name: 'Recibir lote' }))
    const dialog = await screen.findByRole('dialog', { name: 'Recibir lote' })
    await user.type(within(dialog).getByLabelText(/^¿Cuántos llegaron\?/), '30')
    await user.type(within(dialog).getByLabelText(/^Precio de compra/), '1.500')
    await user.type(within(dialog).getByLabelText(/^Precio de venta/), '2.000')
    await user.type(within(dialog).getByLabelText(/^Sube cada día/), '200')
    expect(within(dialog).getByRole('status')).toHaveTextContent('Hoy $ 2.000 · en 7 días $ 3.400 · en 30 días $ 8.000')
    await user.click(within(dialog).getByRole('button', { name: 'Recibir lote' }))
    expect(await screen.findByText('Lote A-000008 recibido: 30 a $ 2.000 hoy')).toBeInTheDocument()
    expect(calls.find((call) => call.url === '/products/9/animal-lots' && call.method === 'POST').data).toMatchObject({
      quantity: '30',
      unitCost: '1500',
      baseSalePrice: '2000',
      dailyIncrease: '200',
      maxSalePrice: null,
    })

    // Registrar muerte
    await user.click(within(await screen.findByRole('table', { name: 'Lotes de animales' })).getByRole('button', { name: 'Registrar muerte' }))
    const death = await screen.findByRole('dialog', { name: 'Registrar muerte' })
    await user.type(within(death).getByLabelText(/^¿Cuántos murieron\?/), '2')
    await user.click(within(death).getByRole('button', { name: 'Registrar muerte' }))
    expect(await screen.findByText('Muerte registrada en el lote A-000007: quedan 43')).toBeInTheDocument()
    expect(calls.find((call) => call.url === '/products/9/animal-lots/7/deaths').data).toEqual({ quantity: '2', notes: null })
  })
})

describe('punto de venta', () => {
  const SESSION = { id: 9, register: { id: 1, name: 'Mostrador' }, openedAt: '2026-11-22T12:00:00.000Z', status: 'open' }
  const TOTALS = { subtotal: '5600.00', lineDiscountTotal: '0.00', globalDiscount: '0.00', discountTotal: '0.00', discountPercent: '0.00', taxBase: '5600.00', taxTotal: '0.00', totalBeforeRounding: '5600.00', roundingAdjustment: '0.00', total: '5600.00' }
  const CATALOG = {
    id: 9,
    code: 'P-00009',
    name: 'Pollo de engorde',
    productKind: 'animal',
    unit: UND,
    salePrice: '0.00',
    taxRate: 'excluded',
    stock: '65.000',
    tracksBatches: false,
    presentations: [],
    animalLots: [
      { id: 7, lotNumber: 'A-000007', receivedOn: '2026-11-18', days: 4, availableQuantity: '45.000', priceToday: '2800.00' },
      { id: 8, lotNumber: 'A-000008', receivedOn: '2026-11-22', days: 0, availableQuantity: '20.000', priceToday: '2000.00' },
    ],
    matchedPresentationId: null,
  }

  it('con varios lotes pide escoger uno y manda el lote escogido', async () => {
    const user = userEvent.setup()
    const calls = mockApi({
      'GET /auth/me': session(buildUser({ permissions: ['sales.create', 'sales.view', 'cash.view', 'customers.view'] }), PLAN),
      'GET /health': healthyResponse,
      'GET /notifications/unread-count': ok({ unread: 0 }),
      'GET /notifications': page([]),
      'GET /branding': ok({ name: 'Agro El Campo', logo: null }),
      'GET /me/preferences': ok({ theme: 'system' }),
      'GET /payment-methods': ok([{ id: 1, name: 'Efectivo', isCash: true, requiresReference: false, isActive: true }]),
      'GET /cash-sessions': page([SESSION]),
      'GET /customers': page([]),
      'GET /sales/catalog': ok([CATALOG]),
      'POST /sales/preview': (call) =>
        call.data.items[0].animalLotId
          ? ok({ totals: TOTALS, lines: [{ productId: 9, gross: '5600.00', lineDiscount: '0.00', total: '5600.00' }], requires: { discount: false, expired: false }, warnings: { belowCost: [], expired: [] }, taxEnabled: false })
          : { status: 400, body: { success: false, error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos', details: [{ field: 'items[0].animalLotId', message: 'Escoge de qué lote es Pollo de engorde' }] } } },
    })
    renderApp('/ventas/punto-de-venta')

    const search = await screen.findByLabelText('Escanea o busca el producto')
    await user.type(search, 'Pollo')
    const result = await screen.findByRole('button', { name: /Pollo de engorde/ })
    expect(result).toHaveTextContent('$ 2.000 – $ 2.800')
    await user.click(result)

    expect(await screen.findByText('Escoge el lote')).toBeInTheDocument()
    const lots = screen.getByRole('radiogroup', { name: 'Lote de Pollo de engorde' })
    await user.click(within(lots).getByRole('radio', { name: /A-000007/ }))
    expect(screen.getByText('Lote A-000007 · quedan 45')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Sumar 1 a Pollo de engorde' }))

    await waitFor(() => expect(calls.filter((call) => call.url === '/sales/preview').at(-1).data.items).toEqual([{ productId: 9, animalLotId: 7, quantity: '2' }]))
  })
})
