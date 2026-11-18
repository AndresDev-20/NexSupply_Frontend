// Fase 17 — Varias sucursales: selector de la barra, cabecera X-Branch-Id y sucursales de cada usuario.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '../../test/renderWithProviders'
import { ADMIN_PERMISSIONS, BASIC_PLAN, buildUser, healthyResponse, mockApi, ok, restoreApi, session } from '../../test/mockApi'

const CENTRO = { id: 1, code: 'MAIN', name: 'Centro' }
const NORTE = { id: 2, code: 'NOR', name: 'Norte' }
const SUR = { id: 3, code: 'SUR', name: 'Sur' }
const INTERMEDIATE = { ...BASIC_PLAN, code: 'intermediate', name: 'Intermedio', limits: { maxBranches: null } }
const admin = buildUser({ permissions: ADMIN_PERMISSIONS, branch: CENTRO })

const ROLES = [
  { id: 1, name: 'Administrador', description: null, systemRole: 'administrator', isSystemRole: true, permissions: ADMIN_PERMISSIONS, userCount: 1 },
  { id: 3, name: 'Cajero', description: null, systemRole: null, isSystemRole: false, permissions: ['users.view'], userCount: 0 },
]
const asRow = (branch) => ({ ...branch, address: null, phone: null, isActive: true })
const page = (rows) => ({ status: 200, body: { success: true, data: rows, meta: { page: 1, pageSize: 20, total: rows.length, totalPages: 1 }, message: 'ok' } })

function routes(overrides = {}) {
  return {
    'GET /auth/me': session(admin, INTERMEDIATE, [CENTRO, NORTE]),
    'GET /health': healthyResponse,
    'GET /notifications/unread-count': ok({ unread: 0 }),
    'GET /branches': ok({ branches: [asRow(CENTRO), asRow(NORTE)], limit: null, total: 2 }),
    'GET /roles': ok(ROLES),
    'GET /users': page([]),
    ...overrides,
  }
}

const branchHeader = (call) => (call.headers?.get ? call.headers.get('X-Branch-Id') : call.headers?.['X-Branch-Id']) ?? null

beforeEach(() => window.sessionStorage.clear())
afterEach(() => restoreApi())

describe('selector de sucursal', () => {
  it('con una sola sucursal (plan básico) no aparece', async () => {
    mockApi(routes({ 'GET /auth/me': session(admin, BASIC_PLAN, [CENTRO]), 'GET /branches': ok({ branches: [asRow(CENTRO)], limit: 1, total: 1 }) }))
    renderApp('/administracion/sucursales')
    expect(await screen.findByText('Centro')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Cambiar de sucursal/ })).not.toBeInTheDocument()
  })

  it('arranca en la principal, envía la sucursal en cada petición y cambia con confirmación', async () => {
    const user = userEvent.setup()
    const calls = mockApi(routes())
    const { store } = renderApp('/administracion/sucursales')

    const trigger = await screen.findByRole('button', { name: 'Sucursal: Centro. Cambiar de sucursal' })
    await waitFor(() => expect(calls.some((call) => call.url === '/branches')).toBe(true))
    // /auth no lleva la cabecera; el resto sí, con la sucursal activa
    expect(branchHeader(calls.find((call) => call.url === '/auth/me'))).toBeNull()
    expect(branchHeader(calls.find((call) => call.url === '/branches'))).toBe('1')
    expect(within(screen.getByRole('table')).getByText('Estás aquí')).toBeInTheDocument()

    await user.click(trigger)
    await user.click(screen.getByRole('menuitemradio', { name: /Norte/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Cambiar de sucursal' })
    expect(within(dialog).getByText(/lo que no hayas guardado/)).toBeInTheDocument()
    const before = calls.length
    await user.click(within(dialog).getByRole('button', { name: 'Cambiar de sucursal' }))

    expect(await screen.findByText('Ahora trabajas en Norte')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sucursal: Norte. Cambiar de sucursal' })).toBeInTheDocument()
    // La pantalla vuelve a pedir sus datos, ahora a Norte
    await waitFor(() => expect(calls.slice(before).some((call) => call.url === '/branches' && branchHeader(call) === '2')).toBe(true))
    expect(store.getState().auth.activeBranchId).toBe(2)
    expect(window.sessionStorage.getItem('nexsupply.activeBranch')).toBe('2')
  })

  it('cancelar no cambia nada', async () => {
    const user = userEvent.setup()
    mockApi(routes())
    const { store } = renderApp('/administracion/sucursales')
    await user.click(await screen.findByRole('button', { name: /Cambiar de sucursal/ }))
    await user.click(screen.getByRole('menuitemradio', { name: /Norte/ }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancelar' }))
    expect(store.getState().auth.activeBranchId).toBe(1)
  })

  it('al recargar sigue en la sucursal escogida en esta pestaña; si ya no entra a ella, vuelve a la principal', async () => {
    window.sessionStorage.setItem('nexsupply.activeBranch', '2')
    mockApi(routes())
    const first = renderApp('/administracion/sucursales')
    expect(await screen.findByRole('button', { name: 'Sucursal: Norte. Cambiar de sucursal' })).toBeInTheDocument()
    first.unmount()

    window.sessionStorage.setItem('nexsupply.activeBranch', '3')
    mockApi(routes({ 'GET /auth/me': session(admin, INTERMEDIATE, [CENTRO, NORTE]) }))
    renderApp('/administracion/sucursales')
    expect(await screen.findByRole('button', { name: 'Sucursal: Centro. Cambiar de sucursal' })).toBeInTheDocument()
  })
})

describe('sucursales de cada usuario', () => {
  it('al crear un usuario se escogen la principal y otras sucursales; las ajenas no se pueden dar', async () => {
    const user = userEvent.setup()
    // Un supervisor que entra a Centro y Norte; la empresa tiene además Sur
    const supervisor = buildUser({ permissions: ['users.view', 'users.create', 'roles.view', 'branches.view'], role: { id: 5, name: 'Supervisor', systemRole: null }, branch: CENTRO })
    const calls = mockApi(
      routes({
        'GET /auth/me': session(supervisor, INTERMEDIATE, [CENTRO, NORTE]),
        'GET /branches': ok({ branches: [asRow(CENTRO), asRow(NORTE), asRow(SUR)], limit: null, total: 3 }),
        'POST /users': ok({
          user: { id: 11, username: 'luis', fullName: 'Luis Gómez', role: ROLES[1], branch: CENTRO, branches: [CENTRO, NORTE], isActive: true },
          temporaryPassword: 'Kp7m-W3xa-9Hbe',
        }),
      }),
    )
    renderApp('/administracion/usuarios')

    await user.click(await screen.findByRole('button', { name: 'Nuevo usuario' }))
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo usuario' })
    await user.type(within(dialog).getByLabelText('Nombre completo'), 'Luis Gómez')
    await user.type(within(dialog).getByLabelText('Número de documento'), '1023456789')
    await user.click(within(dialog).getByRole('button', { name: 'Siguiente' }))

    await user.type(within(dialog).getByLabelText('Usuario'), 'luis')
    await user.selectOptions(within(dialog).getByLabelText('Rol'), '3')
    await user.selectOptions(within(dialog).getByLabelText('Sucursal principal'), '1')
    // La principal no se repite entre las otras; Sur no se puede dar porque el supervisor no entra
    const others = within(dialog).getByRole('group', { name: 'Otras sucursales donde trabaja' })
    expect(within(others).queryByLabelText(/Centro/)).not.toBeInTheDocument()
    expect(within(others).getByRole('checkbox', { name: /Sur/ })).toBeDisabled()
    await user.click(within(others).getByRole('checkbox', { name: /Norte/ }))
    expect(within(others).getByText(/Entra a 2 sucursales/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Crear usuario' }))

    await screen.findByRole('dialog', { name: 'Contraseña temporal' })
    expect(calls.find((call) => call.method === 'POST' && call.url === '/users').data).toMatchObject({ branchId: 1, branchIds: [2] })
  })

  it('un rol del sistema entra a todas: no se escogen sucursales', async () => {
    const user = userEvent.setup()
    mockApi(routes())
    renderApp('/administracion/usuarios')
    await user.click(await screen.findByRole('button', { name: 'Nuevo usuario' }))
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo usuario' })
    await user.type(within(dialog).getByLabelText('Nombre completo'), 'Marta Ruiz')
    await user.type(within(dialog).getByLabelText('Número de documento'), '1023456789')
    await user.click(within(dialog).getByRole('button', { name: 'Siguiente' }))
    await user.selectOptions(within(dialog).getByLabelText('Rol'), '1')
    expect(within(dialog).getByText('Con este rol entra a todas las sucursales activas.')).toBeInTheDocument()
    expect(within(dialog).queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('la lista se filtra por sucursal y muestra a cuántas más entra cada quien', async () => {
    const user = userEvent.setup()
    const ana = {
      id: 10,
      username: 'ana',
      fullName: 'Ana Pérez',
      documentType: 'CC',
      documentNumber: '1023456789',
      isActive: true,
      mustChangePassword: false,
      lastLoginAt: null,
      role: ROLES[1],
      branch: CENTRO,
      branches: [CENTRO, NORTE],
      accessToAllBranches: false,
      isSupportAccount: false,
    }
    const calls = mockApi(routes({ 'GET /users': page([ana]) }))
    renderApp('/administracion/usuarios?branchId=2')
    expect(await screen.findByText('+1')).toBeInTheDocument()
    await waitFor(() => expect(calls.filter((call) => call.url === '/users').at(-1).params).toMatchObject({ branchId: '2' }))
    await user.selectOptions(screen.getByLabelText('Sucursal'), '')
    await waitFor(() => expect(calls.filter((call) => call.url === '/users').at(-1).params.branchId).toBeUndefined())
  })
})
