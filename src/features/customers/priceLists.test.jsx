// Precios por tipo de cliente (D-PRE-1) con el backend simulado: listas, precios especiales,
// la lista en la ficha del cliente y en el punto de venta.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '../../test/renderWithProviders'
import { BASIC_PLAN, buildUser, healthyResponse, mockApi, ok, restoreApi, session } from '../../test/mockApi'
import { previewListPrice } from './priceLists/priceListOptions'

const PLAN = { ...BASIC_PLAN, features: [...BASIC_PLAN.features, 'customers', 'sales', 'cash'] }
const MANAGER = ['price_lists.manage', 'customers.view', 'customers.manage']
const MAYORISTA = { id: 2, name: 'Mayorista', discountPercent: '8.00', notes: null, isActive: true, customersCount: 3, itemsCount: 1, createdAt: '2026-11-22T15:00:00.000Z' }
const DETAIL = { ...MAYORISTA, items: [{ id: 11, productId: 5, productCode: 'P-00005', productName: 'Concentrado cerdos', presentationId: 3, presentationName: 'Bulto 40 kg', regularPrice: '87500.00', price: '79000.00' }] }
const PRODUCTS = [
  { id: 5, code: 'P-00005', name: 'Concentrado cerdos', unitSymbol: 'kg', regularPrice: '2345.00', price: '2200.00', special: false, presentations: [{ id: 3, name: 'Bulto 40 kg', regularPrice: '87500.00', price: '79000.00', special: true }] },
]

const page = (rows) => ({ status: 200, body: { success: true, data: rows, meta: { page: 1, pageSize: 20, total: rows.length, totalPages: 1 }, message: 'ok' } })

const baseRoutes = (permissions = MANAGER) => ({
  'GET /auth/me': session(buildUser({ permissions }), PLAN),
  'GET /health': healthyResponse,
  'GET /notifications/unread-count': ok({ unread: 0 }),
  'GET /notifications': page([]),
  'GET /branding': ok({ name: 'Agro El Campo', logo: null }),
  'GET /me/preferences': ok({ theme: 'system' }),
  'GET /price-lists': ok([MAYORISTA]),
  'GET /price-lists/2': ok(DETAIL),
  'GET /price-lists/2/products': page(PRODUCTS),
})

beforeEach(() => window.localStorage.clear())
afterEach(() => restoreApi())

describe('vista previa del precio de la lista', () => {
  it('resta el %, redondea hacia arriba a la centena y no pasa del precio normal', () => {
    expect(previewListPrice('2345', '8')).toBe('2200.00')
    expect(previewListPrice('87500', '8')).toBe('80500.00')
    expect(previewListPrice('2150', '1')).toBe('2150.00')
    expect(previewListPrice('8000', '')).toBe('8000.00')
  })
})

describe('Listas de precios', () => {
  it('muestra las listas y «Nueva lista» la crea con el % y su vista previa', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ ...baseRoutes(), 'POST /price-lists': (call) => ok({ ...MAYORISTA, id: 4, ...call.data, discountPercent: call.data.discountPercent, items: [] }), 'GET /price-lists/4': ok({ ...DETAIL, id: 4, name: 'Distribuidor', items: [] }), 'GET /price-lists/4/products': page([]) })
    renderApp('/clientes/listas-de-precios')

    const row = (await screen.findByText('Mayorista')).closest('tr')
    expect(within(row).getByText('8 % menos')).toBeInTheDocument()
    expect(within(row).getByText('3 clientes')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Nueva lista' }))
    const dialog = await screen.findByRole('dialog', { name: 'Nueva lista de precios' })
    await user.type(within(dialog).getByLabelText(/^Nombre/), 'Distribuidor')
    await user.type(within(dialog).getByLabelText(/^% menos/), '10')
    // $ 2.345 − 10 % = 2.110,50 → $ 2.200
    expect(within(within(dialog).getByRole('list', { name: 'Ejemplos de precios' })).getAllByRole('listitem')[0]).toHaveTextContent('$ 2.200')
    await user.click(within(dialog).getByRole('button', { name: 'Crear lista' }))

    expect(calls.find((call) => call.method === 'POST').data).toEqual({ name: 'Distribuidor', discountPercent: '10', notes: null })
    expect(await screen.findByRole('heading', { name: 'Distribuidor' })).toBeInTheDocument()
  })

  it('la lista muestra precio normal y de la lista, y pone o quita precios especiales', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ ...baseRoutes(), 'PUT /price-lists/2/items': ok(DETAIL), 'DELETE /price-lists/2/items/11': ok({ ...DETAIL, items: [] }) })
    renderApp('/clientes/listas-de-precios/2')

    const unitRow = (await screen.findByText('P-00005 · kg')).closest('tr')
    expect(within(unitRow).getByText('$ 2.345')).toBeInTheDocument()
    expect(within(unitRow).getByText('$ 2.200')).toBeInTheDocument()
    const packRow = screen.getByText('P-00005 · Bulto 40 kg').closest('tr')
    expect(within(packRow).getByText('Especial')).toBeInTheDocument()

    await user.click(within(unitRow).getByRole('button', { name: 'Poner precio especial a Concentrado cerdos (kg)' }))
    const dialog = await screen.findByRole('dialog', { name: 'Precio especial' })
    await user.type(within(dialog).getByLabelText(/^Precio especial/), '2.150')
    await user.click(within(dialog).getByRole('button', { name: 'Guardar precio' }))
    expect(calls.find((call) => call.method === 'PUT').data).toEqual({ productId: 5, presentationId: null, price: '2150' })

    await user.click(within(packRow).getByRole('button', { name: 'Quitar el precio especial de Concentrado cerdos (Bulto 40 kg)' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Quitar precio especial' })).getByRole('button', { name: 'Quitar' }))
    await waitFor(() => expect(calls.some((call) => call.method === 'DELETE' && call.url === '/price-lists/2/items/11')).toBe(true))
  })
})

describe('la lista en el cliente', () => {
  const CUSTOMER = { id: 4, name: 'Granja Los Naranjos', documentType: null, documentNumber: null, phone: '3126667788', email: null, address: null, location: null, birthDate: null, age: null, daysToBirthday: null, creditLimit: null, creditBalance: '0.00', priceList: null, notes: null, isSystem: false, isActive: true, balance: '0.00', overdueBalance: '0.00', openReceivables: 0, availableCredit: null, isOverCreditLimit: false }

  it('quien administra listas la escoge al registrar el cliente', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ ...baseRoutes(), 'GET /customers': page([]), 'GET /receivables/summary': ok({ balance: '0', overdue: '0', dueThisWeek: '0', customersWithDebt: 0, customersOverdue: 0 }), 'POST /customers': (call) => ok({ ...CUSTOMER, ...call.data, priceList: MAYORISTA }), 'GET /customers/4': ok({ ...CUSTOMER, priceList: MAYORISTA }), 'GET /customers/4/statement': ok({ customer: CUSTOMER, entries: [] }), 'GET /receivables': page([]), 'GET /customer-payments': page([]), 'GET /layaways': page([]) })
    renderApp('/clientes')

    await user.click(await screen.findByRole('button', { name: 'Nuevo cliente' }))
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo cliente' })
    await user.type(within(dialog).getByLabelText(/^Nombre/), 'Granja Los Naranjos')
    await user.selectOptions(await within(dialog).findByLabelText('Lista de precios'), 'Mayorista · 8 % menos')
    await user.click(within(dialog).getByRole('button', { name: 'Registrar cliente' }))

    expect(calls.find((call) => call.method === 'POST' && call.url === '/customers').data).toMatchObject({ name: 'Granja Los Naranjos', priceListId: 2 })
    expect(await screen.findByText('Mayorista · 8 % menos')).toBeInTheDocument()
  })

  it('sin el permiso de listas no aparece el campo ni se manda', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ ...baseRoutes(['customers.view', 'customers.manage']), 'GET /customers': page([]), 'GET /receivables/summary': ok({}), 'POST /customers': (call) => ok({ ...CUSTOMER, ...call.data }), 'GET /customers/4': ok(CUSTOMER), 'GET /customers/4/statement': ok({ customer: CUSTOMER, entries: [] }), 'GET /receivables': page([]), 'GET /customer-payments': page([]), 'GET /layaways': page([]) })
    renderApp('/clientes')
    await user.click(await screen.findByRole('button', { name: 'Nuevo cliente' }))
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo cliente' })
    expect(within(dialog).queryByLabelText('Lista de precios')).not.toBeInTheDocument()
    await user.type(within(dialog).getByLabelText(/^Nombre/), 'Pedro')
    await user.click(within(dialog).getByRole('button', { name: 'Registrar cliente' }))
    await waitFor(() => expect(calls.find((call) => call.method === 'POST')).toBeDefined())
    expect(calls.find((call) => call.method === 'POST').data).not.toHaveProperty('priceListId')
    expect(calls.some((call) => call.url === '/price-lists')).toBe(false)
  })
})

describe('la lista en el punto de venta', () => {
  const FEED = { id: 5, code: 'P-00005', name: 'Concentrado cerdos', unit: { id: 2, name: 'Kilogramo', symbol: 'kg', allowsDecimals: true }, salePrice: '2200.00', regularSalePrice: '2345.00', taxRate: 'excluded', barcode: null, stock: '400.000', tracksBatches: false, expiredSalePolicy: 'authorization', presentations: [], matchedPresentationId: null }
  const SESSION = { id: 9, register: { id: 1, name: 'Mostrador' }, openedAt: '2026-11-17T12:00:00.000Z', status: 'open' }
  const TOTALS = { subtotal: '2200.00', lineDiscountTotal: '0.00', globalDiscount: '0.00', discountTotal: '0.00', discountPercent: '0.00', taxBase: '2200.00', taxTotal: '0.00', totalBeforeRounding: '2200.00', roundingAdjustment: '0.00', total: '2200.00' }
  const GRANJA = { id: 4, name: 'Granja Los Naranjos', phone: '3126667788', documentNumber: null, balance: '0.00', creditBalance: '0.00', priceList: MAYORISTA }
  const posRoutes = (permissions) => ({
    ...baseRoutes(permissions),
    'GET /payment-methods': ok([{ id: 1, name: 'Efectivo', isCash: true, requiresReference: false, isActive: true }]),
    'GET /cash-sessions': page([SESSION]),
    'GET /customers': page([GRANJA]),
    'GET /sales/catalog': ok([FEED]),
    'POST /sales/preview': (call) =>
      ok({ totals: TOTALS, priceList: call.data.customerId || call.data.priceListId ? { id: 2, name: 'Mayorista', discountPercent: '8.00' } : null, lines: [{ productId: 5, presentationId: null, unitPrice: '2200.00', regularUnitPrice: '2345.00', gross: '2200.00', lineDiscount: '0.00', total: '2200.00' }], requires: { discount: false, expired: false }, warnings: { belowCost: [], expired: [] }, taxEnabled: false }),
  })

  it('al escoger el cliente, el buscador y la vista previa usan su lista y el carrito muestra el precio normal tachado', async () => {
    const user = userEvent.setup()
    const calls = mockApi(posRoutes(['sales.create', 'cash.view', 'customers.view']))
    renderApp('/ventas/punto-de-venta')

    await user.type(await screen.findByLabelText('Cliente'), 'Granja')
    await user.click(await screen.findByRole('button', { name: /Granja Los Naranjos/ }))
    expect(await screen.findByText('Mayorista · 8 % menos')).toBeInTheDocument()

    await user.type(screen.getByRole('searchbox', { name: /Escanea o busca/ }), 'concen')
    await waitFor(() => expect(calls.some((call) => call.url === '/sales/catalog' && call.params?.customerId === 4)).toBe(true))
    await user.click(await screen.findByRole('button', { name: /Concentrado cerdos/ }))

    await waitFor(() => expect(calls.some((call) => call.url === '/sales/preview' && call.data.customerId === 4)).toBe(true))
    expect(await screen.findByText('$ 2.345')).toBeInTheDocument()
    // Sin permiso de cambiarla, no hay selector ni se consulta el catálogo de listas
    expect(screen.queryByRole('combobox', { name: 'Lista de precios de la venta' })).not.toBeInTheDocument()
    expect(calls.some((call) => call.url === '/price-lists')).toBe(false)
  })

  it('con permiso, el cajero escoge otra lista y la venta la manda', async () => {
    const user = userEvent.setup()
    const calls = mockApi(posRoutes(['sales.create', 'cash.view', 'customers.view', 'sales.change_price_list']))
    renderApp('/ventas/punto-de-venta')

    const select = await screen.findByRole('combobox', { name: 'Lista de precios de la venta' })
    await user.selectOptions(select, 'Mayorista · 8 % menos')
    expect(screen.getByText('Cambiaste la lista del cliente: queda registrado en la venta.')).toBeInTheDocument()
    await user.type(screen.getByRole('searchbox', { name: /Escanea o busca/ }), 'concen')
    await waitFor(() => expect(calls.some((call) => call.url === '/sales/catalog' && call.params?.priceListId === 2)).toBe(true))
    await user.click(await screen.findByRole('button', { name: /Concentrado cerdos/ }))
    await waitFor(() => expect(calls.some((call) => call.url === '/sales/preview' && call.data.priceListId === 2)).toBe(true))
  })
})
