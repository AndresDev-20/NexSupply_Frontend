// Flujos de autenticación de punta a punta en el frontend (con el backend simulado).
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '../../test/renderWithProviders'
import { buildUser, fail, healthyResponse, mockApi, ok, restoreApi } from '../../test/mockApi'

const noSession = { 'GET /auth/me': fail(401, 'UNAUTHORIZED', 'Debes iniciar sesión para continuar') }
const VALID_TOKEN = 'a'.repeat(43)

afterEach(() => {
  restoreApi()
  window.history.replaceState(null, '', '/')
})

async function fillLogin(user, identifier, password) {
  await user.type(await screen.findByLabelText('Usuario o correo'), identifier)
  await user.type(screen.getByLabelText('Contraseña'), password)
  await user.click(screen.getByRole('button', { name: 'Ingresar' }))
}

describe('protección de rutas', () => {
  it('sin sesión, entrar a "/" lleva al inicio de sesión', async () => {
    mockApi(noSession)
    const { router } = renderApp('/')

    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/iniciar-sesion')
    expect(screen.getByText(/Desarrollado por/)).toBeInTheDocument()
  })

  it('con sesión, la pantalla de inicio de sesión redirige al sistema', async () => {
    mockApi({ 'GET /auth/me': ok({ user: buildUser() }), 'GET /health': healthyResponse })
    const { router } = renderApp('/iniciar-sesion')

    expect(await screen.findByRole('heading', { name: /Bienvenido a El Campesino/ })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
  })
})

describe('inicio de sesión', () => {
  it('con credenciales correctas entra al sistema y envía lo que escribió el usuario', async () => {
    const user = userEvent.setup()
    const calls = mockApi({
      ...noSession,
      'POST /auth/login': ok({ user: buildUser() }, 'Bienvenido, Robinson Barrios'),
      'GET /health': healthyResponse,
    })
    renderApp('/')

    await fillLogin(user, 'robinson', 'Clave2026')

    expect(await screen.findByRole('heading', { name: /Bienvenido a El Campesino/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Menú de Robinson Barrios' })).toBeInTheDocument()
    const loginCall = calls.find((c) => c.url === '/auth/login')
    expect(loginCall.data).toEqual({ identifier: 'robinson', password: 'Clave2026' })
    // Cabecera anti-CSRF (decisión D3)
    expect(loginCall.headers['X-Requested-With']).toBe('XMLHttpRequest')
  })

  it('con credenciales incorrectas: mensaje, sacudida, contraseña borrada y cursor listo', async () => {
    const user = userEvent.setup()
    mockApi({ ...noSession, 'POST /auth/login': fail(401, 'INVALID_CREDENTIALS', 'Usuario o contraseña incorrectos') })
    const { container } = renderApp('/iniciar-sesion')

    await fillLogin(user, 'robinson', 'Mala1234')

    expect(await screen.findByRole('alert')).toHaveTextContent('Usuario o contraseña incorrectos')
    expect(container.querySelector('form')).toHaveClass('auth-form--shake')
    const password = screen.getByLabelText('Contraseña')
    expect(password).toHaveValue('')
    expect(password).toHaveFocus()
    // El usuario se conserva: solo hay que volver a escribir la contraseña
    expect(screen.getByLabelText('Usuario o correo')).toHaveValue('robinson')
  })

  it('al entrar muestra la bienvenida animada con el nombre y luego desaparece', async () => {
    const user = userEvent.setup()
    mockApi({
      ...noSession,
      'POST /auth/login': ok({ user: buildUser() }, 'Bienvenido, Robinson Barrios'),
      'GET /health': healthyResponse,
    })
    renderApp('/iniciar-sesion')

    await fillLogin(user, 'robinson', 'Clave2026')

    expect(await screen.findByText('¡Bienvenido, Robinson!')).toBeInTheDocument()
    // Por debajo, el sistema ya cargó
    expect(await screen.findByRole('heading', { name: /Bienvenido a El Campesino/ })).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('¡Bienvenido, Robinson!')).not.toBeInTheDocument(), { timeout: 3000 })
  })

  it('restaurar una sesión existente NO muestra la bienvenida (solo al iniciar sesión)', async () => {
    mockApi({ 'GET /auth/me': ok({ user: buildUser() }), 'GET /health': healthyResponse })
    renderApp('/')

    expect(await screen.findByRole('heading', { name: /Bienvenido a El Campesino/ })).toBeInTheDocument()
    expect(screen.queryByText('¡Bienvenido, Robinson!')).not.toBeInTheDocument()
  })

  it('muestra los errores de validación junto a cada campo', async () => {
    const user = userEvent.setup()
    mockApi({
      ...noSession,
      'POST /auth/login': fail(400, 'VALIDATION_ERROR', 'Los datos enviados no son válidos', [
        { field: 'password', message: 'Ingresa tu contraseña' },
      ]),
    })
    renderApp('/iniciar-sesion')

    await user.type(await screen.findByLabelText('Usuario o correo'), 'robinson')
    await user.click(screen.getByRole('button', { name: 'Ingresar' }))

    expect(await screen.findByText('Ingresa tu contraseña')).toBeInTheDocument()
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('aria-invalid', 'true')
  })

  it('el botón del ojo muestra y oculta la contraseña', async () => {
    const user = userEvent.setup()
    mockApi(noSession)
    renderApp('/iniciar-sesion')

    const input = await screen.findByLabelText('Contraseña')
    expect(input).toHaveAttribute('type', 'password')
    await user.click(screen.getByRole('button', { name: 'Mostrar contraseña' }))
    expect(input).toHaveAttribute('type', 'text')
  })
})

describe('cambio de contraseña obligatorio', () => {
  it('quien debe cambiarla no puede entrar al sistema hasta hacerlo', async () => {
    const user = userEvent.setup()
    const pending = buildUser({ mustChangePassword: true })
    mockApi({
      'GET /auth/me': ok({ user: pending }),
      'POST /auth/change-password': ok({ user: { ...pending, mustChangePassword: false } }, 'Contraseña actualizada. Se cerraron tus sesiones en otros dispositivos'),
      'GET /health': healthyResponse,
    })
    const { router } = renderApp('/')

    expect(await screen.findByRole('heading', { name: 'Crea tu contraseña' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/cambiar-contrasena')

    const save = screen.getByRole('button', { name: 'Guardar contraseña' })
    await user.type(screen.getByLabelText('Contraseña asignada'), 'Temporal2026')
    await user.type(screen.getByLabelText('Nueva contraseña'), 'corta')
    // No cumple los requisitos: el botón sigue deshabilitado
    expect(save).toBeDisabled()

    await user.type(screen.getByLabelText('Nueva contraseña'), 'Segura2026')
    await user.type(screen.getByLabelText('Confirmar nueva contraseña'), 'cortaSegura2026')
    await user.click(save)

    expect(await screen.findByRole('heading', { name: 'Contraseña actualizada' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ir al inicio' }))
    expect(await screen.findByRole('heading', { name: /Bienvenido a El Campesino/ })).toBeInTheDocument()
  })

  it('avisa si la confirmación no coincide, sin llamar al servidor', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ 'GET /auth/me': ok({ user: buildUser({ mustChangePassword: true }) }) })
    renderApp('/cambiar-contrasena')

    await user.type(await screen.findByLabelText('Contraseña asignada'), 'Temporal2026')
    await user.type(screen.getByLabelText('Nueva contraseña'), 'Segura2026')
    await user.type(screen.getByLabelText('Confirmar nueva contraseña'), 'Distinta2026')
    await user.click(screen.getByRole('button', { name: 'Guardar contraseña' }))

    expect(await screen.findByText('Las contraseñas no coinciden')).toBeInTheDocument()
    expect(calls.some((c) => c.url === '/auth/change-password')).toBe(false)
  })
})

describe('cierre y expiración de sesión', () => {
  it('cerrar sesión desde el menú del usuario lleva al inicio de sesión con un aviso', async () => {
    const user = userEvent.setup()
    const calls = mockApi({
      'GET /auth/me': ok({ user: buildUser() }),
      'GET /health': healthyResponse,
      'POST /auth/logout': ok(null, 'Sesión cerrada'),
    })
    renderApp('/')

    await user.click(await screen.findByRole('button', { name: 'Menú de Robinson Barrios' }))
    await user.click(screen.getByRole('menuitem', { name: 'Cerrar sesión' }))

    expect(await screen.findByText('Cerraste sesión correctamente.')).toBeInTheDocument()
    expect(calls.some((c) => c.url === '/auth/logout')).toBe(true)
  })

  it('si la sesión expira y no se puede renovar, vuelve al inicio de sesión con el aviso', async () => {
    mockApi({
      'GET /auth/me': ok({ user: buildUser() }),
      'GET /health': fail(401, 'TOKEN_EXPIRED', 'Tu sesión expiró'),
      'POST /auth/refresh': fail(401, 'UNAUTHORIZED', 'Tu sesión terminó'),
    })
    const { router } = renderApp('/')

    expect(await screen.findByText('Tu sesión expiró. Inicia sesión de nuevo para continuar.')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/iniciar-sesion')
  })
})

describe('recuperación de contraseña', () => {
  it('pedir el enlace muestra el mensaje genérico del servidor', async () => {
    const user = userEvent.setup()
    const message = 'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña en unos minutos'
    const calls = mockApi({ ...noSession, 'POST /auth/forgot-password': ok(null, message) })
    renderApp('/iniciar-sesion')

    await user.click(await screen.findByRole('link', { name: '¿Olvidaste tu contraseña?' }))
    await user.type(await screen.findByLabelText('Correo'), 'robinson@agro.com')
    await user.click(screen.getByRole('button', { name: 'Enviar enlace' }))

    expect(await screen.findByText(/Si el correo está registrado/)).toBeInTheDocument()
    expect(calls.at(-1).data).toEqual({ email: 'robinson@agro.com' })
  })

  it('el enlace del correo: lee el token del fragmento, lo borra de la URL y restablece', async () => {
    const user = userEvent.setup()
    window.history.replaceState(null, '', `/restablecer-contrasena#token=${VALID_TOKEN}`)
    const calls = mockApi({
      ...noSession,
      'POST /auth/reset-password': ok(null, 'Contraseña restablecida. Ya puedes iniciar sesión con tu nueva contraseña'),
    })
    renderApp('/restablecer-contrasena')

    await user.type(await screen.findByLabelText('Nueva contraseña'), 'Recuperada2026')
    // El token ya no está en la barra de direcciones
    expect(window.location.hash).toBe('')
    await user.type(screen.getByLabelText('Confirmar contraseña'), 'Recuperada2026')
    await user.click(screen.getByRole('button', { name: 'Guardar contraseña' }))

    expect(await screen.findByRole('heading', { name: 'Contraseña restablecida' })).toBeInTheDocument()
    expect(calls.at(-1).data).toEqual({ token: VALID_TOKEN, newPassword: 'Recuperada2026' })
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute('href', '/iniciar-sesion')
  })

  it('sin token en el enlace muestra que no es válido y ofrece pedir otro', async () => {
    mockApi(noSession)
    renderApp('/restablecer-contrasena')

    expect(await screen.findByText('El enlace no es válido')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Solicitar un enlace nuevo' })).toHaveAttribute('href', '/recuperar-contrasena')
  })

  it('un enlace vencido muestra el mensaje del servidor', async () => {
    const user = userEvent.setup()
    window.history.replaceState(null, '', `/restablecer-contrasena#token=${VALID_TOKEN}`)
    mockApi({
      ...noSession,
      'POST /auth/reset-password': fail(400, 'INVALID_RESET_TOKEN', 'El enlace de recuperación no es válido o ya expiró. Solicita uno nuevo'),
    })
    renderApp('/restablecer-contrasena')

    await user.type(await screen.findByLabelText('Nueva contraseña'), 'Recuperada2026')
    await user.type(screen.getByLabelText('Confirmar contraseña'), 'Recuperada2026')
    await user.click(screen.getByRole('button', { name: 'Guardar contraseña' }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('ya expiró'))
  })
})
