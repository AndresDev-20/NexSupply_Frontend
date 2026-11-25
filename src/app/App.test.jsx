// Pruebas de la aplicación completa con sesión iniciada: layout, inicio y estados del backend.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '../test/renderWithProviders'
import { buildUser, fail, healthyResponse, mockApi, NETWORK_DOWN, ok, restoreApi } from '../test/mockApi'

const loggedIn = { 'GET /auth/me': ok({ user: buildUser() }) }

afterEach(() => restoreApi())

function tileValue(label) {
  const tile = screen.getByRole('heading', { name: label }).closest('article')
  return within(tile).getByText((_, element) => element.classList.contains('status-tile__value'))
}

describe('Inicio: estado del sistema', () => {
  it('muestra servidor y base en línea con la hora en Bogotá', async () => {
    mockApi({ ...loggedIn, 'GET /health': healthyResponse })
    renderApp('/')

    expect(await screen.findByRole('heading', { name: /Bienvenido a El Campesino/ })).toBeInTheDocument()
    await waitFor(() => expect(tileValue('Servidor')).toHaveTextContent('En línea'))
    expect(tileValue('Base de datos')).toHaveTextContent('Disponible')
    expect(tileValue('Hora del servidor')).toHaveTextContent(/16\/11\/2026,? 8:00/)
    expect(tileValue('Zona horaria')).toHaveTextContent('America/Bogota')
  })

  it('si la API no responde muestra "Sin conexión" y el mensaje de error', async () => {
    mockApi({ ...loggedIn, 'GET /health': NETWORK_DOWN })
    renderApp('/')

    expect(await screen.findByRole('alert')).toHaveTextContent('No hay conexión con el servidor')
    expect(tileValue('Servidor')).toHaveTextContent('Sin conexión')
    expect(tileValue('Base de datos')).toHaveTextContent('No disponible')
  })

  it('si solo la base falla (503) el servidor sigue en línea', async () => {
    mockApi({ ...loggedIn, 'GET /health': fail(503, 'SERVICE_UNAVAILABLE', 'La base de datos no está disponible') })
    renderApp('/')

    expect(await screen.findByRole('alert')).toHaveTextContent('La base de datos no está disponible')
    expect(tileValue('Servidor')).toHaveTextContent('En línea')
    expect(tileValue('Base de datos')).toHaveTextContent('No disponible')
  })

  it('si una verificación falla después de una exitosa, no sigue mostrando "En línea"', async () => {
    const user = userEvent.setup()
    let healthCalls = 0
    mockApi({ ...loggedIn, 'GET /health': () => (++healthCalls === 1 ? healthyResponse : NETWORK_DOWN) })
    renderApp('/')
    await waitFor(() => expect(tileValue('Servidor')).toHaveTextContent('En línea'))

    await user.click(screen.getByRole('button', { name: 'Verificar' }))

    await waitFor(() => expect(tileValue('Servidor')).toHaveTextContent('Sin conexión'))
    expect(screen.getByText('No se pudo completar la verificación.')).toBeInTheDocument()
  })
})

describe('Layout', () => {
  beforeEach(() => {
    mockApi({ ...loggedIn, 'GET /health': healthyResponse })
  })

  it('muestra el título, el menú, el usuario y la firma de Nexoon', async () => {
    renderApp('/')

    expect(await screen.findByRole('heading', { level: 1, name: 'Inicio' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Inicio' })).toHaveClass('sidebar__link--active')
    expect(screen.getByRole('button', { name: 'Menú de Robinson Barrios' })).toBeInTheDocument()
    expect(screen.getAllByText('Nexoon').length).toBeGreaterThan(0)
    await waitFor(() => expect(document.title).toBe('Inicio · El Campesino'))
  })

  it('el menú lateral se abre con el botón y se cierra con Escape', async () => {
    const user = userEvent.setup()
    renderApp('/')

    const menuButton = await screen.findByRole('button', { name: 'Abrir menú' })
    expect(menuButton).toHaveAttribute('aria-expanded', 'false')

    await user.click(menuButton)
    expect(menuButton).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('complementary', { name: 'Menú principal' })).toHaveClass('sidebar--open')

    await user.keyboard('{Escape}')
    expect(menuButton).toHaveAttribute('aria-expanded', 'false')
  })

  it('una ruta inexistente muestra la página 404 y permite volver al inicio', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/modulo-que-no-existe')

    expect(await screen.findByRole('heading', { name: 'Esta página no existe' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Volver al inicio' }))
    expect(router.state.location.pathname).toBe('/')
  })
})
