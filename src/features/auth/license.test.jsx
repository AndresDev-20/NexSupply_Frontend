// N2 — Avisos de la licencia de NexCore: prueba, pago pendiente, sin conexión y solo lectura.
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '../../test/renderWithProviders'
import { ADMIN_PERMISSIONS, BASIC_PLAN, buildUser, healthyResponse, mockApi, ok, restoreApi, session } from '../../test/mockApi'
import { licenseNotice } from './licenseNotice'

const page = (rows) => ({ status: 200, body: { success: true, data: rows, meta: { page: 1, pageSize: 20, total: rows.length, totalPages: 1 }, message: 'ok' } })
const admin = buildUser({ permissions: ADMIN_PERMISSIONS, role: { id: 1, name: 'Administrador', systemRole: 'administrator' } })
const cashier = buildUser({ permissions: ['branches.view'], role: { id: 3, name: 'Cajero', systemRole: null } })
const license = (overrides = {}) => ({ source: 'nexcore', status: 'active', readOnly: false, readOnlyReason: null, validUntil: '2027-12-31', graceUntil: null, trialEndsAt: null, trialDaysLeft: null, offline: null, ...overrides })

function routes(user, lic) {
  return {
    'GET /auth/me': session(user, { ...BASIC_PLAN, license: lic }),
    'GET /health': healthyResponse,
    'GET /notifications/unread-count': ok({ unread: 0 }),
    'GET /notifications': page([]),
    'GET /branding': ok({ name: 'Agro El Campo', logo: null }),
    'GET /me/preferences': ok({ theme: 'system' }),
    'GET /branches': ok({ branches: [{ id: 1, code: 'MAIN', name: 'Sede principal', address: null, phone: null, isActive: true }], limit: 1, total: 1 }),
  }
}

beforeEach(() => window.sessionStorage.clear())
afterEach(() => restoreApi())

describe('qué aviso toca', () => {
  it('sin NexCore no hay avisos; los de pago y prueba son solo para los administradores', () => {
    expect(licenseNotice({ ...license(), source: 'env' }, admin)).toBeNull()
    expect(licenseNotice(license(), admin)).toBeNull()
    expect(licenseNotice(license({ status: 'trial', trialDaysLeft: 5 }), admin)).toMatchObject({ tone: 'info', message: 'Te quedan 5 días de prueba.' })
    expect(licenseNotice(license({ status: 'trial', trialDaysLeft: 1 }), admin).message).toBe('Te queda 1 día de prueba.')
    expect(licenseNotice(license({ status: 'trial', trialDaysLeft: 0 }), admin).message).toMatch(/Hoy termina tu periodo de prueba/)
    expect(licenseNotice(license({ status: 'past_due', graceUntil: '2026-12-15' }), admin)).toMatchObject({ tone: 'warning', message: 'Tu pago está pendiente. El servicio se suspenderá el 15/12/2026.' })
    expect(licenseNotice(license({ offline: { since: '2026-11-15T00:00:00.000Z', graceUntil: '2026-11-22T00:00:00.000Z' } }), admin).message).toMatch(/antes del 22\/11\/2026/)
    expect(licenseNotice(license({ status: 'past_due', graceUntil: '2026-12-15' }), cashier)).toBeNull()
    expect(licenseNotice(license({ status: 'trial', trialDaysLeft: 5 }), cashier)).toBeNull()
  })

  it('la solo lectura es para todos y no se puede cerrar', () => {
    const suspended = licenseNotice(license({ status: 'suspended', readOnly: true, readOnlyReason: 'suspended' }), cashier)
    expect(suspended).toMatchObject({ tone: 'danger', dismissible: false, message: expect.stringMatching(/^Tu suscripción está suspendida\. Contacta a Nexoon\./) })
    expect(licenseNotice(license({ status: 'cancelled', readOnly: true, readOnlyReason: 'cancelled' }), cashier).message).toMatch(/exportar tus datos/)
    expect(licenseNotice(license({ status: 'suspended', readOnly: true, readOnlyReason: 'no_license' }), admin).title).toBe('Terminó el periodo de prueba')
    expect(licenseNotice(license({ readOnly: true, readOnlyReason: 'offline' }), admin).title).toBe('Sin conexión con Nexoon')
  })
})

describe('en pantalla', () => {
  it('el administrador ve el pago pendiente y puede ocultarlo durante la sesión', async () => {
    const user = userEvent.setup()
    mockApi(routes(admin, license({ status: 'past_due', graceUntil: '2026-12-15' })))
    const first = renderApp('/administracion/sucursales')
    expect(await screen.findByText('Tu pago está pendiente. El servicio se suspenderá el 15/12/2026.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ocultar este aviso' }))
    expect(screen.queryByText(/Tu pago está pendiente/)).not.toBeInTheDocument()
    first.unmount()
    // En la misma sesión del navegador sigue oculto
    renderApp('/administracion/sucursales')
    expect(await screen.findByText('Sede principal')).toBeInTheDocument()
    expect(screen.queryByText(/Tu pago está pendiente/)).not.toBeInTheDocument()
  })

  it('con la suscripción suspendida todos ven el aviso, sin botón para cerrarlo', async () => {
    mockApi(routes(cashier, license({ status: 'suspended', readOnly: true, readOnlyReason: 'suspended' })))
    renderApp('/administracion/sucursales')
    const alert = await screen.findByRole('alert')
    expect(within(alert).getByText('Suscripción suspendida')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ocultar este aviso' })).not.toBeInTheDocument()
  })

  it('el límite de sucursales lo dice con el nombre del plan', async () => {
    mockApi(routes(admin, license()))
    renderApp('/administracion/sucursales')
    expect(await screen.findByText('Tu plan Básico permite 1 sucursal. Para agregar más, contacta a Nexoon.')).toBeInTheDocument()
  })
})
