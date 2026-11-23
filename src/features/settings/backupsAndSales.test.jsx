// Configuración → Copias de seguridad (D-SEG-1) y Cotizaciones y apartados (D-COT-1, D-APA-1)
// con el backend simulado.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '../../test/renderWithProviders'
import { buildUser, fail, healthyResponse, mockApi, ok, restoreApi, session } from '../../test/mockApi'

const BACKUPS = {
  files: [
    { name: 'nexsupply_2026-11-23_0200.sql.gz', date: '2026-11-23', manual: false, size: 5242880, createdAt: '2026-11-23T07:00:00.000Z' },
    { name: 'nexsupply_2026-11-22_1530_manual.sql.gz', date: '2026-11-22', manual: true, size: 18588, createdAt: '2026-11-22T20:30:00.000Z' },
  ],
  lastRun: { ok: true, at: '2026-11-23T07:00:00.000Z', manual: false, copyError: null },
  isRunning: false,
  settings: { enabled: true, hour: 2, retentionDays: 30, hasCopyDir: false },
}

const SALES_VALUES = { 'quotes.validity_days': 15, 'layaway.min_down_payment_percent': 20, 'layaway.default_term_days': 30, 'layaway.due_alert_days': 3 }
const settingsResponse = (values = {}) => ok({ values: { ...SALES_VALUES, ...values }, fixed: { currency: 'COP', timezone: 'America/Bogota' }, logo: null })

const baseRoutes = (permissions) => ({
  'GET /auth/me': session(buildUser({ permissions })),
  'GET /health': healthyResponse,
  'GET /notifications/unread-count': ok({ unread: 0 }),
  'GET /branding': ok({ name: 'Agro El Campo', logo: null }),
  'GET /me/preferences': ok({ theme: 'system' }),
  'GET /backups': ok(BACKUPS),
  'GET /settings': settingsResponse(),
})

beforeEach(() => window.localStorage.clear())
afterEach(() => restoreApi())

describe('Copias de seguridad', () => {
  it('muestra el estado, las copias guardadas y avisa si no hay segunda carpeta', async () => {
    mockApi(baseRoutes(['backups.manage']))
    renderApp('/configuracion/copias-de-seguridad')

    const status = await screen.findByRole('region', { name: 'Estado de las copias' })
    expect(within(status).getByText('Última copia, bien')).toBeInTheDocument()
    expect(within(status).getByText('2:00 a. m.')).toBeInTheDocument()
    expect(within(status).getByText('30 días')).toBeInTheDocument()
    expect(screen.getByText(/Las copias están solo en este equipo/)).toBeInTheDocument()

    expect(screen.getByText('5,0 MB')).toBeInTheDocument()
    expect(screen.getByText('18 KB')).toBeInTheDocument()
    expect(screen.getByText('Sacada a mano')).toBeInTheDocument()
    expect(screen.getByText('Automática')).toBeInTheDocument()
  })

  it('«Sacar copia ahora» pide la copia y avisa', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ ...baseRoutes(['backups.manage']), 'POST /backups': { status: 201, body: { success: true, data: { ok: true, file: 'nexsupply_2026-11-23_1000_manual.sql.gz' }, message: 'Copia de seguridad lista' } } })
    renderApp('/configuracion/copias-de-seguridad')

    await user.click(await screen.findByRole('button', { name: 'Sacar copia ahora' }))
    expect(await screen.findByText('Copia de seguridad lista')).toBeInTheDocument()
    expect(calls.some((call) => call.method === 'POST' && call.url === '/backups')).toBe(true)
    // La lista se vuelve a pedir para mostrar la copia nueva
    await waitFor(() => expect(calls.filter((call) => call.method === 'GET' && call.url === '/backups')).toHaveLength(2))
  })

  it('si la última copia falló lo dice y si la copia nueva falla avisa el error', async () => {
    const user = userEvent.setup()
    mockApi({
      ...baseRoutes(['backups.manage']),
      'GET /backups': ok({ ...BACKUPS, lastRun: { ok: false, at: '2026-11-23T07:00:00.000Z', error: 'mysqldump no respondió.' } }),
      'POST /backups': fail(500, 'BACKUP_FAILED', 'No se pudo sacar la copia'),
    })
    renderApp('/configuracion/copias-de-seguridad')

    expect(await screen.findByText('La última copia falló')).toBeInTheDocument()
    expect(screen.getByText(/mysqldump no respondió\. Avise a Nexoon\./)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Sacar copia ahora' }))
    expect(await screen.findByText('No se pudo sacar la copia')).toBeInTheDocument()
  })
})

describe('Cotizaciones y apartados', () => {
  it('muestra lo configurado y guarda solo lo que cambió', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ ...baseRoutes(['settings.update']), 'PATCH /settings': (call) => settingsResponse(call.data.values) })
    renderApp('/configuracion/cotizaciones-y-apartados')

    const validity = await screen.findByRole('group', { name: 'Una cotización vale por' })
    expect(within(validity).getByRole('radio', { name: '15 días' })).toBeChecked()
    expect(within(screen.getByRole('group', { name: 'Abono inicial mínimo' })).getByRole('radio', { name: '20 %' })).toBeChecked()

    await user.click(within(validity).getByRole('radio', { name: '30 días' }))
    await user.click(within(screen.getByRole('group', { name: 'Abono inicial mínimo' })).getByRole('radio', { name: 'Sin mínimo' }))
    expect(screen.getByText('Tienes 2 cambios sin guardar')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByText('Configuración guardada')).toBeInTheDocument()
    expect(calls.find((call) => call.method === 'PATCH').data).toEqual({ values: { 'quotes.validity_days': 30, 'layaway.min_down_payment_percent': 0 } })
    await waitFor(() => expect(screen.queryByText(/sin guardar/)).not.toBeInTheDocument())
  })
})
