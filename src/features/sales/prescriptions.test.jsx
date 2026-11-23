// Fórmulas veterinarias (D-VET-1) con el backend simulado: los datos de la fórmula en el cobro
// del punto de venta y el libro de fórmulas.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '../../test/renderWithProviders'
import { BASIC_PLAN, buildUser, healthyResponse, mockApi, ok, restoreApi, session } from '../../test/mockApi'

const PLAN = { ...BASIC_PLAN, features: [...BASIC_PLAN.features, 'sales', 'cash', 'customers'] }
const ALL = ['sales.create', 'sales.view', 'cash.view', 'customers.view']
const VACCINE = { id: 8, code: 'P-00008', name: 'Vacuna aftosa', unit: { id: 3, name: 'Unidad', symbol: 'und', allowsDecimals: false }, salePrice: '15000.00', taxRate: 'excluded', barcode: null, stock: '40.000', tracksBatches: false, expiredSalePolicy: 'block', requiresPrescription: true, presentations: [], matchedPresentationId: null }
const SESSION = { id: 9, register: { id: 1, name: 'Mostrador' }, openedAt: '2026-11-17T12:00:00.000Z', status: 'open' }
const TOTALS = { subtotal: '15000.00', lineDiscountTotal: '0.00', globalDiscount: '0.00', discountTotal: '0.00', discountPercent: '0.00', taxBase: '15000.00', taxTotal: '0.00', totalBeforeRounding: '15000.00', roundingAdjustment: '0.00', total: '15000.00' }
const PREVIEW = { totals: TOTALS, priceList: null, lines: [{ productId: 8, presentationId: null, unitPrice: '15000.00', gross: '15000.00', lineDiscount: '0.00', total: '15000.00' }], requires: { discount: false, expired: false }, warnings: { belowCost: [], expired: [] }, taxEnabled: false }
const SALE = { id: 31, number: 'V-000031', saleType: 'cash', total: '15000.00' }

const ENTRIES = [
  { id: 1, hasPrescription: true, number: 'F-123', veterinarianName: 'Ana Ruiz', veterinarianLicense: 'MV-778', date: '2026-11-20', patient: 'Finca La Esperanza', products: [{ productId: 8, productName: 'Vacuna aftosa', quantity: '2.000', unit: 'und' }], sale: { id: 30, number: 'V-000030', status: 'completed', customer: { id: 4, name: 'Granja Los Naranjos', isFinalConsumer: false } }, seller: { id: 1, fullName: 'Robinson Barrios' }, createdAt: '2026-11-20T15:00:00.000Z' },
  { id: 2, hasPrescription: false, number: null, veterinarianName: null, veterinarianLicense: null, date: null, patient: null, products: [{ productId: 8, productName: 'Vacuna aftosa', quantity: '1.000', unit: 'und' }], sale: { id: 31, number: 'V-000031', status: 'completed', customer: { id: 1, name: 'Consumidor final', isFinalConsumer: true } }, seller: { id: 1, fullName: 'Robinson Barrios' }, createdAt: '2026-11-21T15:00:00.000Z' },
]

const page = (rows, meta = {}) => ({ status: 200, body: { success: true, data: rows, meta: { page: 1, pageSize: 20, total: rows.length, totalPages: 1, ...meta }, message: 'ok' } })

const baseRoutes = (permissions = ALL) => ({
  'GET /auth/me': session(buildUser({ permissions }), PLAN),
  'GET /health': healthyResponse,
  'GET /notifications/unread-count': ok({ unread: 0 }),
  'GET /notifications': page([]),
  'GET /branding': ok({ name: 'Agro El Campo', logo: null }),
  'GET /me/preferences': ok({ theme: 'system' }),
  'GET /payment-methods': ok([{ id: 1, name: 'Efectivo', isCash: true, requiresReference: false, isActive: true }]),
  'GET /cash-sessions': page([SESSION]),
  'GET /customers': page([]),
  'GET /sales/catalog': ok([VACCINE]),
  'POST /sales/preview': ok(PREVIEW),
  // El comprobante no hace falta en estas pruebas: queda cargando
  'GET /sales/31/receipt': () => new Promise(() => {}),
})

beforeEach(() => window.localStorage.clear())
afterEach(() => restoreApi())

/** Agrega la vacuna al carrito y espera que se pueda cobrar. */
async function addVaccine(user) {
  await user.type(await screen.findByRole('searchbox', { name: /Escanea o busca/ }), 'vacuna')
  await user.click(await screen.findByRole('button', { name: /Vacuna aftosa/ }))
  const pay = screen.getByRole('form', { name: 'Cobro' })
  await waitFor(() => expect(within(pay).getByRole('button', { name: /Cobrar/ })).toBeEnabled())
  return pay
}

describe('Fórmula veterinaria en el punto de venta', () => {
  it('un producto que la requiere muestra la sección y la venta lleva la fórmula', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ ...baseRoutes(), 'POST /sales': ok({ ...SALE, prescriptionMissing: false }) })
    renderApp('/ventas/punto-de-venta')

    const pay = await addVaccine(user)
    expect(within(pay).getByText(/Vacuna aftosa requiere fórmula veterinaria/)).toBeInTheDocument()
    expect(within(pay).getByText('Sin datos, la venta queda como «Sin fórmula» en el libro de fórmulas.')).toBeInTheDocument()

    await user.type(within(pay).getByLabelText('Número de la fórmula'), 'F-123')
    await user.type(within(pay).getByLabelText('Médico veterinario'), 'Ana Ruiz')
    await user.type(within(pay).getByLabelText('Para qué animal o finca'), 'Finca La Esperanza')
    expect(within(pay).queryByText(/Sin datos, la venta queda/)).not.toBeInTheDocument()
    await user.click(within(pay).getByRole('button', { name: /Cobrar/ }))

    expect(await screen.findByText('Venta V-000031 registrada')).toBeInTheDocument()
    const body = calls.find((call) => call.method === 'POST' && call.url === '/sales').data
    expect(body.prescription).toEqual({ number: 'F-123', veterinarianName: 'Ana Ruiz', patient: 'Finca La Esperanza' })
  })

  it('sin datos la venta no lleva fórmula y avisa que quedó en el libro', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ ...baseRoutes(), 'POST /sales': ok({ ...SALE, prescriptionMissing: true }) })
    renderApp('/ventas/punto-de-venta')

    const pay = await addVaccine(user)
    await user.click(within(pay).getByRole('button', { name: /Cobrar/ }))

    expect(await screen.findByText('Venta V-000031 registrada sin fórmula veterinaria: quedó en el libro de fórmulas')).toBeInTheDocument()
    expect(calls.find((call) => call.method === 'POST' && call.url === '/sales').data).not.toHaveProperty('prescription')
  })

  it('con datos a medias no deja cobrar', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ ...baseRoutes(), 'POST /sales': ok(SALE) })
    renderApp('/ventas/punto-de-venta')

    const pay = await addVaccine(user)
    await user.type(within(pay).getByLabelText('Número de la fórmula'), 'F-123')
    await user.click(within(pay).getByRole('button', { name: /Cobrar/ }))
    expect(within(pay).getByText(/De la fórmula, escribe al menos el número y el nombre del veterinario/)).toBeInTheDocument()
    expect(calls.some((call) => call.method === 'POST' && call.url === '/sales')).toBe(false)
  })
})

describe('Libro de fórmulas', () => {
  it('lista las ventas con y sin fórmula y filtra', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ ...baseRoutes(), 'GET /sales/prescriptions': (call) => page(call.params?.has === 'without' ? [ENTRIES[1]] : ENTRIES, { summary: { withoutPrescription: 1 } }) })
    renderApp('/ventas/formulas')

    const withRx = (await screen.findByText('N.º F-123')).closest('tr')
    expect(within(withRx).getByText('V-000030')).toBeInTheDocument()
    expect(within(withRx).getByText('Ana Ruiz · TP MV-778 · 20/11/2026')).toBeInTheDocument()
    expect(within(withRx).getByText('Finca La Esperanza')).toBeInTheDocument()
    const without = screen.getByText('V-000031').closest('tr')
    expect(within(without).getByText('Sin fórmula')).toBeInTheDocument()
    expect(screen.getByText('1 venta quedó sin fórmula en este periodo.')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Mostrar'), 'without')
    await waitFor(() => expect(calls.some((call) => call.url === '/sales/prescriptions' && call.params?.has === 'without')).toBe(true))
    await waitFor(() => expect(screen.queryByText('N.º F-123')).not.toBeInTheDocument())
  })
})
