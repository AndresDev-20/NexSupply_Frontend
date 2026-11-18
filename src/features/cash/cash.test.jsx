// Caja (rediseño D-CAJA-9 a D-CAJA-13): Mis cajas de hoy, Turnos, Historial y Cajas,
// con el ciclo abrir → cerrar turno → contar → recibir. Backend simulado.
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '../../test/renderWithProviders'
import { BASIC_PLAN, buildUser, fail, healthyResponse, mockApi, ok, restoreApi, session as authSession } from '../../test/mockApi'
import { previewSubtract } from '../../utils/moneyPreview'
import { differenceInfo } from './cashOptions'

const CASHIER = ['cash.view', 'cash.open', 'cash.close', 'cash.movements']
const ALL = [...CASHIER, 'cash.manage', 'cash.close_others', 'cash.receive']

const REGISTER = { id: 1, branchId: 1, name: 'Caja principal', openingTime: '07:00', closingTime: '18:00', automatic: false, baseAmount: '200000.00', isActive: true, currentSession: null }

function buildSession(overrides = {}) {
  return {
    id: 8,
    register: { id: 1, name: 'Caja principal', openingTime: '07:00', closingTime: '18:00', baseAmount: '200000.00' },
    status: 'open',
    statusLabel: 'Abierta',
    isOverdue: false,
    openedAt: '2026-11-16T12:00:00.000Z',
    openedBy: { id: 1, fullName: 'Robinson Barrios' },
    autoOpened: false,
    openingExpected: '200000.00',
    openingCounted: '200000.00',
    openingDifference: '0.00',
    openingNotes: null,
    needsOpeningConfirmation: false,
    responsibleId: 1,
    cutAt: null,
    cutBy: null,
    autoCut: false,
    closingNumber: null,
    closedAt: null,
    closedBy: null,
    expectedCash: '850000.00',
    countedCash: null,
    difference: null,
    differenceNotes: null,
    baseLeft: null,
    cashWithdrawn: null,
    closedOnBehalfReason: null,
    receivedBy: null,
    receivedAt: null,
    receivedNotes: null,
    summary: {
      openingCash: '200000.00',
      cashIn: '650000.00',
      cashOut: '0.00',
      expectedCash: '850000.00',
      byType: [],
      byPaymentMethod: [{ paymentMethodId: 1, name: 'Efectivo', isCash: true, count: 3, total: '650000.00' }],
      movementCount: 3,
    },
    ...overrides,
  }
}

const COUNTED = buildSession({ status: 'counted', statusLabel: 'Contada', closingNumber: 'CJ-000004', closedAt: '2026-11-16T23:00:00.000Z', closedBy: { id: 1, fullName: 'Robinson Barrios' }, countedCash: '848000.00', difference: '-2000.00', differenceNotes: 'Cambio mal dado', baseLeft: '200000.00', cashWithdrawn: '648000.00', cutAt: '2026-11-16T22:50:00.000Z' })

const page = (rows) => ({ status: 200, body: { success: true, data: rows, meta: { page: 1, pageSize: 20, total: rows.length, totalPages: 1 }, message: 'ok' } })

const baseRoutes = (permissions = ALL, plan = BASIC_PLAN) => ({
  'GET /auth/me': authSession(buildUser({ permissions }), plan),
  'GET /health': healthyResponse,
  'GET /notifications/unread-count': ok({ unread: 0 }),
  'GET /branding': ok({ name: 'Agro El Campo', logo: null }),
  'GET /me/preferences': ok({ theme: 'system' }),
  'GET /cash-registers': ok([REGISTER]),
  'GET /cash-closed-days': ok([]),
  'GET /cash-sessions': page([]),
})

const sessionRoutes = (data = buildSession()) => ({
  [`GET /cash-sessions/${data.id}`]: ok(data),
  [`GET /cash-sessions/${data.id}/movements`]: page([]),
})

const withSession = (status = 'open') => ({ ...REGISTER, currentSession: { id: 8, status, openedAt: '2026-11-16T12:00:00.000Z', openedBy: { id: 1, fullName: 'Robinson Barrios' }, autoOpened: false, needsOpeningConfirmation: false, isOverdue: false } })

afterEach(() => restoreApi())

describe('vista previa de dinero', () => {
  it('resta con enteros y describe la diferencia del conteo', () => {
    expect(previewSubtract('0.3', '0.1')).toBe('0.20')
    expect(previewSubtract('848000', '850000.00')).toBe('-2000.00')
    expect(differenceInfo('-1500.00')).toMatchObject({ label: 'Faltante', tone: 'danger', amount: '$ 1.500' })
    expect(differenceInfo('0.00')).toMatchObject({ label: 'Cuadrada', tone: 'success' })
  })
})

describe('menú y acceso', () => {
  it('muestra las secciones de caja según los permisos', async () => {
    mockApi(baseRoutes(['cash.view']))
    renderApp('/caja')
    expect(await screen.findByRole('heading', { name: 'Caja principal' })).toBeInTheDocument()
    for (const name of ['Mis cajas de hoy', 'Turnos', 'Historial de caja']) expect(screen.getByRole('link', { name })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Cajas' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Abrir turno' })).not.toBeInTheDocument()
  })

  it('fuera del plan, la caja no se abre por la URL', async () => {
    mockApi(baseRoutes(ALL, { ...BASIC_PLAN, features: BASIC_PLAN.features.filter((feature) => feature !== 'cash') }))
    renderApp('/caja')
    expect(await screen.findByText('No incluido en tu plan')).toBeInTheDocument()
  })
})

describe('mis cajas de hoy', () => {
  it('abre el turno con la base fija; si hoy es día sin abrir, pide confirmar', async () => {
    const user = userEvent.setup()
    const calls = mockApi({
      ...baseRoutes(),
      'GET /cash-registers/1/open': ok(null),
      'POST /cash-registers/1/open': (call) => (call.data.confirmClosedDay ? ok(buildSession()) : fail(409, 'CONFIRMATION_REQUIRED', 'Hoy está marcado como día sin abrir (Festivo). ¿Abrir la caja de todas formas?')),
      ...sessionRoutes(),
    })
    renderApp('/caja')

    expect(await screen.findByText('$ 200.000')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Abrir turno' }))
    const dialog = await screen.findByRole('dialog', { name: 'Abrir turno' })
    expect(within(dialog).getByText('La base fija con que arranca la caja cada día')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Está completa' }))
    expect(within(dialog).getByLabelText(/^Efectivo en la caja/)).toHaveValue('200.000')
    await user.click(within(dialog).getByRole('button', { name: 'Abrir turno' }))

    expect(await within(dialog).findByText(/día sin abrir \(Festivo\)/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Abrir de todas formas' }))
    expect(await screen.findByText('Turno abierto en Caja principal')).toBeInTheDocument()
    expect(calls.filter((call) => call.method === 'POST').map((call) => call.data)).toEqual([
      { countedCash: '200000', notes: null },
      { countedCash: '200000', notes: null, confirmClosedDay: true },
    ])
  })

  it('una caja abierta muestra el efectivo y permite cerrar el turno en cualquier momento', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ ...baseRoutes(), 'GET /cash-registers': ok([withSession('open')]), ...sessionRoutes(), 'POST /cash-sessions/8/cut': ok(buildSession({ status: 'pending_count' })) })
    renderApp('/caja')

    expect(await screen.findByText('$ 850.000')).toBeInTheDocument()
    expect(screen.getByLabelText('Avance del turno')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cerrar turno de Caja principal' }))
    const confirm = await screen.findByRole('dialog', { name: 'Cerrar turno' })
    await user.click(within(confirm).getByRole('button', { name: 'Cerrar turno' }))
    expect(await screen.findByText('Caja principal: turno cerrado. Falta contar la caja')).toBeInTheDocument()
    expect(calls.some((call) => call.method === 'POST' && call.url === '/cash-sessions/8/cut')).toBe(true)
  })

  it('el día sin abrir de hoy se avisa arriba', async () => {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())
    mockApi({ ...baseRoutes(), 'GET /cash-closed-days': ok([{ id: 1, date: today, reason: 'Festivo de Reyes' }]) })
    renderApp('/caja')
    expect(await screen.findByText(/Festivo de Reyes/)).toBeInTheDocument()
  })

  it('los turnos contados se pueden recibir', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ ...baseRoutes(), 'GET /cash-sessions': page([COUNTED]), 'POST /cash-sessions/8/receive': ok({ ...COUNTED, status: 'received' }) })
    renderApp('/caja')

    expect(await screen.findByText('Turnos contados por recibir')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Recibir' }))
    const dialog = await screen.findByRole('dialog', { name: 'Recibir el dinero' })
    expect(within(dialog).getByText('$ 648.000')).toBeInTheDocument()
    expect(within(dialog).getByText(/Faltante de \$ 2.000/)).toBeInTheDocument()
    await user.type(within(dialog).getByLabelText(/^Nota/), 'Consignado')
    await user.click(within(dialog).getByRole('button', { name: 'Marcar como recibido' }))
    expect(await screen.findByText('Dinero recibido')).toBeInTheDocument()
    expect(calls.find((call) => call.url === '/cash-sessions/8/receive').data).toEqual({ notes: 'Consignado' })
  })
})

describe('contar la caja', () => {
  it('muestra la base que se queda y lo que se entrega; una diferencia exige nota; confirma antes de contar', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ ...baseRoutes(), ...sessionRoutes(buildSession({ status: 'pending_count', cutAt: '2026-11-16T22:50:00.000Z' })), 'POST /cash-sessions/8/count': ok(COUNTED) })
    renderApp('/caja/turnos/8')

    await user.click(await screen.findByRole('button', { name: 'Contar caja' }))
    const dialog = await screen.findByRole('dialog', { name: 'Contar la caja' })
    await user.type(within(dialog).getByLabelText(/^Efectivo contado/), '848.000')
    expect(within(dialog).getByRole('status')).toHaveTextContent('Faltante de $ 2.000')
    expect(within(dialog).getByText('$ 648.000')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Revisar' }))
    expect(within(dialog).getByText('Lo contado no coincide con lo esperado: explica qué pasó')).toBeInTheDocument()

    await user.type(within(dialog).getByLabelText(/^¿Qué pasó\?/), 'Cambio mal dado')
    await user.click(within(dialog).getByRole('button', { name: 'Revisar' }))
    const confirm = await screen.findByRole('dialog', { name: 'Confirmar el conteo' })
    expect(within(confirm).getByLabelText('Resumen del conteo')).toHaveTextContent('Para entregar$ 648.000')
    await user.click(within(confirm).getByRole('button', { name: 'Confirmar conteo' }))

    expect(await screen.findByText('Caja contada (CJ-000004). Para entregar: $ 648.000')).toBeInTheDocument()
    expect(calls.find((call) => call.url === '/cash-sessions/8/count').data).toEqual({ countedCash: '848000', differenceNotes: 'Cambio mal dado', onBehalfReason: null })
  })

  it('un turno contado muestra su arqueo y no permite movimientos', async () => {
    mockApi({ ...baseRoutes(), ...sessionRoutes(COUNTED) })
    renderApp('/caja/turnos/8')
    expect(await screen.findByRole('heading', { name: 'Arqueo CJ-000004' })).toBeInTheDocument()
    expect(screen.getByText('Cambio mal dado')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Recibir dinero' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Retiro' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Contar caja' })).not.toBeInTheDocument()
  })

  it('sin permiso para turnos de otros, no aparecen cerrar ni contar', async () => {
    mockApi({ ...baseRoutes(CASHIER), ...sessionRoutes(buildSession({ responsibleId: 2, openedBy: { id: 2, fullName: 'Luisa Cajera' } })) })
    renderApp('/caja/turnos/8')
    expect(await screen.findByText(/Solo esa persona, o alguien con permiso para cerrar turnos de otros/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Contar caja' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cerrar turno' })).not.toBeInTheDocument()
  })
})

describe('turnos e historial', () => {
  it('la lista de turnos filtra por estado y ofrece ver y contar', async () => {
    const user = userEvent.setup()
    const pending = buildSession({ status: 'pending_count' })
    const calls = mockApi({ ...baseRoutes(), 'GET /cash-sessions': page([pending]) })
    renderApp('/caja/turnos')

    expect(await screen.findByRole('button', { name: 'Ver turno de Caja principal' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Contar caja de Caja principal' })).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Por contar' }))
    expect(calls.filter((call) => call.url === '/cash-sessions').at(-1).params).toMatchObject({ status: 'pending_count', page: 1 })
  })

  it('el historial muestra el cuadre por periodo y cambia de agrupación', async () => {
    const user = userEvent.setup()
    const row = { period: '2026-11-02', sessions: 2, received: 1, cashIn: '100000.00', cashOut: '0.00', expectedCash: '500000.00', countedCash: '498000.00', difference: '-2000.00', toDeliver: '98000.00', byPaymentMethod: [{ name: 'Efectivo', isCash: true, total: '100000.00' }] }
    const calls = mockApi({ ...baseRoutes(), 'GET /cash-sessions/history': (call) => ok({ groupBy: call.params.groupBy, from: '2026-10-18', to: '2026-11-16', rows: [{ ...row, period: call.params.groupBy === 'month' ? '2026-11' : row.period }], totals: { ...row, period: 'total' } }) })
    renderApp('/caja/historial')

    expect(await screen.findByText(/2 de noviembre/)).toBeInTheDocument()
    expect(screen.getByText('1 por recibir', { exact: false })).toBeInTheDocument()
    expect(screen.getAllByText('$ 498.000').length).toBeGreaterThan(0)
    await user.click(screen.getByRole('tab', { name: 'Por mes' }))
    expect(await screen.findByText(/noviembre de 2026/)).toBeInTheDocument()
    expect(calls.filter((call) => call.url === '/cash-sessions/history').at(-1).params).toMatchObject({ groupBy: 'month' })
  })
})

describe('cajas', () => {
  it('crea una caja con base del día y lo automático exige las dos horas', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ ...baseRoutes(), 'POST /cash-registers': (call) => ok({ ...REGISTER, id: 2, ...call.data, baseAmount: '150000.00' }) })
    renderApp('/caja/cajas')

    await user.click(await screen.findByRole('button', { name: 'Nueva caja' }))
    const dialog = await screen.findByRole('dialog', { name: 'Nueva caja' })
    await user.type(within(dialog).getByLabelText(/^Nombre/), 'Caja 2')
    await user.type(within(dialog).getByLabelText(/^Base del día/), '150.000')
    await user.click(within(dialog).getByRole('switch', { name: 'Automática' }))
    await user.click(within(dialog).getByRole('button', { name: 'Crear caja' }))
    expect(within(dialog).getByText('Para abrirse sola necesita la hora de apertura')).toBeInTheDocument()

    await user.type(within(dialog).getByLabelText('Hora de apertura'), '07:00')
    await user.type(within(dialog).getByLabelText('Hora de cierre'), '18:00')
    await user.click(within(dialog).getByRole('button', { name: 'Crear caja' }))
    expect(await screen.findByText('Caja 2 creada')).toBeInTheDocument()
    expect(calls.find((call) => call.method === 'POST').data).toEqual({ name: 'Caja 2', baseAmount: '150000', openingTime: '07:00', closingTime: '18:00', automatic: true })
  })

  it('marca y quita días sin abrir', async () => {
    const user = userEvent.setup()
    let days = []
    const calls = mockApi({
      ...baseRoutes(),
      'GET /cash-closed-days': () => ok(days),
      'POST /cash-closed-days': (call) => {
        days = [{ id: 5, ...call.data }]
        return ok(days[0])
      },
      'DELETE /cash-closed-days/5': () => {
        days = []
        return ok(null)
      },
    })
    renderApp('/caja/cajas')

    await screen.findByText('No hay días sin abrir marcados.')
    await user.click(screen.getByRole('button', { name: 'Marcar día' }))
    expect(screen.getByText('Elige el día')).toBeInTheDocument()

    await user.type(screen.getByLabelText(/^Día$/), '2030-01-06')
    await user.type(screen.getByLabelText(/^Motivo/), 'Festivo de Reyes')
    await user.click(screen.getByRole('button', { name: 'Marcar día' }))
    expect(await screen.findByText('Día sin abrir guardado')).toBeInTheDocument()
    expect(await screen.findByText('Festivo de Reyes')).toBeInTheDocument()
    expect(calls.find((call) => call.method === 'POST').data).toEqual({ date: '2030-01-06', reason: 'Festivo de Reyes' })

    await user.click(screen.getByRole('button', { name: 'Quitar Festivo de Reyes (2030-01-06)' }))
    expect(await screen.findByText('Día sin abrir quitado')).toBeInTheDocument()
  })
})
