// Conductores (D-FLE-1; antes coteros) con el backend simulado: registrar un conductor con su flete
// propuesto, ver sus fletes, y agregar el flete en el punto de venta.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '../../test/renderWithProviders'
import { BASIC_PLAN, buildUser, healthyResponse, mockApi, ok, restoreApi, session } from '../../test/mockApi'

const PLAN = { ...BASIC_PLAN, features: [...BASIC_PLAN.features, 'sales', 'cash', 'customers'] }
const ALL = ['porters.view', 'porters.manage', 'porters.trips', 'sales.create', 'sales.credit', 'cash.view', 'customers.view']
const METHODS = [
  { id: 1, name: 'Efectivo', isCash: true, requiresReference: false, isActive: true },
  { id: 2, name: 'Nequi', isCash: false, requiresReference: true, isActive: true },
]
const SESSION = { id: 9, register: { id: 1, name: 'Mostrador' }, openedAt: '2026-11-17T12:00:00.000Z', status: 'open' }
const JAIRO = { id: 3, name: 'Don Jairo', documentNumber: null, phone: '3001112233', tripRate: '10000.00', notes: null, isActive: true, freights: 2, freightTotal: '18000.00' }
const DETAIL = {
  ...JAIRO,
  freightSales: [
    { id: 31, number: 'V-000031', createdAt: '2026-11-22T15:00:00.000Z', amount: '10000.00', saleType: 'credit', status: 'completed', total: '110000.00', customerName: 'Granja Los Naranjos' },
    { id: 28, number: 'V-000028', createdAt: '2026-11-20T15:00:00.000Z', amount: '8000.00', saleType: 'cash', status: 'cancelled', total: '108000.00', customerName: null },
  ],
}
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
const totalsWith = (freight) => ({ subtotal: '100000.00', lineDiscountTotal: '0.00', globalDiscount: '0.00', discountTotal: '0.00', discountPercent: '0.00', taxBase: '100000.00', taxTotal: '0.00', totalBeforeRounding: '100000.00', roundingAdjustment: '0.00', productsTotal: '100000.00', freight, total: String(100000 + Number(freight)) + '.00' })

const page = (rows) => ({ status: 200, body: { success: true, data: rows, meta: { page: 1, pageSize: 20, total: rows.length, totalPages: 1 }, message: 'ok' } })

const baseRoutes = (permissions = ALL) => ({
  'GET /auth/me': session(buildUser({ permissions }), PLAN),
  'GET /health': healthyResponse,
  'GET /notifications/unread-count': ok({ unread: 0 }),
  'GET /notifications': page([]),
  'GET /branding': ok({ name: 'Agro El Campo', logo: null }),
  'GET /me/preferences': ok({ theme: 'system' }),
  'GET /payment-methods': ok(METHODS),
  'GET /cash-sessions': page([SESSION]),
  'GET /porters': ok([JAIRO]),
  'GET /porters/3': ok(DETAIL),
  'GET /sales/catalog': ok([FEED]),
  'GET /customers': page([]),
  'POST /sales/preview': (call) => ok({ totals: totalsWith(call.data.freight ? `${call.data.freight.amount}.00` : '0.00'), lines: [{ productId: 5, presentationId: 3, gross: '100000.00', lineDiscount: '0.00', total: '100000.00' }], requires: { discount: false, expired: false }, warnings: { belowCost: [], expired: [] }, taxEnabled: false }),
})

beforeEach(() => window.localStorage.clear())
afterEach(() => restoreApi())

describe('Conductores', () => {
  it('lista los conductores con sus fletes y «Nuevo conductor» lo registra con su flete propuesto', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ ...baseRoutes(), 'POST /porters': (call) => ok({ ...JAIRO, ...call.data, id: 3 }) })
    renderApp('/ventas/conductores')

    const row = (await screen.findByText('Don Jairo')).closest('tr')
    expect(within(row).getByText('$ 10.000')).toBeInTheDocument()
    expect(within(row).getByText('$ 18.000')).toBeInTheDocument()
    expect(calls.find((call) => call.url === '/porters').params).toEqual({ isActive: 'true' })
    expect(screen.getByRole('link', { name: 'Conductores' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Coteros' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Nuevo conductor' }))
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo conductor' })
    await user.click(within(dialog).getByRole('button', { name: 'Registrar conductor' }))
    expect(within(dialog).getByText('Escribe el nombre del conductor')).toBeInTheDocument()
    await user.type(within(dialog).getByLabelText(/^Nombre/), 'Don Jairo')
    await user.type(within(dialog).getByLabelText(/^Celular/), '3001112233')
    await user.type(within(dialog).getByLabelText(/^Flete que se propone/), '10.000')
    await user.click(within(dialog).getByRole('button', { name: 'Registrar conductor' }))
    await waitFor(() => expect(calls.find((call) => call.method === 'POST' && call.url === '/porters')?.data).toEqual({ name: 'Don Jairo', documentNumber: null, phone: '3001112233', tripRate: '10000', notes: null }))
  })

  it('la ficha muestra los fletes que ha llevado, con la venta anulada marcada', async () => {
    mockApi(baseRoutes())
    renderApp('/ventas/conductores/3')
    expect(await screen.findByRole('heading', { name: 'Don Jairo' })).toBeInTheDocument()
    expect(screen.getByText('Venta V-000031')).toBeInTheDocument()
    expect(screen.getByText('Granja Los Naranjos · Fiado')).toBeInTheDocument()
    expect(screen.getByText('Venta anulada')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Anotar viaje|Pagar/ })).not.toBeInTheDocument()
  })
})

describe('Flete en el punto de venta', () => {
  it('«Agregar flete» propone la tarifa del conductor, suma al total y va en la venta', async () => {
    const user = userEvent.setup()
    const calls = mockApi(baseRoutes())
    renderApp('/ventas/punto-de-venta')

    await user.type(await screen.findByLabelText('Escanea o busca el producto'), '7700000000028{Enter}')
    expect(await screen.findByText('Concentrado cerdos')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Agregar flete' }))
    await user.selectOptions(await screen.findByRole('combobox', { name: 'Conductor del flete' }), 'Don Jairo')
    expect(screen.getByLabelText('Valor del flete')).toHaveValue('10.000')

    await waitFor(() => expect(calls.filter((call) => call.url === '/sales/preview').at(-1).data).toMatchObject({ freight: { porterId: 3, amount: '10000' } }))
    expect(await screen.findByText('Flete (va al conductor)')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Quitar el flete' }))
    await waitFor(() => expect(calls.filter((call) => call.url === '/sales/preview').at(-1).data.freight).toBeUndefined())
  })

  it('si el conductor no existe, «Nuevo conductor» lo registra y queda escogido con su flete', async () => {
    const user = userEvent.setup()
    let drivers = [JAIRO]
    const PEDRO = { ...JAIRO, id: 7, name: 'Pedro (carro de La Luisa)', tripRate: '8000.00', freights: 0, freightTotal: '0.00' }
    const calls = mockApi({
      ...baseRoutes(),
      // Una lista nueva en cada respuesta: la anterior queda congelada en el estado de la aplicación
      'GET /porters': () => ok([...drivers]),
      'POST /porters': () => {
        drivers = [...drivers, PEDRO]
        return ok(PEDRO)
      },
    })
    renderApp('/ventas/punto-de-venta')
    await scanFeed()
    await user.click(screen.getByRole('button', { name: 'Agregar flete' }))
    await user.click(await screen.findByRole('button', { name: 'Nuevo conductor' }))
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo conductor' })
    await user.type(within(dialog).getByLabelText(/^Nombre/), 'Pedro (carro de La Luisa)')
    await user.type(within(dialog).getByLabelText(/^Flete que se propone/), '8.000')
    await user.click(within(dialog).getByRole('button', { name: 'Registrar conductor' }))

    await waitFor(() => expect(calls.some((call) => call.method === 'POST' && call.url === '/porters')).toBe(true))
    expect(await screen.findByText('Pedro (carro de La Luisa) quedó registrado')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Conductor del flete' })).toHaveValue('7'))
    expect(screen.getByLabelText('Valor del flete')).toHaveValue('8.000')
    await waitFor(() => expect(calls.filter((call) => call.url === '/sales/preview').at(-1).data).toMatchObject({ freight: { porterId: 7, amount: '8000' } }))
  })

  it('sin permiso de registrar conductores no aparece «Nuevo conductor»', async () => {
    const user = userEvent.setup()
    mockApi(baseRoutes(['porters.trips', 'sales.create', 'cash.view', 'customers.view']))
    renderApp('/ventas/punto-de-venta')
    await scanFeed()
    await user.click(screen.getByRole('button', { name: 'Agregar flete' }))
    expect(await screen.findByRole('combobox', { name: 'Conductor del flete' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nuevo conductor' })).not.toBeInTheDocument()
  })

  it('sin el permiso no aparece «Agregar flete»', async () => {
    mockApi(baseRoutes(['sales.create', 'cash.view', 'customers.view']))
    renderApp('/ventas/punto-de-venta')
    await scanFeed()
    expect(screen.queryByRole('button', { name: 'Agregar flete' })).not.toBeInTheDocument()
  })
})

async function scanFeed() {
  const user = userEvent.setup()
  await user.type(await screen.findByLabelText('Escanea o busca el producto'), '7700000000028{Enter}')
  expect(await screen.findByText('Concentrado cerdos')).toBeInTheDocument()
}
