// Libro para el contador (D-CON-1) dentro de Informes, con el backend simulado.
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '../../test/renderWithProviders'
import { BASIC_PLAN, buildUser, healthyResponse, mockApi, ok, restoreApi, session } from '../../test/mockApi'

const PLAN = { ...BASIC_PLAN, features: [...BASIC_PLAN.features, 'reports'] }
const CATALOG = [{ area: 'sales', label: 'Ventas', reports: [{ key: 'sales_by_day', title: 'Ventas por día', description: 'Cuánto se vendió cada día.', filters: ['dateRange'], defaults: {}, excel: true, pdf: true }] }]

const baseRoutes = (permissions = ['reports.sales', 'reports.accounting']) => ({
  'GET /auth/me': session(buildUser({ permissions }), PLAN),
  'GET /health': healthyResponse,
  'GET /notifications/unread-count': ok({ unread: 0 }),
  'GET /notifications': { status: 200, body: { success: true, data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 }, message: 'ok' } },
  'GET /branding': ok({ name: 'Agro El Campo', logo: null }),
  'GET /me/preferences': ok({ theme: 'system' }),
  'GET /reports': ok(CATALOG),
})

// jsdom no crea enlaces a archivos: se simulan para ver qué se descarga y con qué nombre
let downloads
beforeEach(() => {
  downloads = []
  URL.createObjectURL = vi.fn(() => 'blob:libro')
  URL.revokeObjectURL = vi.fn()
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click() {
    downloads.push(this.download)
  })
})
afterEach(() => {
  restoreApi()
  delete URL.createObjectURL
  delete URL.revokeObjectURL
})

describe('Libro para el contador', () => {
  it('«Descargar Excel» pide el libro con las fechas escogidas y lo descarga', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ ...baseRoutes(), 'GET /accounting/book.xlsx': { status: 200, body: new Blob(['xlsx']) } })
    renderApp('/informes')

    const book = await screen.findByRole('region', { name: 'Libro para el contador' })
    // Por defecto, el mes pasado: del día 1 al último
    expect(within(book).getByLabelText('Desde').value).toMatch(/^\d{4}-\d{2}-01$/)
    fireEvent.change(within(book).getByLabelText('Desde'), { target: { value: '2026-10-01' } })
    fireEvent.change(within(book).getByLabelText('Hasta'), { target: { value: '2026-10-31' } })
    await user.click(within(book).getByRole('button', { name: 'Descargar Excel' }))

    expect(await screen.findByText('Libro para el contador descargado')).toBeInTheDocument()
    const call = calls.find((item) => item.url === '/accounting/book.xlsx')
    expect(call.params).toEqual({ from: '2026-10-01', to: '2026-10-31' })
    expect(call.method).toBe('GET')
    expect(downloads).toEqual(['libro-contador-2026-10-01-a-2026-10-31.xlsx'])
  })

  it('con la fecha final antes de la inicial no pide nada', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ ...baseRoutes(), 'GET /accounting/book.xlsx': { status: 200, body: new Blob(['xlsx']) } })
    renderApp('/informes')

    const book = await screen.findByRole('region', { name: 'Libro para el contador' })
    fireEvent.change(within(book).getByLabelText('Desde'), { target: { value: '2026-10-31' } })
    fireEvent.change(within(book).getByLabelText('Hasta'), { target: { value: '2026-10-01' } })
    await user.click(within(book).getByRole('button', { name: 'Descargar Excel' }))

    expect(await screen.findByText('La fecha final no puede ser anterior a la inicial')).toBeInTheDocument()
    expect(calls.some((item) => item.url === '/accounting/book.xlsx')).toBe(false)
  })

  it('sin el permiso no aparece', async () => {
    mockApi(baseRoutes(['reports.sales']))
    renderApp('/informes')
    expect(await screen.findByText('Ventas por día')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Libro para el contador' })).not.toBeInTheDocument())
  })
})
