// Fase 12 — Gastos, soportes, categorías y gastos fijos.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '../../test/renderWithProviders'
import { BASIC_PLAN, buildUser, fail, healthyResponse, mockApi, ok, restoreApi, session } from '../../test/mockApi'

const PLAN = { ...BASIC_PLAN, features: [...BASIC_PLAN.features, 'expenses', 'cash'] }
const ALL = ['expenses.view', 'expenses.create', 'expenses.edit', 'expenses.cancel', 'expenses.manage', 'cash.view']
const METHODS = [
  { id: 1, name: 'Efectivo', isCash: true, requiresReference: false, isActive: true },
  { id: 2, name: 'Nequi', isCash: false, requiresReference: true, isActive: true },
]
const CATEGORIES = [
  { id: 3, name: 'Alimentación', isActive: true },
  { id: 4, name: 'Arriendo', isActive: true },
]
const SESSION = { id: 9, register: { id: 1, name: 'Mostrador' }, openedAt: '2026-11-17T12:00:00.000Z', status: 'open' }
const EXPENSE = {
  id: 11,
  number: 'G-000001',
  category: { id: 3, name: 'Alimentación' },
  expenseDate: '2026-11-17',
  description: 'Almuerzo de los trabajadores',
  payee: 'Restaurante La Ceiba',
  amount: '30000.00',
  paymentMethod: { id: 1, name: 'Efectivo', isCash: true },
  paymentReference: null,
  fromCash: true,
  register: { id: 1, name: 'Mostrador' },
  status: 'active',
  statusLabel: 'Vigente',
  attachmentsCount: 0,
  hasAttachment: false,
  canEditAmount: false,
  createdAt: '2026-11-17T15:00:00.000Z',
  createdBy: { id: 1, fullName: 'Robinson Barrios' },
  attachments: [],
}
const SUMMARY = { count: 1, total: '30000.00', fromCash: '30000.00', withoutAttachment: 1, byCategory: [{ categoryId: 3, name: 'Alimentación', total: '30000.00' }] }
const RECURRING = { id: 2, name: 'Arriendo del local', category: { id: 4, name: 'Arriendo' }, estimatedAmount: '1500000.00', dayOfMonth: 5, payee: 'Inmobiliaria', isActive: true, period: '2026-11', paidExpense: null, isDue: true }

const page = (rows, meta = {}) => ({ status: 200, body: { success: true, data: rows, meta: { page: 1, pageSize: 20, total: rows.length, totalPages: 1, ...meta }, message: 'ok' } })

const baseRoutes = (permissions = ALL) => ({
  'GET /auth/me': session(buildUser({ permissions }), PLAN),
  'GET /health': healthyResponse,
  'GET /notifications/unread-count': ok({ unread: 0 }),
  'GET /notifications': page([]),
  'GET /branding': ok({ name: 'Agro El Campo', logo: null }),
  'GET /me/preferences': ok({ theme: 'system' }),
  'GET /payment-methods': ok(METHODS),
  'GET /cash-sessions': page([SESSION]),
  'GET /expense-categories': ok(CATEGORIES),
  'GET /expenses': page([EXPENSE], { summary: SUMMARY }),
  'GET /expenses/11': ok(EXPENSE),
  'GET /recurring-expenses': ok([RECURRING]),
})

afterEach(() => {
  restoreApi()
})

describe('gastos', () => {
  it('muestra el resumen, en qué se fue la plata y avisa del gasto fijo por pagar', async () => {
    mockApi(baseRoutes())
    renderApp('/gastos')
    expect(await screen.findByText('G-000001')).toBeInTheDocument()
    const tiles = screen.getByRole('region', { name: 'Resumen de gastos' })
    expect(within(tiles).getByText('Salió de la caja')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Gastos por categoría' })).getByText('100 %')).toBeInTheDocument()
    expect(screen.getByText('Hay un gasto fijo por pagar')).toBeInTheDocument()
    expect(screen.getByText('De la caja')).toBeInTheDocument()
    // En la fila del gasto (además del mosaico del resumen)
    expect(screen.getByText('Sin soporte', { selector: '.expense-support' })).toBeInTheDocument()
  })

  it('registra un gasto que salió de la caja', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ ...baseRoutes(), 'POST /expenses': { status: 201, body: { success: true, data: EXPENSE, message: 'Gasto G-000001 registrado' } } })
    renderApp('/gastos')
    await user.click(await screen.findByRole('button', { name: 'Registrar gasto' }))
    const dialog = await screen.findByRole('dialog', { name: 'Registrar gasto' })
    await user.selectOptions(within(dialog).getByLabelText(/^Categoría/), '3')
    await user.type(within(dialog).getByLabelText(/^Descripción/), 'Almuerzo de los trabajadores')
    await user.type(within(dialog).getByLabelText(/^Valor/), '30.000')
    await user.selectOptions(within(dialog).getByLabelText(/^Método de pago/), '1')
    // "Salió de la caja" solo aparece con efectivo
    await user.click(within(dialog).getByRole('switch', { name: 'Salió de la caja' }))
    await user.click(within(dialog).getByRole('button', { name: 'Registrar gasto' }))
    await waitFor(() =>
      expect(calls.find((call) => call.method === 'POST' && call.url === '/expenses').data).toMatchObject({ categoryId: 3, description: 'Almuerzo de los trabajadores', amount: '30000', paymentMethodId: 1, fromCash: true, cashSessionId: 9 }),
    )
    // Abre el detalle del gasto registrado
    expect(await screen.findByRole('dialog', { name: 'Gasto G-000001' })).toBeInTheDocument()
  })

  it('el detalle de un gasto de la caja no deja editar el valor y permite anular', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ ...baseRoutes(), 'POST /expenses/11/cancel': ok({ ...EXPENSE, status: 'cancelled' }, 'Gasto G-000001 anulado') })
    renderApp('/gastos')
    await user.click(await screen.findByRole('button', { name: /G-000001/ }))
    const detail = await screen.findByRole('dialog', { name: 'Gasto G-000001' })
    expect(within(detail).getByText('Salió de Mostrador')).toBeInTheDocument()
    expect(within(detail).getByText('Sin soporte. Adjunta la factura o el recibo si lo tienes.')).toBeInTheDocument()

    await user.click(within(detail).getByRole('button', { name: 'Editar' }))
    const edit = await screen.findByRole('dialog', { name: 'Editar el gasto G-000001' })
    expect(within(edit).getByLabelText(/^Valor/)).toBeDisabled()
    await user.click(within(edit).getByRole('button', { name: 'Cancelar' }))

    await user.click(await screen.findByRole('button', { name: 'Anular' }))
    const cancel = await screen.findByRole('dialog', { name: 'Anular el gasto G-000001' })
    await user.type(within(cancel).getByRole('textbox'), 'Se registró dos veces')
    await user.click(within(cancel).getByRole('button', { name: 'Anular gasto' }))
    await waitFor(() => expect(calls.find((call) => call.url === '/expenses/11/cancel').data).toEqual({ reason: 'Se registró dos veces' }))
  })

  it('sin permiso de registrar no aparece el botón', async () => {
    mockApi(baseRoutes(['expenses.view']))
    renderApp('/gastos')
    expect(await screen.findByText('G-000001')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Registrar gasto' })).not.toBeInTheDocument()
  })
})

describe('gastos fijos', () => {
  it('muestra el que toca pagar y registra el pago con los datos llenos', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ ...baseRoutes(), 'POST /expenses': { status: 201, body: { success: true, data: { ...EXPENSE, id: 12, number: 'G-000002' }, message: 'Gasto G-000002 registrado' } } })
    renderApp('/gastos/fijos')
    expect(await screen.findByText('¡Toca pagarlo!')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Registrar pago' }))
    const dialog = await screen.findByRole('dialog', { name: 'Pagar Arriendo del local' })
    expect(within(dialog).getByLabelText(/^Valor/)).toHaveValue('1.500.000')
    expect(within(dialog).getByLabelText(/^Descripción/)).toHaveValue('Arriendo del local de noviembre 2026')
    await user.selectOptions(within(dialog).getByLabelText(/^Método de pago/), '2')
    await user.type(within(dialog).getByLabelText(/^Referencia/), 'NQ-55')
    await user.click(within(dialog).getByRole('button', { name: 'Registrar gasto' }))
    await waitFor(() =>
      expect(calls.find((call) => call.method === 'POST' && call.url === '/expenses').data).toMatchObject({ categoryId: 4, amount: '1500000', paymentMethodId: 2, paymentReference: 'NQ-55', fromCash: false, recurringExpenseId: 2, recurringPeriod: '2026-11' }),
    )
  })

  it('el día de pago va de 1 a 28 al crear un gasto fijo', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ ...baseRoutes(), 'POST /recurring-expenses': (call) => (call.data.name ? { status: 201, body: { success: true, data: [RECURRING], message: 'ok' } } : fail(400, 'VALIDATION_ERROR')) })
    renderApp('/gastos/fijos')
    await user.click(await screen.findByRole('button', { name: 'Nuevo gasto fijo' }))
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo gasto fijo' })
    const days = within(dialog).getByLabelText(/^Se paga el/)
    expect(within(days).getAllByRole('option')).toHaveLength(28)
    await user.type(within(dialog).getByLabelText(/^Nombre/), 'Internet')
    await user.selectOptions(within(dialog).getByLabelText(/^Categoría/), '3')
    await user.type(within(dialog).getByLabelText(/^Valor aproximado/), '90.000')
    await user.selectOptions(days, '10')
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(calls.find((call) => call.method === 'POST' && call.url === '/recurring-expenses').data).toEqual({ name: 'Internet', categoryId: 3, estimatedAmount: '90000', dayOfMonth: 10, payee: null }))
  })
})
