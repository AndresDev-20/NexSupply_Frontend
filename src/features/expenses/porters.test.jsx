// Coteros (D-CTR-1) con el backend simulado: registrar un cotero, anotar viajes, pagarle y
// anular un viaje con su motivo.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '../../test/renderWithProviders'
import { BASIC_PLAN, buildUser, healthyResponse, mockApi, ok, restoreApi, session } from '../../test/mockApi'

const PLAN = { ...BASIC_PLAN, features: [...BASIC_PLAN.features, 'expenses', 'cash'] }
const ALL = ['porters.view', 'porters.manage', 'porters.trips', 'porters.pay', 'cash.view']
const METHODS = [
  { id: 1, name: 'Efectivo', isCash: true, requiresReference: false, isActive: true },
  { id: 2, name: 'Nequi', isCash: false, requiresReference: true, isActive: true },
]
const SESSION = { id: 9, register: { id: 1, name: 'Mostrador' }, openedAt: '2026-11-17T12:00:00.000Z', status: 'open' }
const JOSE = { id: 3, name: 'José Pérez', documentNumber: null, phone: '3001112233', tripRate: '3000.00', notes: null, isActive: true, pendingTrips: 2, pendingAmount: '6000.00' }
const trip = (id, tripDate, extra = {}) => ({ id, tripDate, description: null, amount: '3000.00', status: 'pending', sale: null, paymentId: null, createdBy: null, cancelledBy: null, cancelReason: null, createdAt: `${tripDate}T15:00:00.000Z`, ...extra })
const DETAIL = {
  ...JOSE,
  trips: [trip(11, '2026-11-22', { sale: { id: 31, number: 'V-000031', customerName: 'Granja Los Naranjos' } }), trip(12, '2026-11-21', { description: '4 bultos a El Tambo' }), trip(10, '2026-11-15', { status: 'paid', paymentId: 1 })],
  payments: [{ id: 1, amount: '3000.00', tripsCount: 1, expenseId: 40, createdBy: null, createdAt: '2026-11-16T15:00:00.000Z' }],
}

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
  'GET /porters': ok([JOSE]),
  'GET /porters/3': ok(DETAIL),
})

beforeEach(() => window.localStorage.clear())
afterEach(() => restoreApi())

describe('Coteros', () => {
  it('muestra lo que se les debe y «Nuevo cotero» lo registra con su valor por viaje', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ ...baseRoutes(), 'POST /porters': (call) => ok({ ...JOSE, ...call.data, id: 3 }) })
    renderApp('/gastos/coteros')

    const row = (await screen.findByText('José Pérez')).closest('tr')
    expect(within(row).getByText('$ 3.000')).toBeInTheDocument()
    expect(within(row).getByText('$ 6.000')).toBeInTheDocument()
    expect(calls.find((call) => call.url === '/porters').params).toEqual({ isActive: 'true' })

    await user.click(screen.getByRole('button', { name: 'Nuevo cotero' }))
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo cotero' })
    await user.click(within(dialog).getByRole('button', { name: 'Registrar cotero' }))
    expect(within(dialog).getByText('Escribe el nombre del cotero')).toBeInTheDocument()
    await user.type(within(dialog).getByLabelText(/^Nombre/), 'José Pérez')
    await user.type(within(dialog).getByLabelText(/^Celular/), '3001112233')
    await user.type(within(dialog).getByLabelText(/^Valor por viaje/), '3.000')
    await user.click(within(dialog).getByRole('button', { name: 'Registrar cotero' }))

    expect(await screen.findByText('José Pérez quedó registrado')).toBeInTheDocument()
    expect(calls.find((call) => call.method === 'POST').data).toEqual({ name: 'José Pérez', documentNumber: null, phone: '3001112233', tripRate: '3000', notes: null })
    expect(await screen.findByRole('heading', { name: 'José Pérez' })).toBeInTheDocument()
  })

  it('en la ficha anota un viaje con el valor propuesto', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ ...baseRoutes(), 'POST /porters/3/trips': { status: 200, body: { success: true, data: trip(13, '2026-11-23'), message: 'Viaje anotado a José Pérez' } } })
    renderApp('/gastos/coteros/3')

    expect(await screen.findByRole('heading', { name: 'José Pérez' })).toBeInTheDocument()
    const fromSale = screen.getByText('Venta V-000031 · Granja Los Naranjos').closest('tr')
    expect(within(fromSale).getByText('Sin pagar')).toBeInTheDocument()
    expect(screen.getByText('Pagado')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Anotar viaje' }))
    const dialog = await screen.findByRole('dialog', { name: 'Anotar viaje al carro de línea' })
    expect(within(dialog).getByLabelText(/^Valor del viaje/)).toHaveValue('3.000')
    await user.type(within(dialog).getByLabelText(/^Detalle/), '2 bultos a El Tambo')
    await user.click(within(dialog).getByRole('button', { name: 'Anotar viaje' }))

    expect(await screen.findByText('Viaje anotado a José Pérez')).toBeInTheDocument()
    expect(calls.find((call) => call.method === 'POST').data).toEqual({ amount: '3000', description: '2 bultos a El Tambo' })
  })

  it('pagarle en efectivo sale del turno de caja abierto', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ ...baseRoutes(), 'POST /porters/3/payments': { status: 200, body: { success: true, data: { id: 2, amount: '6000.00', tripsCount: 2 }, message: 'Pago de $ 6.000 registrado' } } })
    renderApp('/gastos/coteros/3')

    await user.click(await screen.findByRole('button', { name: 'Pagar $ 6.000 (2 viajes)' }))
    const dialog = await screen.findByRole('dialog', { name: 'Pagarle a José Pérez' })
    await user.click(within(dialog).getByRole('button', { name: 'Pagar $ 6.000' }))
    expect(within(dialog).getByText('Escoge el método de pago')).toBeInTheDocument()

    await user.selectOptions(within(dialog).getByLabelText(/^Método de pago/), 'Efectivo')
    expect(await within(dialog).findByLabelText('Turno de caja')).toHaveValue('9')
    await user.click(within(dialog).getByRole('button', { name: 'Pagar $ 6.000' }))

    expect(await screen.findByText('Pago de $ 6.000 registrado')).toBeInTheDocument()
    expect(calls.find((call) => call.method === 'POST').data).toEqual({ idempotencyKey: expect.any(String), paymentMethodId: 1, fromCash: true, cashSessionId: 9 })
  })

  it('anular un viaje pide el motivo y lo manda', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ ...baseRoutes(), 'POST /porter-trips/12/cancel': ok({ ...trip(12, '2026-11-21'), status: 'cancelled' }) })
    renderApp('/gastos/coteros/3')

    await user.click(await screen.findByRole('button', { name: 'Anular el viaje del 21/11/2026' }))
    const dialog = await screen.findByRole('dialog', { name: 'Anular viaje' })
    await user.click(within(dialog).getByRole('button', { name: 'Anular viaje' }))
    expect(await screen.findByText('Escribe por qué se anula el viaje')).toBeInTheDocument()
    expect(calls.some((call) => call.method === 'POST')).toBe(false)

    // El diálogo sigue abierto para escribir el motivo
    await user.type(within(dialog).getByLabelText(/^Motivo/), 'Se anotó dos veces')
    await user.click(within(dialog).getByRole('button', { name: 'Anular viaje' }))

    expect(await screen.findByText('Viaje anulado')).toBeInTheDocument()
    await waitFor(() => expect(calls.find((call) => call.method === 'POST')).toMatchObject({ url: '/porter-trips/12/cancel', data: { reason: 'Se anotó dos veces' } }))
  })
})
