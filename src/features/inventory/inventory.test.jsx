// Fase 5 — Pantallas de inventario con el backend simulado.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '../../test/renderWithProviders'
import { buildUser, fail, healthyResponse, mockApi, ok, restoreApi, session } from '../../test/mockApi'
import { toApiNumber, toInputNumber } from './inventoryOptions'

const ALL = [
  'inventory.view',
  'inventory.create',
  'inventory.update',
  'inventory.prices',
  'inventory.deactivate',
  'inventory.cost_view',
  'inventory.initial_stock',
  'inventory.import',
  'categories.manage',
  'suppliers.view',
  'suppliers.manage',
]
const KG = { id: 2, name: 'Kilogramo', symbol: 'kg', allowsDecimals: true, isActive: true }
const UND = { id: 1, name: 'Unidad', symbol: 'und', allowsDecimals: false, isActive: true }
const TREE = [
  {
    id: 1,
    parentId: null,
    name: 'Alimentos',
    defaultTaxRate: 'iva_5',
    defaultTaxRateLabel: 'IVA 5 %',
    expiredSalePolicy: 'authorization',
    isActive: true,
    productCount: 1,
    children: [{ id: 2, parentId: 1, name: 'Cerdos', defaultTaxRate: 'iva_5', expiredSalePolicy: 'authorization', isActive: true, productCount: 1 }],
  },
]
const SUPPLIER = { id: 7, documentType: 'NIT', documentNumber: '900123456-7', legalName: 'Distribuidora Agrícola del Huila S.A.S.', tradeName: 'Agrohuila', phone: '3001234567', paymentTermDays: 30, productCount: 1, isActive: true }

function buildProduct(overrides = {}) {
  return {
    id: 5,
    code: 'P-00005',
    name: 'Concentrado cerdos levante',
    description: null,
    category: { id: 2, name: 'Cerdos', parent: { id: 1, name: 'Alimentos' } },
    unit: { id: 2, name: 'Kilogramo', symbol: 'kg', allowsDecimals: true },
    barcode: '7701234567890',
    salePrice: '2600.00',
    taxRate: 'iva_5',
    taxRateLabel: 'IVA 5 %',
    minStock: '80.000',
    tracksBatches: false,
    expiredSalePolicy: null,
    effectiveExpiredSalePolicy: 'authorization',
    isActive: true,
    stock: '40.000',
    isLowStock: true,
    presentations: [],
    suppliers: [{ id: 7, legalName: SUPPLIER.legalName, tradeName: 'Agrohuila', isPrimary: true }],
    purchasePrice: '2100.0000',
    profit: '500.00',
    profitPercent: '23.81',
    averageCost: '2100.0000',
    stockValue: '84000.00',
    ...overrides,
  }
}

const page = (rows) => ({ status: 200, body: { success: true, data: rows, meta: { page: 1, pageSize: 20, total: rows.length, totalPages: 1 }, message: 'ok' } })

const baseRoutes = (permissions = ALL) => ({
  'GET /auth/me': session(buildUser({ permissions })),
  'GET /health': healthyResponse,
  'GET /notifications/unread-count': ok({ unread: 0 }),
  'GET /branding': ok({ name: 'Agro El Campo', logo: null }),
  'GET /me/preferences': ok({ theme: 'system' }),
  'GET /categories': ok(TREE),
  'GET /units': ok([UND, KG]),
  'GET /suppliers': page([SUPPLIER]),
})

afterEach(() => restoreApi())

describe('conversión de números', () => {
  it('lo que escribe el usuario pasa a texto decimal y viceversa', () => {
    expect(toApiNumber('12.500')).toBe('12500')
    expect(toApiNumber('$ 98.000')).toBe('98000')
    expect(toApiNumber('2,5')).toBe('2.5')
    expect(toApiNumber('1.250.000,75')).toBe('1250000.75')
    expect(toInputNumber('2600.00')).toBe('2600')
    expect(toInputNumber('12.500')).toBe('12,5')
  })
})

describe('lista de productos', () => {
  it('muestra existencia, alerta de existencia baja, precio de compra y ganancia', async () => {
    mockApi({ ...baseRoutes(), 'GET /products': page([buildProduct()]) })
    renderApp('/inventario/productos')

    expect(await screen.findByRole('link', { name: 'Concentrado cerdos levante' })).toHaveAttribute('href', '/inventario/productos/5')
    expect(screen.getByText('40 kg')).toBeInTheDocument()
    expect(screen.getByText('Baja')).toBeInTheDocument()
    expect(screen.getByText('$ 2.100')).toBeInTheDocument()
    expect(screen.getByText('(23,8 %)')).toBeInTheDocument()
  })

  it('sin el permiso de costos no hay columnas de costo ni botones de crear', async () => {
    const product = buildProduct()
    for (const key of ['purchasePrice', 'profit', 'profitPercent', 'averageCost', 'stockValue']) delete product[key]
    mockApi({ ...baseRoutes(['inventory.view']), 'GET /products': page([product]) })
    renderApp('/inventario/productos')

    await screen.findByRole('link', { name: 'Concentrado cerdos levante' })
    expect(screen.queryByText('Ganancia')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nuevo producto' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Importar' })).not.toBeInTheDocument()
  })

  it('el filtro de existencia (agotados) se envía al servidor', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ ...baseRoutes(), 'GET /products': page([]) })
    renderApp('/inventario/productos')

    await user.selectOptions(await screen.findByLabelText('Existencia'), 'out')
    expect(await screen.findByText('No hay productos agotados')).toBeInTheDocument()
    expect(calls.filter((call) => call.url === '/products').at(-1).params).toMatchObject({ stockStatus: 'out', isActive: 'true', page: 1 })
  })
})

describe('crear producto', () => {
  it('valida cada paso, convierte los números y lleva a la ficha del producto', async () => {
    const user = userEvent.setup()
    const calls = mockApi({
      ...baseRoutes(),
      'GET /products': page([]),
      'POST /products': (call) => ok(buildProduct({ id: 9, code: 'P-00009', name: call.data.name })),
      'GET /products/9': ok(buildProduct({ id: 9, code: 'P-00009', name: 'Sal mineralizada' })),
      'GET /products/9/movements': page([]),
    })
    renderApp('/inventario/productos')

    await user.click(await screen.findByRole('button', { name: 'Nuevo producto' }))
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo producto' })
    await user.click(within(dialog).getByRole('button', { name: 'Siguiente' }))
    expect(within(dialog).getByText('Escribe el nombre del producto')).toBeInTheDocument()
    expect(within(dialog).getByText('Selecciona una categoría')).toBeInTheDocument()

    await user.type(within(dialog).getByLabelText(/^Nombre/), 'Sal mineralizada')
    await user.selectOptions(within(dialog).getByLabelText(/^Unidad base/), '2')
    // Selector de categoría: se entra a "Alimentos" y se elige la subcategoría
    await user.click(within(dialog).getByLabelText(/^Categoría/))
    await user.click(within(dialog).getByRole('option', { name: /Alimentos/ }))
    await user.click(within(dialog).getByRole('option', { name: 'Cerdos' }))
    // La ficha muestra la ruta de la categoría
    expect(within(dialog).getByText('Alimentos › Cerdos', { selector: 'p' })).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Siguiente' }))

    // Sin precio de compra no avanza
    await user.click(within(dialog).getByRole('button', { name: 'Siguiente' }))
    expect(within(dialog).getByText('Escribe el precio de compra (ej. 10.000)')).toBeInTheDocument()

    // La ganancia no se escribe: se calcula con la compra y la venta
    expect(within(dialog).queryByLabelText(/Ganancia/)).not.toBeInTheDocument()
    await user.type(within(dialog).getByLabelText(/^Precio de compra/), '10.000')
    await user.type(within(dialog).getByLabelText(/^Precio de venta/), '12.500')
    expect(within(dialog).getByRole('status')).toHaveTextContent('Ganancia por kg$ 2.500 · 25,0 %')
    expect(within(dialog).getByText('$ 12.500')).toBeInTheDocument()
    expect(within(dialog).getByText('Gana $ 2.500 (25,0 %) por kg')).toBeInTheDocument()

    await user.clear(within(dialog).getByLabelText(/^Existencia mínima/))
    await user.type(within(dialog).getByLabelText(/^Existencia mínima/), '2,5')
    await user.click(within(dialog).getByRole('button', { name: 'Siguiente' }))

    // Empaque y cantidad: bulto de 40 kg (compra calculada 400.000) y 10 bultos en bodega
    await user.click(within(dialog).getByRole('switch', { name: '¿Se vende también por bulto o empaque?' }))
    await user.click(within(dialog).getByRole('button', { name: 'Siguiente' }))
    expect(within(dialog).getByText('Escribe cuántos kg trae el empaque (ej. 40)')).toBeInTheDocument()
    await user.type(within(dialog).getByLabelText(/^kg por empaque/), '40')
    expect(within(dialog).getByText('$ 400.000')).toBeInTheDocument()
    await user.type(within(dialog).getByLabelText(/^Precio de venta del empaque/), '480.000')
    expect(within(dialog).getByText('Ganancia por empaque')).toBeInTheDocument()
    await user.type(within(dialog).getByLabelText(/^Cantidad/), '10')
    await user.selectOptions(within(dialog).getByLabelText('En'), 'pack')
    expect(within(dialog).getByText('10 × Bulto 40 kg = 400 kg')).toBeInTheDocument()
    expect(within(dialog).getByText('Hay 400 kg')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Siguiente' }))

    await user.selectOptions(within(dialog).getByLabelText('Agregar proveedor'), '7')
    await user.click(within(dialog).getByRole('button', { name: 'Agregar' }))
    expect(within(dialog).getByText('Principal')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Crear producto' }))

    expect(await screen.findByText('Sal mineralizada creado con el código P-00009')).toBeInTheDocument()
    expect(calls.find((call) => call.method === 'POST').data).toEqual({
      name: 'Sal mineralizada',
      categoryId: 2,
      unitId: 2,
      description: null,
      minStock: '2.5',
      barcode: null,
      tracksBatches: false,
      expiredSalePolicy: null,
      suppliers: [{ supplierId: 7, isPrimary: true }],
      purchasePrice: '10000',
      salePrice: '12500',
      presentations: [{ name: 'Bulto 40 kg', factor: '40', salePrice: '480000' }],
      initialStock: { quantity: '10', presentationIndex: 0 },
    })
    expect(await screen.findByRole('heading', { name: 'Sal mineralizada' })).toBeInTheDocument()
  })

  it('el código P-<número> está reservado', async () => {
    const user = userEvent.setup()
    mockApi({ ...baseRoutes(), 'GET /products': page([]) })
    renderApp('/inventario/productos')

    await user.click(await screen.findByRole('button', { name: 'Nuevo producto' }))
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo producto' })
    await user.type(within(dialog).getByLabelText(/^Código interno/), 'p-00099')
    await user.click(within(dialog).getByRole('button', { name: 'Siguiente' }))
    expect(within(dialog).getByText(/los asigna el sistema/)).toBeInTheDocument()
  })
})

describe('selector de categoría', () => {
  it('busca subcategorías, muestra la categoría de cada resultado y Escape no cierra el formulario', async () => {
    const user = userEvent.setup()
    mockApi({ ...baseRoutes(), 'GET /products': page([]) })
    renderApp('/inventario/productos')

    await user.click(await screen.findByRole('button', { name: 'Nuevo producto' }))
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo producto' })
    await user.click(within(dialog).getByLabelText(/^Categoría/))
    await user.type(within(dialog).getByRole('searchbox', { name: 'Buscar categoría o subcategoría' }), 'cerd')

    const result = within(dialog).getByRole('option', { name: /Cerdos/ })
    expect(result).toHaveTextContent('Alimentos')
    await user.keyboard('{Enter}')
    expect(within(dialog).getByLabelText(/^Categoría/)).toHaveTextContent('Alimentos ›Cerdos')

    // Se puede usar la categoría sola
    await user.click(within(dialog).getByLabelText(/^Categoría/))
    await user.click(within(dialog).getByRole('option', { name: 'Usar solo «Alimentos»' }))
    expect(within(dialog).getByLabelText(/^Categoría/)).toHaveTextContent('Alimentos')

    await user.click(within(dialog).getByLabelText(/^Categoría/))
    await user.keyboard('{Escape}')
    expect(within(dialog).queryByRole('searchbox', { name: 'Buscar categoría o subcategoría' })).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Nuevo producto' })).toBeInTheDocument()
  })

  it('en el filtro de productos se puede quitar la categoría', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ ...baseRoutes(), 'GET /products': page([]) })
    renderApp('/inventario/productos')

    await user.click(await screen.findByLabelText('Categoría'))
    await user.click(screen.getByRole('option', { name: /Alimentos/ }))
    await user.click(screen.getByRole('option', { name: 'Cerdos' }))
    await waitFor(() => expect(calls.filter((call) => call.url === '/products').at(-1).params).toMatchObject({ categoryId: '2' }))

    // Al quitarlo vuelve a "Todas" (la lista sin filtro sale del caché: no hace falta otra petición)
    await user.click(screen.getByRole('button', { name: 'Quitar el filtro de categoría' }))
    expect(screen.getByLabelText('Categoría')).toHaveTextContent('Todas las categorías')
    expect(screen.queryByRole('button', { name: 'Quitar el filtro de categoría' })).not.toBeInTheDocument()
  })
})

describe('ficha del producto', () => {
  const detailRoutes = (product, movements = []) => ({
    ...baseRoutes(),
    'GET /products/5': ok(product),
    'GET /products/5/movements': page(movements),
    'GET /products/5/price-history': ok([]),
  })

  it('carga la existencia inicial solo si no hay movimientos', async () => {
    const user = userEvent.setup()
    const calls = mockApi({
      ...detailRoutes(buildProduct({ stock: '0.000', averageCost: '0.0000' })),
      'POST /products/5/initial-stock': ok(buildProduct({ stock: '400.000' })),
    })
    renderApp('/inventario/productos/5')

    await user.click(await screen.findByRole('button', { name: 'Existencia inicial' }))
    const dialog = await screen.findByRole('dialog', { name: 'Existencia inicial' })
    await user.type(within(dialog).getByLabelText(/^Cantidad/), '400')
    // El costo viene propuesto con el precio de compra del producto
    expect(within(dialog).getByLabelText(/^Costo de 1 kg/)).toHaveValue('2100')
    await user.click(within(dialog).getByRole('button', { name: 'Registrar existencia' }))

    expect(await screen.findByText('Existencia inicial registrada: 400 kg')).toBeInTheDocument()
    expect(calls.find((call) => call.method === 'POST').data).toEqual({ quantity: '400', unitCost: '2100' })
  })

  it('con movimientos no ofrece la existencia inicial y muestra el kárdex', async () => {
    const user = userEvent.setup()
    mockApi(
      detailRoutes(buildProduct(), [
        {
          id: 1,
          type: 'initial',
          typeLabel: 'Existencia inicial',
          quantity: '40.000',
          balanceAfter: '40.000',
          unitCost: '2100.0000',
          averageCostAfter: '2100.0000',
          user: { id: 1, fullName: 'Robinson Barrios' },
          createdAt: '2026-11-17T13:00:00.000Z',
        },
      ]),
    )
    renderApp('/inventario/productos/5')

    expect(await screen.findByText('Valor en inventario')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Existencia inicial' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: /Kárdex/ }))
    expect(screen.getByText('+40 kg')).toBeInTheDocument()
    expect(screen.getAllByText('Robinson Barrios').length).toBeGreaterThan(0)
  })

  it('agregar una presentación con precio bajo el costo pide confirmación y la envía', async () => {
    const user = userEvent.setup()
    const calls = mockApi({
      ...detailRoutes(buildProduct()),
      'POST /products/5/presentations': (call) =>
        call.data.confirmBelowCost
          ? ok(buildProduct({ presentations: [{ id: 1, name: 'Bulto 40 kg', factor: '40.000', salePrice: '80000.00', barcode: null, isActive: true }] }))
          : fail(409, 'CONFIRMATION_REQUIRED', 'El precio de venta queda por debajo del costo', [{ field: 'salePrice', message: 'Por debajo del costo' }]),
    })
    renderApp('/inventario/productos/5')

    await user.click(await screen.findByRole('button', { name: 'Nueva presentación' }))
    const dialog = await screen.findByRole('dialog', { name: 'Nueva presentación' })
    await user.type(within(dialog).getByLabelText(/^Nombre/), 'Bulto 40 kg')
    await user.type(within(dialog).getByLabelText(/^Contenido/), '40')
    await user.type(within(dialog).getByLabelText(/^Precio de venta/), '80.000')
    expect(within(dialog).getByText('$ 80.000')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Agregar presentación' }))

    const confirm = await screen.findByRole('dialog', { name: 'Precio por debajo del costo' })
    await user.click(within(confirm).getByRole('button', { name: 'Sí, guardar así' }))

    expect(await screen.findByText('Presentación agregada')).toBeInTheDocument()
    const posts = calls.filter((call) => call.method === 'POST')
    expect(posts).toHaveLength(2)
    expect(posts[0].data).not.toHaveProperty('confirmBelowCost')
    expect(posts[1].data).toEqual({ name: 'Bulto 40 kg', factor: '40', barcode: null, isSoldWhole: true, salePrice: '80000', confirmBelowCost: true })
  })

  it('sin inventory.prices el precio no se puede editar ni se envía', async () => {
    const user = userEvent.setup()
    const permissions = ALL.filter((code) => code !== 'inventory.prices')
    const calls = mockApi({ ...detailRoutes(buildProduct()), 'GET /auth/me': session(buildUser({ permissions })), 'PATCH /products/5': ok(buildProduct()) })
    renderApp('/inventario/productos/5')

    await user.click(await screen.findByRole('button', { name: 'Editar' }))
    const dialog = await screen.findByRole('dialog', { name: 'Editar producto' })
    await user.click(within(dialog).getByRole('button', { name: 'Siguiente' }))
    expect(within(dialog).getByLabelText(/^Precio de venta/)).toBeDisabled()
    await user.click(within(dialog).getByRole('button', { name: 'Siguiente' }))
    await user.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(calls.some((call) => call.method === 'PATCH')).toBe(true))
    expect(calls.find((call) => call.method === 'PATCH').data).not.toHaveProperty('salePrice')
  })
})

describe('categorías', () => {
  it('muestra el árbol y una subcategoría nueva propone lo de su categoría', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ ...baseRoutes(), 'POST /categories': (call) => ok({ id: 3, isActive: true, productCount: 0, ...call.data }) })
    renderApp('/inventario/categorias')

    expect(await screen.findByRole('heading', { name: 'Alimentos' })).toBeInTheDocument()
    expect(screen.getByText('Cerdos')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Agregar subcategoría a Alimentos' }))
    const dialog = await screen.findByRole('dialog', { name: 'Nueva subcategoría' })
    expect(within(dialog).getByLabelText('Tarifa de IVA')).toHaveValue('iva_5')
    await user.type(within(dialog).getByLabelText(/^Nombre/), 'Bovinos')
    await user.click(within(dialog).getByRole('button', { name: 'Crear subcategoría' }))

    await waitFor(() => expect(calls.some((call) => call.method === 'POST')).toBe(true))
    expect(calls.find((call) => call.method === 'POST').data).toEqual({ name: 'Bovinos', defaultTaxRate: 'iva_5', expiredSalePolicy: 'authorization', parentId: 1 })
  })
})

describe('proveedores', () => {
  it('registra un proveedor en tres pasos, validando el NIT', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ ...baseRoutes(), 'POST /suppliers': (call) => ok({ id: 8, productCount: 0, isActive: true, ...call.data }) })
    renderApp('/inventario/proveedores')

    expect(await screen.findByText('Agrohuila')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Nuevo proveedor' }))
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo proveedor' })

    await user.type(within(dialog).getByLabelText(/^Número de documento/), '12')
    await user.type(within(dialog).getByLabelText(/^Razón social/), 'Veterinaria La Granja Ltda')
    await user.click(within(dialog).getByRole('button', { name: 'Siguiente' }))
    expect(within(dialog).getByText(/De 5 a 15 dígitos/)).toBeInTheDocument()

    await user.clear(within(dialog).getByLabelText(/^Número de documento/))
    await user.type(within(dialog).getByLabelText(/^Número de documento/), '800.999.111-2')
    await user.click(within(dialog).getByRole('button', { name: 'Siguiente' }))
    await user.type(within(dialog).getByLabelText(/^Teléfono$/), '6088712345')
    await user.click(within(dialog).getByRole('button', { name: 'Siguiente' }))
    await user.clear(within(dialog).getByLabelText(/^Plazo de pago/))
    await user.type(within(dialog).getByLabelText(/^Plazo de pago/), '30')
    expect(within(dialog).getByText('Crédito a 30 días')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Registrar proveedor' }))

    expect(await screen.findByText('Veterinaria La Granja Ltda registrado')).toBeInTheDocument()
    expect(calls.find((call) => call.method === 'POST').data).toMatchObject({
      documentType: 'NIT',
      documentNumber: '800.999.111-2',
      legalName: 'Veterinaria La Granja Ltda',
      phone: '6088712345',
      paymentTermDays: 30,
      tradeName: null,
    })
  })
})

describe('importar desde Excel', () => {
  const xlsx = () => new File([new Uint8Array([0x50, 0x4b, 3, 4])], 'productos.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })

  it('muestra los errores por fila y no ofrece importar', async () => {
    const user = userEvent.setup()
    mockApi({
      ...baseRoutes(),
      'POST /products/import': ok({
        isValid: false,
        totalErrors: 2,
        errors: [
          { row: 5, field: 'Unidad', message: 'No existe la unidad "litros"' },
          { row: 6, field: 'Precio de venta', message: 'No es un número válido' },
        ],
      }),
    })
    renderApp('/inventario/importar')

    await user.upload(await screen.findByLabelText('Archivo de Excel con los productos'), xlsx())
    expect(await screen.findByText('El archivo tiene 2 errores')).toBeInTheDocument()
    expect(screen.getByText('No existe la unidad "litros"')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Importar \d/ })).not.toBeInTheDocument()
  })

  it('con el archivo válido muestra el resumen y luego importa', async () => {
    const user = userEvent.setup()
    const summary = { isValid: true, productsToCreate: 3, productsWithStock: 2, categoriesToCreate: ['Alimentos', 'Alimentos › Cerdos'], errors: [], totalErrors: 0 }
    const calls = mockApi({
      ...baseRoutes(),
      'POST /products/import': (call) => ok(call.params?.dryRun ? { ...summary, imported: false } : { ...summary, imported: true, created: 3 }),
    })
    renderApp('/inventario/importar')

    await user.upload(await screen.findByLabelText('Archivo de Excel con los productos'), xlsx())
    expect(await screen.findByText('Productos nuevos')).toBeInTheDocument()
    expect(screen.getByText('Alimentos › Cerdos')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Importar 3 productos' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Importar productos' })).getByRole('button', { name: 'Importar' }))

    expect(await screen.findByRole('heading', { name: '3 productos importados' })).toBeInTheDocument()
    const uploads = calls.filter((call) => call.url === '/products/import')
    expect(uploads.map((call) => call.params?.dryRun ?? 'commit')).toEqual(['true', 'commit'])
    expect(uploads[1].data.get('file').name).toBe('productos.xlsx')
  })

  it('rechaza archivos que no son .xlsx sin llamar a la API', async () => {
    const user = userEvent.setup({ applyAccept: false })
    const calls = mockApi(baseRoutes())
    renderApp('/inventario/importar')

    await user.upload(await screen.findByLabelText('Archivo de Excel con los productos'), new File(['a;b'], 'productos.csv', { type: 'text/csv' }))
    expect(screen.getByRole('alert')).toHaveTextContent('El archivo debe ser de Excel (.xlsx)')
    expect(calls.some((call) => call.url === '/products/import')).toBe(false)
  })
})

describe('menú', () => {
  it('muestra la sección Inventario según los permisos', async () => {
    mockApi({ ...baseRoutes(['inventory.view', 'suppliers.view']), 'GET /products': page([]) })
    renderApp('/')
    const nav = await screen.findByRole('navigation')
    expect(within(nav).getByRole('link', { name: 'Productos' })).toBeInTheDocument()
    expect(within(nav).getByRole('link', { name: 'Proveedores' })).toBeInTheDocument()
    expect(within(nav).queryByRole('link', { name: 'Categorías' })).not.toBeInTheDocument()
    expect(within(nav).queryByRole('link', { name: 'Importar desde Excel' })).not.toBeInTheDocument()
  })
})

describe('existencia: agotado y ajustes', () => {
  it('un producto sin existencia aparece como agotado, con su existencia en bultos cuando hay', async () => {
    const bulto = { id: 3, name: 'Bulto 40 kg', factor: '40.000', salePrice: '100000.00', isActive: true, stockWhole: '10', stockRemainder: '0.000' }
    mockApi({
      ...baseRoutes(),
      'GET /products': page([
        buildProduct({ stock: '0.000', isLowStock: true, isOutOfStock: true }),
        buildProduct({ id: 6, name: 'Concentrado cerdos ceba', stock: '400.000', isLowStock: false, isOutOfStock: false, presentations: [bulto] }),
      ]),
    })
    renderApp('/inventario/productos')

    expect(await screen.findByText('Agotado')).toBeInTheDocument()
    // Agotado reemplaza a "Baja"
    expect(screen.queryByText('Baja')).not.toBeInTheDocument()
    expect(screen.getByText('= 10 × Bulto 40 kg')).toBeInTheDocument()
  })

  it('ajusta la existencia con motivo, en bultos', async () => {
    const user = userEvent.setup()
    const bulto = { id: 3, name: 'Bulto 40 kg', factor: '40.000', salePrice: '100000.00', isActive: true, stockWhole: '1', stockRemainder: '0.000' }
    const adjusted = buildProduct({ stock: '0.000', isOutOfStock: true, presentations: [{ ...bulto, stockWhole: '0' }] })
    const calls = mockApi({
      ...baseRoutes([...ALL, 'inventory.adjust']),
      // Después del ajuste, la ficha se vuelve a pedir y ya muestra el producto agotado
      'GET /products/5': (call, all) => (all.some((item) => item.method === 'POST') ? ok(adjusted) : ok(buildProduct({ presentations: [bulto] }))),
      'GET /products/5/movements': page([]),
      'POST /products/5/adjustments': ok(adjusted),
    })
    renderApp('/inventario/productos/5')

    await user.click(await screen.findByRole('button', { name: 'Ajustar existencia' }))
    const dialog = await screen.findByRole('dialog', { name: 'Ajustar existencia' })
    await user.click(within(dialog).getByRole('button', { name: 'Registrar ajuste' }))
    expect(within(dialog).getByText('Selecciona el motivo')).toBeInTheDocument()

    await user.type(within(dialog).getByLabelText(/^Cantidad/), '1')
    await user.selectOptions(within(dialog).getByLabelText('En'), '3')
    expect(within(dialog).getByText('1 × Bulto 40 kg = 40 kg')).toBeInTheDocument()
    // Los motivos dependen de si es salida o entrada
    expect(within(dialog).queryByRole('option', { name: 'Bonificación del proveedor' })).not.toBeInTheDocument()
    await user.selectOptions(within(dialog).getByLabelText(/^Motivo/), 'damaged')
    await user.type(within(dialog).getByLabelText(/^Nota/), 'Bulto mojado')
    await user.click(within(dialog).getByRole('button', { name: 'Registrar ajuste' }))

    expect(await screen.findByText('Existencia ajustada: ahora hay 0 kg')).toBeInTheDocument()
    expect(calls.find((call) => call.method === 'POST').data).toEqual({ direction: 'out', quantity: '1', presentationId: 3, reason: 'damaged', notes: 'Bulto mojado' })
    expect(await screen.findAllByText('Agotado')).not.toHaveLength(0)
  })

  it('sin el permiso de ajustar no aparece el botón', async () => {
    mockApi({ ...baseRoutes(), 'GET /products/5': ok(buildProduct()), 'GET /products/5/movements': page([]) })
    renderApp('/inventario/productos/5')
    await screen.findByRole('heading', { name: 'Concentrado cerdos levante' })
    expect(screen.queryByRole('button', { name: 'Ajustar existencia' })).not.toBeInTheDocument()
  })
})
