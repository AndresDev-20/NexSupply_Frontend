// Pantallas de administración con el backend simulado.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '../../test/renderWithProviders'
import { ADMIN_PERMISSIONS, BASIC_PLAN, buildUser, fail, healthyResponse, mockApi, ok, restoreApi, session } from '../../test/mockApi'

afterEach(() => restoreApi())

const admin = buildUser({ permissions: ADMIN_PERMISSIONS })

const ROLES = [
  { id: 1, name: 'Administrador', description: null, systemRole: 'administrator', isSystemRole: true, permissions: ADMIN_PERMISSIONS, userCount: 1 },
  { id: 2, name: 'Soporte Nexoon', description: null, systemRole: 'developer', isSystemRole: true, permissions: [], userCount: 1 },
  { id: 3, name: 'Cajero', description: 'Punto de venta', systemRole: null, isSystemRole: false, permissions: ['users.view'], userCount: 2 },
  { id: 4, name: 'Temporal', description: null, systemRole: null, isSystemRole: false, permissions: [], userCount: 0 },
]
const BRANCH = { id: 1, code: 'MAIN', name: 'Sede principal', address: null, phone: null, isActive: true }
const CATALOG = [
  { module: 'users', name: 'Usuarios', permissions: [{ code: 'users.view', name: 'Ver usuarios' }, { code: 'users.create', name: 'Crear usuarios' }] },
  { module: 'audit', name: 'Auditoría', permissions: [{ code: 'audit.view', name: 'Consultar la auditoría' }] },
]

function adminUser(overrides) {
  return {
    id: 10,
    username: 'ana',
    email: null,
    fullName: 'Ana Pérez',
    documentType: 'CC',
    documentNumber: '1023456789',
    phone: null,
    isActive: true,
    mustChangePassword: false,
    lastLoginAt: null,
    role: { id: 3, name: 'Cajero', systemRole: null },
    branch: { id: 1, code: 'MAIN', name: 'Sede principal' },
    isSupportAccount: false,
    ...overrides,
  }
}

/** Paso 1 del formulario de usuario: nombre y documento (obligatorios). */
async function fillPersonStep(user, dialog, { fullName, documentNumber = '1023456789', email }) {
  await user.type(within(dialog).getByLabelText('Nombre completo'), fullName)
  await user.type(within(dialog).getByLabelText('Número de documento'), documentNumber)
  if (email) await user.type(within(dialog).getByLabelText('Correo'), email)
  await user.click(within(dialog).getByRole('button', { name: 'Siguiente' }))
}

const page = (rows) => ({ status: 200, body: { success: true, data: rows, meta: { page: 1, pageSize: 20, total: rows.length, totalPages: 1 }, message: 'ok' } })

const baseRoutes = {
  'GET /auth/me': session(admin),
  'GET /health': healthyResponse,
  'GET /notifications/unread-count': ok({ unread: 0 }),
  'GET /roles': ok(ROLES),
  'GET /branches': ok({ branches: [BRANCH], limit: 1, total: 1 }),
  'GET /permissions': ok(CATALOG),
}

describe('menú y acceso según permisos', () => {
  it('el menú muestra solo lo que el usuario puede usar', async () => {
    mockApi({ ...baseRoutes, 'GET /auth/me': session(buildUser({ permissions: ['users.view'] })) })
    renderApp('/')

    const nav = await screen.findByRole('complementary', { name: 'Menú principal' })
    expect(within(nav).getByRole('link', { name: 'Usuarios' })).toBeInTheDocument()
    expect(within(nav).queryByRole('link', { name: 'Roles y permisos' })).not.toBeInTheDocument()
    expect(within(nav).queryByRole('link', { name: 'Auditoría' })).not.toBeInTheDocument()
  })

  it('sin permisos de administración la sección completa desaparece', async () => {
    mockApi({ ...baseRoutes, 'GET /auth/me': session(buildUser()) })
    renderApp('/')
    const nav = await screen.findByRole('complementary', { name: 'Menú principal' })
    expect(within(nav).queryByText('Administración')).not.toBeInTheDocument()
  })

  it('escribir la URL sin permiso muestra un aviso, no la pantalla', async () => {
    mockApi({ ...baseRoutes, 'GET /auth/me': session(buildUser({ permissions: ['users.view'] })) })
    renderApp('/administracion/roles')
    expect(await screen.findByRole('heading', { name: 'No tienes acceso a esta sección' })).toBeInTheDocument()
  })

  it('una funcionalidad fuera del plan muestra "No incluido en tu plan"', async () => {
    const planWithoutAudit = { ...BASIC_PLAN, features: ['administration'] }
    mockApi({ ...baseRoutes, 'GET /auth/me': session(admin, planWithoutAudit) })
    renderApp('/administracion/auditoria')
    expect(await screen.findByRole('heading', { name: 'No incluido en tu plan' })).toBeInTheDocument()
  })
})

describe('usuarios', () => {
  it('lista usuarios con sus etiquetas y bloquea las acciones sobre Soporte Nexoon y sobre uno mismo', async () => {
    mockApi({
      ...baseRoutes,
      'GET /users': page([
        adminUser(),
        adminUser({ id: 1, username: 'robinson', fullName: 'Robinson Barrios', role: { id: 1, name: 'Administrador', systemRole: 'administrator' } }),
        adminUser({ id: 2, username: 'soporte', fullName: 'Soporte Nexoon', isSupportAccount: true, role: { id: 2, name: 'Soporte Nexoon', systemRole: 'developer' } }),
      ]),
    })
    renderApp('/administracion/usuarios')

    expect(await screen.findByText('Ana Pérez')).toBeInTheDocument()
    expect(screen.getByText('Tú')).toBeInTheDocument()
    expect(screen.getAllByText('Soporte Nexoon').length).toBeGreaterThan(0)

    expect(screen.getByRole('button', { name: 'Editar a Soporte Nexoon' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Desactivar a Soporte Nexoon' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Desactivar a Robinson Barrios' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Desactivar a Ana Pérez' })).toBeEnabled()
  })

  it('crear un usuario envía los datos y muestra la contraseña temporal una sola vez', async () => {
    const user = userEvent.setup()
    const calls = mockApi({
      ...baseRoutes,
      'GET /users': page([]),
      'POST /users': ok({ user: adminUser({ id: 11, username: 'luis', fullName: 'Luis Gómez' }), temporaryPassword: 'Kp7m-W3xa-9Hbe' }),
    })
    renderApp('/administracion/usuarios')

    await user.click(await screen.findByRole('button', { name: 'Nuevo usuario' }))
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo usuario' })

    // Paso 1: Persona. El carné se actualiza mientras se escribe
    expect(within(dialog).getByText('Nombre del usuario')).toBeInTheDocument()
    await user.type(within(dialog).getByLabelText('Nombre completo'), 'Luis Gómez')
    expect(within(dialog).getByText('LG')).toBeInTheDocument()
    await user.type(within(dialog).getByLabelText('Número de documento'), '1.023.456.789')
    // El carné muestra el documento con su tipo y agrupado de a tres
    expect(within(dialog).getByText('CC 1.023.456.789')).toBeInTheDocument()
    await user.type(within(dialog).getByLabelText('Teléfono'), '3001234567')
    await user.click(within(dialog).getByRole('button', { name: 'Siguiente' }))

    // Paso 2: Acceso. El cliente no puede asignar el rol de Soporte Nexoon
    expect(within(dialog).queryByRole('option', { name: 'Soporte Nexoon' })).not.toBeInTheDocument()
    await user.type(within(dialog).getByLabelText('Usuario'), 'luis')
    await user.selectOptions(within(dialog).getByLabelText('Rol'), '3')
    await user.selectOptions(within(dialog).getByLabelText('Sucursal'), '1')
    expect(within(dialog).getByText('@luis')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Crear usuario' }))

    const passwordDialog = await screen.findByRole('dialog', { name: 'Contraseña temporal' })
    expect(within(passwordDialog).getByText('Kp7m-W3xa-9Hbe')).toBeInTheDocument()
    expect(within(passwordDialog).getByText('Solo se muestra esta vez')).toBeInTheDocument()
    expect(calls.find((c) => c.method === 'POST' && c.url === '/users').data).toEqual({
      username: 'luis',
      fullName: 'Luis Gómez',
      documentType: 'CC',
      documentNumber: '1.023.456.789',
      phone: '3001234567',
      email: null,
      roleId: 3,
      branchId: 1,
    })

    await user.click(within(passwordDialog).getByRole('button', { name: 'Ya la entregué' }))
    expect(screen.queryByText('Kp7m-W3xa-9Hbe')).not.toBeInTheDocument()
  })

  it('muestra los errores del servidor junto a cada campo', async () => {
    const user = userEvent.setup()
    mockApi({
      ...baseRoutes,
      'GET /users': page([]),
      'POST /users': fail(409, 'CONFLICT', 'Ya existe un registro con esos datos', [{ field: 'username', message: 'Valor duplicado' }]),
    })
    renderApp('/administracion/usuarios')

    await user.click(await screen.findByRole('button', { name: 'Nuevo usuario' }))
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo usuario' })
    await fillPersonStep(user, dialog, { fullName: 'Ana Pérez' })
    await user.type(within(dialog).getByLabelText('Usuario'), 'ana')
    await user.selectOptions(within(dialog).getByLabelText('Rol'), '3')
    await user.selectOptions(within(dialog).getByLabelText('Sucursal'), '1')
    await user.click(within(dialog).getByRole('button', { name: 'Crear usuario' }))

    expect(await within(dialog).findByText('Valor duplicado')).toBeInTheDocument()
  })

  it('no deja avanzar de paso con datos obligatorios vacíos', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ ...baseRoutes, 'GET /users': page([]) })
    renderApp('/administracion/usuarios')

    await user.click(await screen.findByRole('button', { name: 'Nuevo usuario' }))
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo usuario' })
    await user.click(within(dialog).getByRole('button', { name: 'Siguiente' }))

    expect(within(dialog).getByText('Escribe el nombre completo')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Nombre completo')).toHaveAttribute('aria-invalid', 'true')
    expect(within(dialog).queryByLabelText('Usuario')).not.toBeInTheDocument()

    expect(within(dialog).getByText('Escribe el número de documento')).toBeInTheDocument()

    // Una cédula con letras tampoco pasa
    await user.type(within(dialog).getByLabelText('Nombre completo'), 'Ana Pérez')
    await user.type(within(dialog).getByLabelText('Número de documento'), 'ABC12')
    await user.click(within(dialog).getByRole('button', { name: 'Siguiente' }))
    expect(within(dialog).getByText('La cédula debe tener entre 5 y 10 dígitos')).toBeInTheDocument()

    // En el paso 2, sin rol ni sucursal tampoco envía nada
    await user.clear(within(dialog).getByLabelText('Número de documento'))
    await user.type(within(dialog).getByLabelText('Número de documento'), '1023456789')
    await user.click(within(dialog).getByRole('button', { name: 'Siguiente' }))
    await user.click(within(dialog).getByRole('button', { name: 'Crear usuario' }))
    // ("Selecciona un rol" es también la opción vacía: se verifica el estado del campo)
    expect(within(dialog).getByLabelText('Rol')).toHaveAttribute('aria-invalid', 'true')
    expect(within(dialog).getByLabelText('Sucursal')).toHaveAttribute('aria-invalid', 'true')
    expect(calls.some((c) => c.method === 'POST')).toBe(false)
  })

  it('si el servidor rechaza un campo de un paso anterior, vuelve a ese paso', async () => {
    const user = userEvent.setup()
    mockApi({
      ...baseRoutes,
      'GET /users': page([]),
      'POST /users': fail(409, 'CONFLICT', 'Ya existe un registro con esos datos', [{ field: 'email', message: 'Valor duplicado' }]),
    })
    renderApp('/administracion/usuarios')

    await user.click(await screen.findByRole('button', { name: 'Nuevo usuario' }))
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo usuario' })
    await fillPersonStep(user, dialog, { fullName: 'Ana Pérez', email: 'ana@agro.com' })
    await user.type(within(dialog).getByLabelText('Usuario'), 'ana2')
    await user.selectOptions(within(dialog).getByLabelText('Rol'), '3')
    await user.selectOptions(within(dialog).getByLabelText('Sucursal'), '1')
    await user.click(within(dialog).getByRole('button', { name: 'Crear usuario' }))

    // De vuelta en el paso 1, con el error junto al correo
    expect(await within(dialog).findByText('Valor duplicado')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Correo')).toHaveAttribute('aria-invalid', 'true')
  })

  it('desactivar pide confirmación y avisa el resultado', async () => {
    const user = userEvent.setup()
    const calls = mockApi({
      ...baseRoutes,
      'GET /users': page([adminUser()]),
      'POST /users/10/deactivate': ok(adminUser({ isActive: false })),
    })
    renderApp('/administracion/usuarios')

    await user.click(await screen.findByRole('button', { name: 'Desactivar a Ana Pérez' }))
    const confirm = await screen.findByRole('dialog', { name: 'Desactivar usuario' })
    // En acciones peligrosas el foco empieza en "Cancelar"
    expect(within(confirm).getByRole('button', { name: 'Cancelar' })).toHaveFocus()
    await user.click(within(confirm).getByRole('button', { name: 'Desactivar' }))

    expect(await screen.findByText('Ana Pérez fue desactivado')).toBeInTheDocument()
    expect(calls.some((c) => c.url === '/users/10/deactivate')).toBe(true)
  })

  it('eliminar definitivamente pide confirmación, advierte del historial y llama a DELETE', async () => {
    const user = userEvent.setup()
    const calls = mockApi({
      ...baseRoutes,
      'GET /users': page([adminUser()]),
      'DELETE /users/10': ok(null),
    })
    renderApp('/administracion/usuarios')

    // El documento aparece formateado en la lista
    expect(await screen.findByText(/CC 1.023.456.789/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Eliminar a Ana Pérez' }))
    const confirm = await screen.findByRole('dialog', { name: 'Eliminar usuario definitivamente' })
    expect(within(confirm).getByText('todo su historial')).toBeInTheDocument()
    expect(within(confirm).getByRole('button', { name: 'Cancelar' })).toHaveFocus()
    await user.click(within(confirm).getByRole('button', { name: 'Eliminar definitivamente' }))

    expect(await screen.findByText('Ana Pérez fue eliminado definitivamente')).toBeInTheDocument()
    expect(calls.some((c) => c.method === 'DELETE' && c.url === '/users/10')).toBe(true)
  })

  it('sin el permiso users.delete no aparece el botón de eliminar', async () => {
    const permissions = ADMIN_PERMISSIONS.filter((code) => code !== 'users.delete')
    mockApi({ ...baseRoutes, 'GET /auth/me': session(buildUser({ permissions })), 'GET /users': page([adminUser()]) })
    renderApp('/administracion/usuarios')

    expect(await screen.findByRole('button', { name: 'Desactivar a Ana Pérez' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Eliminar a Ana Pérez' })).not.toBeInTheDocument()
  })

  it('al editarse a sí mismo el rol queda bloqueado', async () => {
    const user = userEvent.setup()
    mockApi({ ...baseRoutes, 'GET /users': page([adminUser({ id: 1, fullName: 'Robinson Barrios', role: { id: 1, name: 'Administrador', systemRole: 'administrator' } })]) })
    renderApp('/administracion/usuarios')

    await user.click(await screen.findByRole('button', { name: 'Editar a Robinson Barrios' }))
    const dialog = await screen.findByRole('dialog', { name: 'Editar usuario' })
    await user.click(within(dialog).getByRole('button', { name: 'Siguiente' }))
    expect(within(dialog).getByLabelText('Rol')).toBeDisabled()
    expect(within(dialog).queryByLabelText('Usuario')).not.toBeInTheDocument()
  })
})

describe('roles', () => {
  it('crea un rol marcando un módulo completo', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ ...baseRoutes, 'POST /roles': ok({ ...ROLES[3], id: 5, name: 'Bodega' }) })
    renderApp('/administracion/roles')

    await user.click(await screen.findByRole('button', { name: 'Nuevo rol' }))
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo rol' })
    await user.type(within(dialog).getByLabelText('Nombre del rol'), 'Bodega')
    await user.click(within(dialog).getByRole('button', { name: 'Siguiente' }))
    await user.click(await within(dialog).findByLabelText(/^Usuarios/))
    // El resumen cuenta los permisos marcados
    expect(within(dialog).getByText('2/2')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Crear rol' }))

    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.url === '/roles')).toBe(true))
    expect(calls.find((c) => c.url === '/roles' && c.method === 'POST').data).toEqual({
      name: 'Bodega',
      description: null,
      maxDiscountPercent: '0',
      permissions: ['users.view', 'users.create'],
    })
  })

  it('"Asignar permisos" abre directo en el paso de permisos y guarda los cambios', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ ...baseRoutes, 'PATCH /roles/3': ok({ ...ROLES[2], permissions: ['users.view', 'audit.view'] }) })
    renderApp('/administracion/roles')

    // Los roles del sistema no tienen este acceso directo
    expect(screen.queryByRole('button', { name: 'Asignar permisos a Administrador' })).not.toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: 'Asignar permisos a Cajero' }))
    const dialog = await screen.findByRole('dialog', { name: 'Editar rol' })
    // Sin pasar por "Información": el selector de permisos está a la vista
    expect(within(dialog).queryByLabelText('Nombre del rol')).not.toBeInTheDocument()
    await user.click(await within(dialog).findByLabelText(/^Consultar la auditoría/))
    await user.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH' && c.url === '/roles/3')).toBe(true))
    expect(calls.find((c) => c.method === 'PATCH').data).toEqual({
      name: 'Cajero',
      description: 'Punto de venta',
      maxDiscountPercent: '0',
      permissions: ['users.view', 'audit.view'],
    })
    expect(await screen.findByText('Rol "Cajero" actualizado')).toBeInTheDocument()
  })

  it('los roles del sistema solo se pueden ver; un rol con usuarios no se puede eliminar', async () => {
    const user = userEvent.setup()
    mockApi(baseRoutes)
    renderApp('/administracion/roles')

    expect(await screen.findByRole('button', { name: 'Eliminar Temporal' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Cajero tiene usuarios: no se puede eliminar' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Eliminar Administrador' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Ver permisos de Administrador' }))
    const dialog = await screen.findByRole('dialog', { name: 'Administrador' })
    expect(within(dialog).getByText('Permisos automáticos')).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Guardar cambios' })).not.toBeInTheDocument()
  })
})

describe('sucursales', () => {
  it('muestra el uso del plan y deshabilita "Nueva sucursal" al llegar al límite', async () => {
    mockApi({ ...baseRoutes, 'GET /auth/me': session(admin) })
    renderApp('/administracion/sucursales')

    expect(await screen.findByText('Sede principal')).toBeInTheDocument()
    expect(screen.getByText('1 de 1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nueva sucursal' })).toBeDisabled()
    expect(screen.getByText('Límite del plan alcanzado')).toBeInTheDocument()
  })
})

describe('auditoría', () => {
  it('lista acciones en español y muestra el detalle de un cambio', async () => {
    const user = userEvent.setup()
    mockApi({
      ...baseRoutes,
      'GET /audit-logs': page([
        {
          id: 1,
          action: 'user.updated',
          entityType: 'user',
          entityId: '10',
          oldValues: { full_name: 'Ana P.' },
          newValues: { full_name: 'Ana Pérez' },
          user: { id: 1, username: 'robinson', fullName: 'Robinson Barrios' },
          ip: '127.0.0.1',
          createdAt: '2026-11-17T01:00:00.000Z',
        },
        { id: 2, action: 'auth.login_failed', entityType: null, entityId: null, oldValues: null, newValues: { reason: 'user_not_found' }, user: null, ip: null, createdAt: '2026-11-17T01:00:00.000Z' },
      ]),
    })
    renderApp('/administracion/auditoria')

    // Los textos también existen como opciones del filtro: se espera a la fila de la tabla
    const detailButton = await screen.findByRole('button', { name: 'Ver detalle: Editó un usuario' })
    expect(screen.getByRole('button', { name: 'Ver detalle: Intento de ingreso fallido' })).toBeInTheDocument()
    expect(screen.getByText('No identificado')).toBeInTheDocument()

    await user.click(detailButton)
    const dialog = await screen.findByRole('dialog', { name: 'Editó un usuario' })
    expect(within(dialog).getByText('Ana P.')).toBeInTheDocument()
    expect(within(dialog).getByText('Ana Pérez')).toBeInTheDocument()
    expect(within(dialog).getByText('Robinson Barrios (@robinson)')).toBeInTheDocument()
  })
})

describe('campana de notificaciones', () => {
  it('muestra el contador, lista los avisos y marca todos como leídos', async () => {
    const user = userEvent.setup()
    let unread = 2
    const calls = mockApi({
      ...baseRoutes,
      'GET /notifications/unread-count': () => ok({ unread }),
      'GET /notifications': page([
        { id: 1, type: 't', title: 'Lote por vencer', message: 'Vitamina AD3E vence en 5 días', severity: 'warning', link: null, readAt: null, createdAt: '2026-11-17T01:00:00.000Z' },
      ]),
      'POST /notifications/read-all': () => {
        unread = 0
        return ok({ updated: 2 })
      },
    })
    renderApp('/')

    const bell = await screen.findByRole('button', { name: 'Notificaciones: 2 sin leer' })
    await user.click(bell)
    expect(await screen.findByText('Lote por vencer')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Marcar todas como leídas/ }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Notificaciones' })).toBeInTheDocument())
    expect(calls.some((c) => c.url === '/notifications/read-all')).toBe(true)
  })
})
