// Compras con varios proveedores (D-COMP-9) con el backend simulado: «Nueva compra», el detalle
// con sus proveedores y total, y «¿A qué compra va?» en Nuevo producto.
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '../../test/renderWithProviders'
import { BASIC_PLAN, buildUser, healthyResponse, mockApi, ok, restoreApi, session } from '../../test/mockApi'

const PLAN = { ...BASIC_PLAN, features: [...BASIC_PLAN.features, 'purchases'] }
const ALL = ['purchases.view', 'purchases.create', 'purchases.confirm', 'suppliers.view', 'inventory.view', 'inventory.create', 'inventory.update', 'inventory.cost_view', 'inventory.prices', 'inventory.initial_stock']
const KG = { id: 2, name: 'Kilogramo', symbol: 'kg', allowsDecimals: true, isActive: true }
const TREE = [{ id: 1, parentId: null, name: 'Alimentos', defaultTaxRate: 'excluded', expiredSalePolicy: 'allow', isActive: true, productCount: 0, children: [] }]
const CONTEGRAL = { id: 7, documentType: 'NIT', documentNumber: '900123456', legalName: 'Contegral S.A.S.', tradeName: 'Contegral', isActive: true }
const VECOL = { id: 8, documentType: 'NIT', documentNumber: '800222333', legalName: 'Vecol S.A.', tradeName: null, isActive: true }

const GROUP = { id: 3, name: 'Viaje a Ibagué', isOpen: true, suppliersCount: 2, productsCount: 3, total: '1900000.00', createdAt: '2026-11-18T15:00:00.000Z', createdBy: { id: 1, fullName: 'Robinson Barrios' } }
const item = (id, productName, quantity, extra = {}) => ({ id, productName, unitSymbol: 'kg', presentation: null, quantity, unitPrice: '2000.0000', netAmount: null, ...extra })
const GROUP_DETAIL = {
  ...GROUP,
  parts: [
    {
      id: 31,
      number: null,
      status: 'draft',
      supplier: CONTEGRAL,
      total: '1750000.00',
      items: [item(1, 'Concentrado cerdos', '20.000', { presentation: { id: 4, name: 'Bulto 40 kg' }, unitPrice: '80000.0000', netAmount: '1600000.00' }), item(2, 'Sal mineralizada', '50.000', { unitPrice: '3000.0000', netAmount: '150000.00' })],
    },
    { id: 32, number: 'C-000004', status: 'confirmed', paymentStatus: 'pending', supplier: VECOL, total: '150000.00', items: [item(3, 'Vacuna aftosa', '10.000', { unitSymbol: 'und', unitPrice: '15000.0000', netAmount: '150000.00' })] },
  ],
}

const page = (rows) => ({ status: 200, body: { success: true, data: rows, meta: { page: 1, pageSize: 20, total: rows.length, totalPages: 1 }, message: 'ok' } })

const baseRoutes = (permissions = ALL) => ({
  'GET /auth/me': session(buildUser({ permissions }), PLAN),
  'GET /health': healthyResponse,
  'GET /notifications/unread-count': ok({ unread: 0 }),
  'GET /branding': ok({ name: 'Agro El Campo', logo: null }),
  'GET /me/preferences': ok({ theme: 'system' }),
  'GET /suppliers': page([CONTEGRAL, VECOL]),
  'GET /purchases': page([]),
  'GET /purchase-groups': ok([GROUP]),
  'GET /purchase-groups/3': ok(GROUP_DETAIL),
  'GET /categories': ok(TREE),
  'GET /units': ok([KG]),
  'GET /products': page([]),
})

beforeEach(() => window.localStorage.clear())
afterEach(() => restoreApi())

describe('Compras', () => {
  it('muestra las compras con varios proveedores y «Nueva compra» crea una y la abre', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ ...baseRoutes(), 'POST /purchase-groups': (call) => ok({ ...GROUP, id: 3, name: call.data.name, parts: [] }) })
    renderApp('/compras')

    const card = await screen.findByRole('link', { name: /Viaje a Ibagué/ })
    expect(card).toHaveAttribute('href', '/compras/grupos/3')
    expect(within(card).getByText('2 proveedores · 3 productos')).toBeInTheDocument()
    expect(within(card).getByText('$ 1.900.000')).toBeInTheDocument()
    // La compra de un solo proveedor sigue igual
    expect(screen.getByRole('link', { name: 'Compra a un proveedor' })).toHaveAttribute('href', '/compras/nueva')

    await user.click(screen.getByRole('button', { name: 'Nueva compra' }))
    const dialog = await screen.findByRole('dialog', { name: 'Nueva compra' })
    await user.type(within(dialog).getByLabelText('Nombre'), 'Viaje a Ibagué')
    await user.click(within(dialog).getByRole('button', { name: 'Crear compra' }))

    expect(calls.find((call) => call.method === 'POST').data).toEqual({ name: 'Viaje a Ibagué' })
    expect(await screen.findByRole('heading', { name: 'Viaje a Ibagué' })).toBeInTheDocument()
  })

  it('sin nombre, la crea con el nombre por defecto del servidor', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ ...baseRoutes(), 'GET /purchase-groups': ok([]), 'POST /purchase-groups': ok({ ...GROUP, name: 'Compra del 18 nov 2026', parts: [] }) })
    renderApp('/compras')
    await user.click(await screen.findByRole('button', { name: 'Nueva compra' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Crear compra' }))
    expect(calls.find((call) => call.method === 'POST').data).toEqual({})
  })

  it('el detalle muestra cada proveedor con sus productos, el total y cómo confirmar', async () => {
    mockApi(baseRoutes())
    renderApp('/compras/grupos/3')

    expect(await screen.findByRole('heading', { name: 'Viaje a Ibagué' })).toBeInTheDocument()
    expect(screen.getByText('Total de la compra').previousSibling).toHaveTextContent('$ 1.900.000')
    const contegral = screen.getByRole('region', { name: 'Compra a Contegral' })
    expect(within(contegral).getByText('20 × Bulto 40 kg')).toBeInTheDocument()
    expect(within(contegral).getByText('$ 1.600.000')).toBeInTheDocument()
    expect(within(contegral).getByText('$ 1.750.000')).toBeInTheDocument()
    expect(within(contegral).getByRole('link', { name: 'Revisar y confirmar' })).toHaveAttribute('href', '/compras/31')
    const vecol = screen.getByRole('region', { name: 'Compra a Vecol S.A.' })
    expect(within(vecol).getByText('C-000004')).toBeInTheDocument()
    expect(within(vecol).getByRole('link', { name: 'Ver la compra' })).toHaveAttribute('href', '/compras/32')
    expect(screen.getByText('«¿A qué compra va?»')).toBeInTheDocument()
  })
})

/** Llena Nuevo producto hasta el último paso (Proveedores). */
async function fillProduct(user, { withSupplier = true } = {}) {
  await user.click(await screen.findByRole('button', { name: 'Nuevo producto' }))
  const dialog = await screen.findByRole('dialog', { name: 'Nuevo producto' })
  await user.type(within(dialog).getByLabelText(/^Nombre/), 'Sal mineralizada')
  await user.selectOptions(within(dialog).getByLabelText(/^Unidad base/), '2')
  await user.click(within(dialog).getByLabelText(/^Categoría/))
  await user.click(within(dialog).getByRole('option', { name: /Alimentos/ }))
  await user.click(within(dialog).getByRole('button', { name: 'Siguiente' }))
  await user.type(within(dialog).getByLabelText(/^Precio de compra/), '3.000')
  await user.type(within(dialog).getByLabelText(/^Precio de venta/), '4.000')
  await user.click(within(dialog).getByRole('button', { name: 'Siguiente' }))
  await user.click(within(dialog).getByRole('button', { name: 'Siguiente' }))
  if (withSupplier) {
    await user.selectOptions(within(dialog).getByLabelText('Agregar proveedor'), '7')
    await user.click(within(dialog).getByRole('button', { name: 'Agregar' }))
  }
  return dialog
}

describe('Nuevo producto: «¿A qué compra va?»', () => {
  const productRoutes = () => ({
    ...baseRoutes(),
    'POST /products': (call) => ok({ id: 9, code: 'P-00009', name: call.data.name, unit: KG, presentations: [], suppliers: [] }),
    'GET /products/9': ok({ id: 9, code: 'P-00009', name: 'Sal mineralizada', unit: KG, category: { id: 1, name: 'Alimentos', parent: null }, presentations: [], suppliers: [], isActive: true, stock: '0.000' }),
    'GET /products/9/movements': page([]),
  })

  it('agrega el producto a la compra escogida con su cantidad y recuerda la compra', async () => {
    const user = userEvent.setup()
    const calls = mockApi(productRoutes())
    renderApp('/inventario/productos')
    const dialog = await fillProduct(user)

    const select = within(dialog).getByLabelText('Compra')
    expect(select).toHaveValue('')
    expect(within(select).getByRole('option', { name: 'Viaje a Ibagué · $ 1.900.000' })).toBeInTheDocument()
    await user.selectOptions(select, '3')
    expect(within(dialog).getByText('Va a la parte de Contegral. Entran al inventario al confirmarla.')).toBeInTheDocument()
    // Sin cantidad no deja crear
    await user.click(within(dialog).getByRole('button', { name: 'Crear producto' }))
    expect(within(dialog).getByText('Escribe cuántas llegan en la compra')).toBeInTheDocument()
    await user.type(within(dialog).getByLabelText(/^¿Cuántas llegan\?/), '50')
    await user.click(within(dialog).getByRole('button', { name: 'Crear producto' }))

    expect(await screen.findByText('Sal mineralizada creado con el código P-00009 y agregado a «Viaje a Ibagué»')).toBeInTheDocument()
    const body = calls.find((call) => call.method === 'POST' && call.url === '/products').data
    expect(body.purchase).toEqual({ groupId: 3, quantity: '50' })
    expect(body.suppliers).toEqual([{ supplierId: 7, isPrimary: true }])
    expect(body.initialStock).toBeUndefined()
    expect(window.localStorage.getItem('nexsupply.lastPurchaseGroup')).toBe('3')
  })

  it('propone la última compra usada y sin proveedor no deja agregarlo', async () => {
    window.localStorage.setItem('nexsupply.lastPurchaseGroup', '3')
    const user = userEvent.setup()
    const calls = mockApi(productRoutes())
    renderApp('/inventario/productos')
    const dialog = await fillProduct(user, { withSupplier: false })

    expect(await within(dialog).findByDisplayValue('Viaje a Ibagué · $ 1.900.000')).toBeInTheDocument()
    await user.type(within(dialog).getByLabelText(/^¿Cuántas llegan\?/), '5')
    await user.click(within(dialog).getByRole('button', { name: 'Crear producto' }))
    expect(within(dialog).getByText('Escoge el proveedor: el producto va a la compra de ese proveedor')).toBeInTheDocument()
    expect(calls.some((call) => call.method === 'POST')).toBe(false)

    // «Ninguna»: se crea como siempre
    await user.selectOptions(within(dialog).getByLabelText('Compra'), '')
    await user.click(within(dialog).getByRole('button', { name: 'Crear producto' }))
    expect(await screen.findByText('Sal mineralizada creado con el código P-00009')).toBeInTheDocument()
    expect(calls.find((call) => call.method === 'POST').data.purchase).toBeUndefined()
  })

  it('sin permiso de registrar compras no aparece el selector', async () => {
    const user = userEvent.setup()
    const calls = mockApi(baseRoutes(ALL.filter((code) => code !== 'purchases.create')))
    renderApp('/inventario/productos')
    const dialog = await fillProduct(user)
    expect(within(dialog).queryByLabelText('Compra')).not.toBeInTheDocument()
    expect(calls.some((call) => call.url === '/purchase-groups')).toBe(false)
  })
})

describe('Editar producto: «¿A qué compra va?»', () => {
  const EXISTING = {
    id: 5,
    code: 'P-00005',
    name: 'Concentrado cerdos',
    description: null,
    category: { id: 1, name: 'Alimentos', parent: null },
    unit: { id: 2, name: 'Kilogramo', symbol: 'kg', allowsDecimals: true },
    barcode: null,
    salePrice: '2600.00',
    taxRate: 'excluded',
    minStock: '0.000',
    tracksBatches: false,
    expiredSalePolicy: null,
    isActive: true,
    stock: '0.000',
    presentations: [{ id: 4, name: 'Bulto 40 kg', factor: '40.000', salePrice: '100000.00', isActive: true }],
    suppliers: [{ id: 7, legalName: 'Contegral S.A.S.', tradeName: 'Contegral', isPrimary: true }],
    purchasePrice: '2000.0000',
  }

  it('agrega un producto que ya existe a la compra, en bultos, al guardar los cambios', async () => {
    window.localStorage.setItem('nexsupply.lastPurchaseGroup', '3')
    const user = userEvent.setup()
    const calls = mockApi({ ...baseRoutes(), 'GET /products': page([EXISTING]), 'PATCH /products/5': (call) => ok({ ...EXISTING, name: call.data.name ?? EXISTING.name }) })
    renderApp('/inventario/productos')

    await user.click(await screen.findByRole('button', { name: /^Editar Concentrado cerdos/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Editar producto' })
    await user.click(within(dialog).getByRole('button', { name: 'Siguiente' }))
    await user.click(within(dialog).getByRole('button', { name: 'Siguiente' }))

    // Al editar no se propone sola: hay que escogerla
    const select = within(dialog).getByLabelText('Compra')
    expect(select).toHaveValue('')
    await user.selectOptions(select, '3')
    await user.type(within(dialog).getByLabelText(/^¿Cuántas llegan\?/), '10')
    await user.selectOptions(within(dialog).getByLabelText('En'), '4')
    await user.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByText('Concentrado cerdos actualizado y agregado a «Viaje a Ibagué»')).toBeInTheDocument()
    expect(calls.find((call) => call.method === 'PATCH').data.purchase).toEqual({ groupId: 3, quantity: '10', presentationId: 4 })
  })

  it('con «Ninguna» solo guarda los cambios y no olvida la compra que se venía usando', async () => {
    window.localStorage.setItem('nexsupply.lastPurchaseGroup', '3')
    const user = userEvent.setup()
    const calls = mockApi({ ...baseRoutes(), 'GET /products': page([EXISTING]), 'PATCH /products/5': ok(EXISTING) })
    renderApp('/inventario/productos')

    await user.click(await screen.findByRole('button', { name: /^Editar Concentrado cerdos/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Editar producto' })
    await user.click(within(dialog).getByRole('button', { name: 'Siguiente' }))
    await user.click(within(dialog).getByRole('button', { name: 'Siguiente' }))
    await user.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByText('Concentrado cerdos actualizado')).toBeInTheDocument()
    expect(calls.find((call) => call.method === 'PATCH').data.purchase).toBeUndefined()
    expect(window.localStorage.getItem('nexsupply.lastPurchaseGroup')).toBe('3')
  })
})
