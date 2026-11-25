// Fase 9 — Clientes, cartera, abonos con recibo y avisos en el escritorio.
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '../../test/renderWithProviders'
import { BASIC_PLAN, buildUser, healthyResponse, mockApi, ok, restoreApi, session } from '../../test/mockApi'
import { reminderLink, whatsappNumber } from './customerOptions'
import { baseApi } from '../../api/baseApi'

const PLAN = { ...BASIC_PLAN, features: [...BASIC_PLAN.features, 'customers', 'cash'] }
const ALL = ['customers.view', 'customers.manage', 'receivables.view', 'receivables.create', 'receivables.collect', 'receivables.cancel_payment', 'cash.view', 'settings.update']
const METHODS = [
  { id: 1, name: 'Efectivo', isCash: true, requiresReference: false, isActive: true },
  { id: 2, name: 'Nequi', isCash: false, requiresReference: true, isActive: true },
]

function buildCustomer(overrides = {}) {
  return {
    id: 4,
    name: 'Pedro Gómez',
    documentType: 'CC',
    documentNumber: '1075234567',
    phone: '3001234567',
    email: null,
    address: null,
    location: 'Vereda El Tambo',
    birthDate: '1986-11-19',
    age: 39,
    daysToBirthday: 2,
    creditLimit: '500000.00',
    notes: null,
    isSystem: false,
    isActive: true,
    balance: '150000.00',
    overdueBalance: '50000.00',
    openReceivables: 2,
    availableCredit: '350000.00',
    isOverCreditLimit: false,
    ...overrides,
  }
}

const RECEIVABLE = {
  id: 7,
  number: 'CXC-000001',
  customer: { id: 4, name: 'Pedro Gómez', phone: '3001234567' },
  originType: 'opening_balance',
  originLabel: 'Saldo inicial',
  description: 'Cuaderno de fiados',
  paymentMode: 'installments',
  paymentModeLabel: 'En cuotas',
  issueDate: '2026-10-01',
  dueDate: '2026-12-01',
  total: '100000.00',
  amountPaid: '0.00',
  balance: '100000.00',
  status: 'open',
  statusLabel: 'Por cobrar',
  isOverdue: true,
  overdueAmount: '50000.00',
  nextDue: { dueDate: '2026-12-01', pending: '50000.00' },
  installmentsCount: 2,
  exceededCreditLimit: false,
  installments: [
    { id: 1, installmentNumber: 1, dueDate: '2026-11-01', amount: '50000.00', paidAmount: '0.00', pending: '50000.00', status: 'overdue', daysToDue: -16 },
    { id: 2, installmentNumber: 2, dueDate: '2026-12-01', amount: '50000.00', paidAmount: '0.00', pending: '50000.00', status: 'pending', daysToDue: 14 },
  ],
  payments: [],
}

const PAYMENT = {
  id: 9,
  number: 'AB-000001',
  status: 'active',
  customer: { id: 4, name: 'Pedro Gómez', phone: '3001234567', documentType: 'CC', documentNumber: '1075234567' },
  amount: '50000.00',
  paymentMethod: { id: 1, name: 'Efectivo' },
  isCash: true,
  paymentReference: null,
  cashSessionId: 3,
  paidAt: '2026-11-17T15:00:00.000Z',
  createdBy: { id: 1, fullName: 'Robinson Barrios' },
  allocations: [{ receivableId: 7, number: 'CXC-000001', description: 'Cuaderno de fiados', balanceNow: '50000.00', amount: '50000.00', installments: [{ installmentNumber: 1, dueDate: '2026-11-01', amount: '50000.00' }] }],
}

const SUMMARY = { balance: '150000.00', overdue: '50000.00', dueThisWeek: '20000.00', customersWithDebt: 3, customersOverdue: 1 }
const page = (rows) => ({ status: 200, body: { success: true, data: rows, meta: { page: 1, pageSize: 20, total: rows.length, totalPages: 1 }, message: 'ok' } })

const baseRoutes = (permissions = ALL) => ({
  'GET /auth/me': session(buildUser({ permissions }), PLAN),
  'GET /health': healthyResponse,
  'GET /notifications/unread-count': ok({ unread: 0 }),
  'GET /notifications': page([]),
  'GET /branding': ok({ name: 'Agro El Campo', logo: null }),
  'GET /me/preferences': ok({ theme: 'system' }),
  'GET /payment-methods': ok(METHODS),
  'GET /receivables/summary': ok(SUMMARY),
  'GET /customers': page([buildCustomer()]),
  'GET /customers/4': ok(buildCustomer()),
  'GET /receivables': page([RECEIVABLE]),
  'GET /receivables/7': ok(RECEIVABLE),
  'GET /customer-payments': page([PAYMENT]),
  'GET /customers/4/statement': ok({ customer: buildCustomer(), entries: [] }),
  'GET /cash-sessions': page([{ id: 3, register: { id: 1, name: 'Mostrador' }, openedAt: '2026-11-17T12:00:00.000Z', status: 'open' }]),
})

afterEach(() => {
  restoreApi()
  window.localStorage.clear()
})

describe('utilidades', () => {
  it('arma el enlace de WhatsApp con el 57 de Colombia y el saldo', () => {
    expect(whatsappNumber('300 123 4567')).toBe('573001234567')
    expect(whatsappNumber('+57 300 1234567')).toBe('573001234567')
    const link = reminderLink({ customer: { name: 'Pedro Gómez', phone: '3001234567' }, businessName: 'Agro El Campo', balance: '150000.00', overdueBalance: '50000.00' })
    expect(link).toMatch(/^https:\/\/wa\.me\/573001234567\?text=/)
    expect(decodeURIComponent(link.split('text=')[1])).toBe('Hola Pedro, te saludamos de Agro El Campo. Te recordamos que tienes un saldo vencido de $ 50.000. Tu saldo total es de $ 150.000. ¡Gracias por tu confianza!')
  })
})

describe('clientes', () => {
  it('lista con el resumen de cartera, filtros y cumpleaños; registra un cliente', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ ...baseRoutes(), 'POST /customers': (call) => ok(buildCustomer({ id: 5, ...call.data, balance: '0.00' })), 'GET /customers/5': ok(buildCustomer({ id: 5, name: 'Ana Ruiz', balance: '0.00' })) })
    renderApp('/clientes')

    expect(await screen.findByRole('link', { name: /Pedro Gómez/ })).toHaveAttribute('href', '/clientes/4')
    expect(screen.getByText('Cumple años en 2 días')).toBeInTheDocument()
    expect(screen.getByText('$ 50.000 vencido')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Cartera' })).toBeInTheDocument()
    expect(screen.getByText('3 · 1 morosos')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Con deuda vencida' }))
    expect(calls.filter((call) => call.url === '/customers').at(-1).params).toMatchObject({ debt: 'overdue', page: 1 })
    await user.selectOptions(screen.getByLabelText('Mostrar'), 'birthday')
    expect(calls.filter((call) => call.url === '/customers').at(-1).params).toMatchObject({ birthday: 'soon' })

    await user.click(screen.getByRole('button', { name: 'Nuevo cliente' }))
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo cliente' })
    await user.click(within(dialog).getByRole('button', { name: 'Registrar cliente' }))
    expect(within(dialog).getByText('Escribe el nombre (mínimo 2 caracteres)')).toBeInTheDocument()
    await user.type(within(dialog).getByLabelText(/^Nombre/), 'Ana Ruiz')
    await user.type(within(dialog).getByLabelText(/^Celular/), '310 555 0000')
    await user.type(within(dialog).getByLabelText(/^Cupo de crédito/), '300000')
    await user.click(within(dialog).getByRole('button', { name: 'Registrar cliente' }))
    expect(await screen.findByText('Ana Ruiz quedó registrado')).toBeInTheDocument()
    expect(calls.find((call) => call.method === 'POST').data).toMatchObject({ name: 'Ana Ruiz', phone: '310 555 0000', creditLimit: '300000', documentType: null, birthDate: null })
  })

  it('la ficha muestra lo que debe, las cuotas y el recordatorio por WhatsApp', async () => {
    mockApi(baseRoutes())
    renderApp('/clientes/4')

    expect(await screen.findByRole('heading', { name: 'Pedro Gómez' })).toBeInTheDocument()
    expect(screen.getByText('39 años · 19/11/1986')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Recordar por WhatsApp' })).toHaveAttribute('href', expect.stringMatching(/^https:\/\/wa\.me\/573001234567/))
    expect(await screen.findByText('Cuota 1')).toBeInTheDocument()
    expect(screen.getAllByText('Vencida').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Anular deuda' })).toBeInTheDocument()
  })

  it('sin celular no se le puede fiar', async () => {
    mockApi({ ...baseRoutes(), 'GET /customers/4': ok(buildCustomer({ phone: null, balance: '0.00', overdueBalance: '0.00' })), 'GET /receivables': page([]) })
    renderApp('/clientes/4')
    expect(await screen.findByText('Sin celular: no se le puede fiar')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Registrar deuda' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Recibir abono' })).not.toBeInTheDocument()
  })
})

describe('importar desde Excel (D-CLI-10)', () => {
  const xlsx = () => new File(['x'], 'clientes.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })

  it('desde la lista se llega a importar; con el archivo válido muestra clientes y deudas y luego importa', async () => {
    const user = userEvent.setup()
    const summary = { isValid: true, customersToCreate: 3, customersWithDebt: 2, debtTotal: '738000.00', customersWithoutPhone: 1, errors: [], totalErrors: 0 }
    const calls = mockApi({
      ...baseRoutes(),
      'POST /customers/import': (call) => ok(call.params?.dryRun ? { ...summary, imported: false } : { ...summary, imported: true, created: 3, debtsCreated: 2 }),
    })
    renderApp('/clientes')

    await user.click(await screen.findByRole('button', { name: 'Importar' }))
    await user.upload(await screen.findByLabelText('Archivo de Excel con los clientes'), xlsx())
    expect(await screen.findByText('Clientes nuevos')).toBeInTheDocument()
    expect(screen.getByText('Con deuda · $ 738.000')).toBeInTheDocument()
    expect(screen.getByText('Con deuda y sin celular')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Importar 3 clientes' }))
    const dialog = await screen.findByRole('dialog', { name: 'Importar clientes' })
    expect(dialog).toHaveTextContent('2 con deuda por $ 738.000 en total')
    await user.click(within(dialog).getByRole('button', { name: 'Importar' }))

    expect(await screen.findByRole('heading', { name: '3 clientes importados' })).toBeInTheDocument()
    expect(screen.getByText('2 deudas por $ 738.000 en la cartera.')).toBeInTheDocument()
    const uploads = calls.filter((call) => call.url === '/customers/import')
    expect(uploads.map((call) => call.params?.dryRun ?? 'commit')).toEqual(['true', 'commit'])
  })

  it('con errores los muestra por fila y no deja importar', async () => {
    const user = userEvent.setup()
    mockApi({
      ...baseRoutes(),
      'POST /customers/import': ok({ isValid: false, totalErrors: 1, errors: [{ row: 4, field: 'Nombre', message: 'Ya existe un cliente con este nombre' }] }),
    })
    renderApp('/clientes/importar')
    await user.upload(await screen.findByLabelText('Archivo de Excel con los clientes'), xlsx())
    expect(await screen.findByText('El archivo tiene 1 error')).toBeInTheDocument()
    expect(screen.getByText('Ya existe un cliente con este nombre')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Importar \d/ })).not.toBeInTheDocument()
  })

  it('sin permiso para administrar clientes no aparece Importar', async () => {
    mockApi(baseRoutes(['customers.view']))
    renderApp('/clientes')
    expect(await screen.findByRole('link', { name: /Pedro Gómez/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Importar' })).not.toBeInTheDocument()
  })
})

describe('deudas y abonos', () => {
  it('registra un saldo inicial en cuotas calculadas y editables', async () => {
    const user = userEvent.setup()
    const calls = mockApi({
      ...baseRoutes(),
      'POST /receivables/installments-preview': ok([
        { installmentNumber: 1, dueDate: '2026-12-17', amount: '33333.00' },
        { installmentNumber: 2, dueDate: '2027-01-17', amount: '33333.00' },
        { installmentNumber: 3, dueDate: '2027-02-17', amount: '33334.00' },
      ]),
      'POST /receivables': ok({ ...RECEIVABLE, number: 'CXC-000002', creditWarning: null }),
    })
    renderApp('/clientes/4')

    await user.click(await screen.findByRole('button', { name: 'Registrar deuda' }))
    const dialog = await screen.findByRole('dialog', { name: 'Registrar deuda' })
    await user.type(within(dialog).getByLabelText(/^Concepto/), 'Cuaderno de fiados')
    await user.type(within(dialog).getByLabelText(/^Valor/), '100.000')
    await user.click(within(dialog).getByRole('radio', { name: /En cuotas/ }))
    await user.click(within(dialog).getByRole('button', { name: 'Calcular cuotas' }))
    expect(await within(dialog).findByText('Suman $ 100.000')).toBeInTheDocument()

    // Cambiar una cuota descuadra la suma y no deja guardar
    await user.clear(within(dialog).getByLabelText('Valor de la cuota 3'))
    await user.type(within(dialog).getByLabelText('Valor de la cuota 3'), '30.000')
    expect(within(dialog).getByText(/faltan \$ 3\.334/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Registrar deuda' }))
    expect(within(dialog).getByText('Las cuotas suman $ 96.666: deben sumar $ 100.000')).toBeInTheDocument()
    await user.clear(within(dialog).getByLabelText('Valor de la cuota 3'))
    await user.type(within(dialog).getByLabelText('Valor de la cuota 3'), '33.334')
    await user.click(within(dialog).getByRole('button', { name: 'Registrar deuda' }))

    expect(await screen.findByText('Deuda CXC-000002 registrada')).toBeInTheDocument()
    expect(calls.find((call) => call.url === '/receivables/installments-preview').data).toEqual({ total: '100000', count: 3, frequency: 'monthly', firstDueDate: expect.any(String) })
    expect(calls.find((call) => call.method === 'POST' && call.url === '/receivables').data).toMatchObject({
      customerId: 4,
      description: 'Cuaderno de fiados',
      total: '100000',
      paymentMode: 'installments',
      installments: [
        { dueDate: '2026-12-17', amount: '33333' },
        { dueDate: '2027-01-17', amount: '33333' },
        { dueDate: '2027-02-17', amount: '33334' },
      ],
    })
  })

  it('recibe un abono en efectivo a la caja y muestra el recibo', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ ...baseRoutes(), 'POST /customer-payments': ok(PAYMENT) })
    renderApp('/clientes/4')

    await user.click(await screen.findByRole('button', { name: 'Recibir abono' }))
    const dialog = await screen.findByRole('dialog', { name: 'Recibir abono' })
    await user.type(within(dialog).getByLabelText(/^Valor/), '200.000')
    await user.selectOptions(within(dialog).getByLabelText(/^Método de pago/), '1')
    await user.click(within(dialog).getByRole('button', { name: 'Registrar abono' }))
    expect(within(dialog).getByText('No puede pasar de lo que se debe ($ 150.000)')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Lo vencido' }))
    expect(within(dialog).getByLabelText(/^Valor/)).toHaveValue('50.000')
    // Un solo turno abierto: se escoge solo
    expect(within(dialog).getByLabelText(/^Entra a la caja/)).toHaveValue('3')
    await user.click(within(dialog).getByRole('button', { name: 'Registrar abono' }))

    const receipt = await screen.findByRole('dialog', { name: 'Recibo AB-000001' })
    expect(within(receipt).getByText('Cuota 1 (01/11/2026): $ 50.000')).toBeInTheDocument()
    expect(within(receipt).getByRole('link', { name: 'Enviar por WhatsApp' })).toHaveAttribute('href', expect.stringMatching(/^https:\/\/wa\.me\/573001234567/))
    // Va con su clave contra el doble registro (D-AUD-3)
    expect(calls.find((call) => call.method === 'POST').data).toEqual({ idempotencyKey: expect.stringMatching(/^[A-Za-z0-9_-]{8,64}$/), customerId: 4, amount: '50000', paymentMethodId: 1, cashSessionId: 3, notes: null })
  })

  it('anula un abono con motivo desde la pestaña de abonos', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ ...baseRoutes(), 'POST /customer-payments/9/cancel': ok({ ...PAYMENT, status: 'cancelled' }) })
    renderApp('/clientes/4')

    await user.click(await screen.findByRole('tab', { name: /Abonos/ }))
    await user.click(await screen.findByRole('button', { name: 'Anular AB-000001' }))
    const dialog = await screen.findByRole('dialog', { name: 'Anular el abono AB-000001' })
    expect(within(dialog).getByText(/sale del mismo turno de caja/)).toBeInTheDocument()
    await user.type(within(dialog).getByLabelText(/^Motivo/), 'Se registró dos veces')
    await user.click(within(dialog).getByRole('button', { name: 'Anular abono' }))
    expect(await screen.findByText('Abono AB-000001 anulado')).toBeInTheDocument()
    expect(calls.find((call) => call.url === '/customer-payments/9/cancel').data).toEqual({ reason: 'Se registró dos veces' })
  })

  it('la cartera filtra por vencidas y muestra los abonos recibidos', async () => {
    const user = userEvent.setup()
    const calls = mockApi(baseRoutes())
    renderApp('/cartera')
    expect(await screen.findByText('CXC-000001')).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Vencidas' }))
    expect(calls.filter((call) => call.url === '/receivables').at(-1).params).toMatchObject({ overdue: 'true' })
    await user.click(screen.getByRole('tab', { name: 'Abonos recibidos' }))
    await user.click(await screen.findByRole('button', { name: 'Ver recibo AB-000001' }))
    expect(await screen.findByRole('dialog', { name: 'Recibo AB-000001' })).toBeInTheDocument()
  })
})

describe('varias sucursales (Fase 19)', () => {
  it('el estado de cuenta y el recibo dicen en qué sucursal fue cada movimiento', async () => {
    const user = userEvent.setup()
    const entries = [
      { kind: 'charge', id: 1, number: 'CXC-000001', date: '2026-11-10', description: 'Venta fiada', amount: '300000.00', cancelled: false, branchName: 'Centro', balanceAfter: '300000.00' },
      { kind: 'payment', id: 9, number: 'ABNOR-000001', date: '2026-11-17', description: 'Abono · Efectivo', amount: '350000.00', cancelled: false, branchName: 'Norte', balanceAfter: '-50000.00' },
    ]
    const crossPayment = {
      ...PAYMENT,
      allocations: [
        { receivableId: 1, number: 'CXC-000001', description: 'Venta fiada', balanceNow: '0.00', amount: '300000.00', branch: { id: 1, code: 'MAIN', name: 'Centro' }, installments: [] },
        { receivableId: 2, number: 'CXCNOR-000001', description: 'Venta fiada', balanceNow: '150000.00', amount: '50000.00', branch: { id: 2, code: 'NOR', name: 'Norte' }, installments: [] },
      ],
    }
    mockApi({ ...baseRoutes(), 'GET /customers/4/statement': ok({ customer: buildCustomer(), entries }), 'GET /customer-payments': page([crossPayment]) })
    renderApp('/clientes/4')
    await user.click(await screen.findByRole('tab', { name: /Estado de cuenta/ }))
    expect(await screen.findAllByRole('columnheader', { name: 'Sucursal' })).not.toHaveLength(0)
    expect(screen.getAllByText('Norte').length).toBeGreaterThan(0)

    await user.click(screen.getByRole('tab', { name: /Abonos/ }))
    await user.click(await screen.findByRole('button', { name: 'Ver recibo AB-000001' }))
    const receipt = await screen.findByRole('dialog', { name: 'Recibo AB-000001' })
    expect(within(receipt).getByText('Sucursal Centro')).toBeInTheDocument()
    expect(within(receipt).getByText('Sucursal Norte')).toBeInTheDocument()
  })
})

describe('avisos', () => {
  it('Configuración → Avisos incluye cartera y cumpleaños', async () => {
    const user = userEvent.setup()
    const values = { 'inventory.expiry_alert_days': 30, 'inventory.document_alert_days': 30, 'purchases.payable_alert_days': 5, 'inventory.low_stock_alert': true, 'receivables.due_alert_days': 3, 'receivables.default_term_days': 30, 'customers.birthday_alert_days': 3 }
    const calls = mockApi({ ...baseRoutes(), 'GET /settings': ok({ values, fixed: {}, logo: null }), 'PATCH /settings': (call) => ok({ values: { ...values, ...call.data.values }, fixed: {}, logo: null }) })
    renderApp('/configuracion/avisos')

    expect(await screen.findByText('Cumpleaños de clientes')).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: 'Solo el día' }))
    await user.click(within(screen.getByRole('group', { name: /Plazo propuesto/ })).getByRole('radio', { name: '45 días' }))
    await user.click(screen.getByRole('button', { name: /Guardar/ }))
    expect(await screen.findByText('Avisos guardados')).toBeInTheDocument()
    expect(calls.find((call) => call.method === 'PATCH').data.values).toEqual({ 'customers.birthday_alert_days': 0, 'receivables.default_term_days': 45 })
  })

  it('cuando llega un aviso nuevo suena y sale en el escritorio', async () => {
    const shown = []
    class FakeNotification {
      static permission = 'granted'
      static requestPermission = vi.fn()
      constructor(title, options) {
        shown.push({ title, ...options })
      }
    }
    const start = vi.fn()
    class FakeAudio {
      currentTime = 0
      destination = {}
      createOscillator() {
        return { type: '', frequency: {}, connect: () => ({ connect: () => {} }), start, stop: () => {} }
      }
      createGain() {
        return { gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} } }
      }
    }
    vi.stubGlobal('Notification', FakeNotification)
    vi.stubGlobal('AudioContext', FakeAudio)
    let unread = 0
    const notification = { id: 41, title: '¡Hoy cumple años un cliente!', message: 'Lucía cumple 25 años hoy.', severity: 'info', link: '/clientes/4', readAt: null, createdAt: '2026-11-17T15:00:00.000Z' }
    mockApi({
      ...baseRoutes(),
      'GET /notifications/unread-count': () => ok({ unread }),
      'GET /notifications': () => page(unread ? [notification, { ...notification, id: 40 }] : [{ ...notification, id: 40, readAt: '2026-11-16T10:00:00.000Z' }]),
    })
    const { store } = renderApp('/clientes')
    await screen.findByRole('link', { name: /Pedro Gómez/ })
    await waitFor(() => expect(shown).toEqual([]))

    unread = 1
    // El contador se vuelve a pedir (como en el sondeo de cada minuto)
    await act(async () => {
      store.dispatch(baseApi.util.invalidateTags(['Notification']))
    })
    await waitFor(() => expect(shown).toEqual([expect.objectContaining({ title: '¡Hoy cumple años un cliente!', body: 'Lucía cumple 25 años hoy.', tag: 'nexsupply-41' })]))
    expect(start).toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
