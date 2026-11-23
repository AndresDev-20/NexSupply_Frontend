// Comprar en empaque y vender por partes (D-INV-20) con el backend simulado: un frasco de
// 100 cc que costó $ 100.000 y se vende a $ 2.000 el cc.
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '../../test/renderWithProviders'
import { buildUser, healthyResponse, mockApi, ok, restoreApi, session } from '../../test/mockApi'
import { previewDivide } from '../../utils/moneyPreview'

const ALL = ['inventory.view', 'inventory.create', 'inventory.update', 'inventory.prices', 'inventory.cost_view', 'inventory.initial_stock', 'suppliers.view']
const CC = { id: 9, name: 'Centímetro cúbico', symbol: 'cc', allowsDecimals: true, isActive: true }
const TREE = [{ id: 1, parentId: null, name: 'Veterinarios', defaultTaxRate: 'excluded', expiredSalePolicy: 'block', isActive: true, productCount: 0, children: [] }]

const page = (rows) => ({ status: 200, body: { success: true, data: rows, meta: { page: 1, pageSize: 20, total: rows.length, totalPages: 1 }, message: 'ok' } })

function buildProduct(overrides = {}) {
  return {
    id: 9,
    code: 'P-00009',
    name: 'Ivermectina 1 %',
    description: null,
    category: { id: 1, name: 'Veterinarios', parent: null },
    unit: CC,
    barcode: null,
    salePrice: '2000.00',
    taxRate: 'excluded',
    minStock: '0.000',
    tracksBatches: false,
    expiredSalePolicy: null,
    isActive: true,
    stock: '0.000',
    isOutOfStock: true,
    presentations: [],
    suppliers: [],
    purchasePrice: '1000.0000',
    profit: '1000.00',
    profitPercent: '100.00',
    averageCost: '0.0000',
    stockValue: '0.00',
    ...overrides,
  }
}

const baseRoutes = (permissions = ALL) => ({
  'GET /auth/me': session(buildUser({ permissions })),
  'GET /health': healthyResponse,
  'GET /notifications/unread-count': ok({ unread: 0 }),
  'GET /branding': ok({ name: 'Agro El Campo', logo: null }),
  'GET /me/preferences': ok({ theme: 'system' }),
  'GET /categories': ok(TREE),
  'GET /units': ok([CC]),
  'GET /suppliers': page([]),
  'GET /products': page([]),
})

afterEach(() => restoreApi())

describe('vista previa del costo por unidad', () => {
  it('divide lo que costó el empaque entre lo que trae, con 4 decimales', () => {
    expect(previewDivide('100000', '100')).toBe('1000.0000')
    expect(previewDivide('25000', '30')).toBe('833.3333')
    expect(previewDivide('100', '0')).toBeNull()
  })
})

/** Llena General y deja el formulario en Precios. */
async function startProduct(user) {
  await user.click(await screen.findByRole('button', { name: 'Nuevo producto' }))
  const dialog = await screen.findByRole('dialog', { name: 'Nuevo producto' })
  await user.type(within(dialog).getByLabelText(/^Nombre/), 'Ivermectina 1 %')
  await user.selectOptions(within(dialog).getByLabelText(/^Unidad base/), '9')
  await user.click(within(dialog).getByLabelText(/^Categoría/))
  await user.click(within(dialog).getByRole('option', { name: /Veterinarios/ }))
  await user.click(within(dialog).getByRole('button', { name: 'Siguiente' }))
  return dialog
}

describe('Nuevo producto: «¿Cómo lo compras?»', () => {
  const routes = () => ({
    ...baseRoutes(),
    'POST /products': ok(buildProduct()),
    'GET /products/9': ok(buildProduct()),
    'GET /products/9/movements': page([]),
  })

  it('en empaque: escribe lo que costó el frasco, muestra el costo por cc y no lo vende completo', async () => {
    const user = userEvent.setup()
    const calls = mockApi(routes())
    renderApp('/inventario/productos')
    const dialog = await startProduct(user)

    await user.click(within(dialog).getByRole('radio', { name: /En empaque/ }))
    // Sin precio por unidad: se calcula con el empaque
    expect(within(dialog).queryByLabelText(/^Precio de compra/)).not.toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Siguiente' }))
    expect(within(dialog).getByText('Escribe cuántos cc trae (ej. 100)')).toBeInTheDocument()
    expect(within(dialog).getByText('Escribe cuánto te costó el empaque (ej. 100.000)')).toBeInTheDocument()

    await user.type(within(dialog).getByLabelText(/^Nombre del empaque/), 'Frasco 100 cc')
    await user.type(within(dialog).getByLabelText(/^¿Cuántos cc trae\?/), '100')
    await user.type(within(dialog).getByLabelText(/^¿Cuánto te costó el empaque\?/), '100.000')
    expect(within(dialog).getByText('Costo por cc').nextSibling).toHaveTextContent('$ 1.000')
    await user.type(within(dialog).getByLabelText(/^Precio de venta/), '2.000')
    expect(within(dialog).getByRole('status')).toHaveTextContent('Ganancia por cc$ 1.000 · 100,0 %')
    await user.click(within(dialog).getByRole('button', { name: 'Siguiente' }))

    // Empaque y cantidad: por defecto el frasco no se vende completo
    const wholeSwitch = within(dialog).getByRole('switch', { name: '¿También vendes el empaque completo (Frasco 100 cc)?' })
    expect(wholeSwitch).not.toBeChecked()
    expect(within(dialog).queryByLabelText(/^Precio de venta del empaque/)).not.toBeInTheDocument()
    expect(within(dialog).getByText('Se vende por cc')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Siguiente' }))
    await user.click(within(dialog).getByRole('button', { name: 'Crear producto' }))

    expect(await screen.findByText('Ivermectina 1 % creado con el código P-00009')).toBeInTheDocument()
    const body = calls.find((call) => call.method === 'POST').data
    expect(body.purchasePrice).toBeUndefined()
    expect(body.salePrice).toBe('2000')
    expect(body.presentations).toEqual([{ name: 'Frasco 100 cc', factor: '100', isSoldWhole: false, purchasePrice: '100000' }])
  })

  it('si también vende el frasco completo, pide su precio y muestra la ganancia', async () => {
    const user = userEvent.setup()
    const calls = mockApi(routes())
    renderApp('/inventario/productos')
    const dialog = await startProduct(user)

    await user.click(within(dialog).getByRole('radio', { name: /En empaque/ }))
    await user.type(within(dialog).getByLabelText(/^¿Cuántos cc trae\?/), '100')
    await user.type(within(dialog).getByLabelText(/^¿Cuánto te costó el empaque\?/), '100.000')
    await user.type(within(dialog).getByLabelText(/^Precio de venta/), '2.000')
    await user.click(within(dialog).getByRole('button', { name: 'Siguiente' }))

    await user.click(within(dialog).getByRole('switch', { name: '¿También vendes el empaque completo (Empaque 100 cc)?' }))
    await user.click(within(dialog).getByRole('button', { name: 'Siguiente' }))
    expect(within(dialog).getByText('Escribe el precio de venta del empaque completo (ej. 100.000)')).toBeInTheDocument()
    await user.type(within(dialog).getByLabelText(/^Precio de venta del empaque completo/), '180.000')
    expect(within(dialog).getByText('Ganancia por empaque')).toBeInTheDocument()
    // La cantidad de hoy se puede escribir en frascos
    await user.type(within(dialog).getByLabelText(/^Cantidad/), '2')
    await user.selectOptions(within(dialog).getByLabelText('En'), 'pack')
    expect(within(dialog).getByText('2 × Empaque 100 cc = 200 cc')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Siguiente' }))
    await user.click(within(dialog).getByRole('button', { name: 'Crear producto' }))

    await screen.findByText('Ivermectina 1 % creado con el código P-00009')
    const body = calls.find((call) => call.method === 'POST').data
    expect(body.presentations).toEqual([{ name: 'Empaque 100 cc', factor: '100', salePrice: '180000', purchasePrice: '100000' }])
    expect(body.initialStock).toEqual({ quantity: '2', presentationIndex: 0 })
  })
})

describe('ficha del producto: empaque que solo se compra', () => {
  it('agrega un frasco que no se vende completo y la tabla lo muestra como solo compra', async () => {
    const user = userEvent.setup()
    const frasco = { id: 4, name: 'Frasco 100 cc', factor: '100.000', salePrice: null, isSoldWhole: false, purchasePrice: '100000.0000', barcode: null, isActive: true, stockWhole: '0', stockRemainder: '0.000' }
    const calls = mockApi({
      ...baseRoutes(),
      'GET /products/9': (call, all) => ok(buildProduct(all.some((item) => item.method === 'POST') ? { presentations: [frasco] } : {})),
      'GET /products/9/movements': page([]),
      'POST /products/9/presentations': ok(buildProduct({ presentations: [frasco] })),
    })
    renderApp('/inventario/productos/9')

    await user.click(await screen.findByRole('button', { name: /Agregar presentación|Nueva presentación/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Nueva presentación' })
    await user.type(within(dialog).getByLabelText(/^Nombre/), 'Frasco 100 cc')
    await user.type(within(dialog).getByLabelText(/^Contenido/), '100')
    await user.click(within(dialog).getByRole('switch', { name: 'Se vende completo' }))
    expect(within(dialog).queryByLabelText(/^Precio de venta/)).not.toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Agregar presentación' }))

    expect(calls.find((call) => call.method === 'POST').data).toEqual({ name: 'Frasco 100 cc', factor: '100', barcode: null, isSoldWhole: false })
    expect(await screen.findByText('Solo compra · se vende por cc')).toBeInTheDocument()
  })
})
