// Fase 4 — Pantallas de configuración con el backend simulado.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '../../test/renderWithProviders'
import { buildUser, fail, healthyResponse, mockApi, ok, restoreApi, session } from '../../test/mockApi'

const SETTINGS_PERMISSIONS = ['settings.update', 'settings.tax', 'payment_methods.manage', 'units.manage', 'document_sequences.manage']
const admin = buildUser({ permissions: SETTINGS_PERMISSIONS })

const VALUES = {
  'business.name': 'Agropecuaria El Campo',
  'business.nit': null,
  'business.address': null,
  'business.phone': null,
  'business.email': null,
  'business.whatsapp': null,
  'business.social': null,
  'tax.enabled': false,
  'tax.prices_include_tax': true,
  'rounding.increment': 1,
  'receipt.paper_format': '80mm',
  'receipt.show_logo': true,
  'receipt.tax_regime_text': null,
  'receipt.footer_message': 'Gracias por su compra',
  'receipt_email.enabled': false,
  'receipt_email.subject': 'Comprobante de tu compra en {negocio}',
  'receipt_email.message': 'Hola {cliente}',
  'receipt_email.reply_to': null,
}
const FIXED = {
  currency: 'COP',
  timezone: 'America/Bogota',
  receiptTitle: 'Comprobante de venta',
  legalNotice: 'Documento comercial interno. No es una factura electrónica.',
  taxRegimeText: 'No responsable de IVA',
}
const settingsResponse = (values = {}, logo = null) => ok({ values: { ...VALUES, ...values }, fixed: FIXED, logo })

const METHODS = [
  { id: 1, name: 'Efectivo', isCash: true, requiresReference: false, isSystem: true, isActive: true, sortOrder: 1 },
  { id: 2, name: 'Nequi', isCash: false, requiresReference: true, isSystem: false, isActive: true, sortOrder: 3 },
  { id: 3, name: 'Tarjeta', isCash: false, requiresReference: false, isSystem: false, isActive: false, sortOrder: 5 },
]
const UNITS = [
  { id: 1, name: 'Kilogramo', symbol: 'kg', allowsDecimals: true, isActive: true },
  { id: 2, name: 'Unidad', symbol: 'und', allowsDecimals: false, isActive: true },
]
const SEQUENCES = [
  { id: 1, branch: { id: 1, code: 'MAIN', name: 'Sede principal' }, documentType: 'sale', documentName: 'Ventas', prefix: 'V', nextNumber: 124, preview: 'V-000124' },
  { id: 2, branch: { id: 1, code: 'MAIN', name: 'Sede principal' }, documentType: 'purchase', documentName: 'Compras', prefix: 'C', nextNumber: 1, preview: 'C-000001' },
]

const baseRoutes = (user = admin) => ({
  'GET /auth/me': session(user),
  'GET /health': healthyResponse,
  'GET /notifications/unread-count': ok({ unread: 0 }),
  'GET /branding': ok({ name: 'Agropecuaria El Campo', logo: null }),
  'GET /me/preferences': ok({ theme: 'system' }),
  'GET /settings': settingsResponse(),
})

afterEach(() => {
  restoreApi()
  delete document.documentElement.dataset.theme
  window.localStorage.clear()
})

describe('menú de configuración', () => {
  it('muestra solo las pantallas que el usuario puede usar', async () => {
    mockApi(baseRoutes(buildUser({ permissions: ['units.manage'] })))
    renderApp('/')

    const nav = await screen.findByRole('navigation')
    expect(within(nav).getByRole('link', { name: 'Unidades de medida' })).toBeInTheDocument()
    expect(within(nav).queryByRole('link', { name: 'IVA y redondeo' })).not.toBeInTheDocument()
    expect(within(nav).queryByRole('link', { name: 'Negocio y comprobante' })).not.toBeInTheDocument()
  })

  it('el menú lateral muestra el nombre del negocio', async () => {
    mockApi(baseRoutes())
    renderApp('/')
    expect(await screen.findByText('Agropecuaria El Campo')).toBeInTheDocument()
  })
})

describe('negocio y comprobante', () => {
  it('guarda solo lo que cambió y la vista previa se actualiza mientras se escribe', async () => {
    const user = userEvent.setup()
    const calls = mockApi({
      ...baseRoutes(),
      'PATCH /settings': (call) => settingsResponse(call.data.values),
    })
    renderApp('/configuracion/negocio')

    const name = await screen.findByLabelText('Nombre comercial')
    expect(name).toHaveValue('Agropecuaria El Campo')
    // Sin cambios no hay barra de guardado
    expect(screen.queryByText(/sin guardar/)).not.toBeInTheDocument()

    await user.clear(name)
    await user.type(name, 'Agro Robinson')
    await user.type(screen.getByLabelText('NIT'), '900123456-7')
    expect(screen.getByText('Tienes 2 cambios sin guardar')).toBeInTheDocument()
    // La tirilla de ejemplo ya muestra los datos nuevos
    const preview = screen.getByRole('figure')
    expect(within(preview).getByText('Agro Robinson')).toBeInTheDocument()
    expect(within(preview).getByText('NIT 900123456-7')).toBeInTheDocument()
    expect(within(preview).getByText('Documento comercial interno. No es una factura electrónica.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByText('Configuración guardada')).toBeInTheDocument()
    expect(calls.find((call) => call.method === 'PATCH').data).toEqual({
      values: { 'business.name': 'Agro Robinson', 'business.nit': '900123456-7' },
    })
    await waitFor(() => expect(screen.queryByText(/sin guardar/)).not.toBeInTheDocument())
  })

  it('muestra el error del servidor junto al campo (la clave del ajuste)', async () => {
    const user = userEvent.setup()
    mockApi({
      ...baseRoutes(),
      'PATCH /settings': fail(400, 'VALIDATION_ERROR', 'Los datos enviados no son válidos', [
        { field: 'business.nit', message: 'El NIT debe tener de 5 a 15 dígitos' },
      ]),
    })
    renderApp('/configuracion/negocio')

    await user.type(await screen.findByLabelText('NIT'), 'ABC')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByText('El NIT debe tener de 5 a 15 dígitos')).toBeInTheDocument()
    expect(screen.getByLabelText('NIT')).toHaveAttribute('aria-invalid', 'true')
  })

  it('"Descartar" vuelve a los valores guardados', async () => {
    const user = userEvent.setup()
    mockApi(baseRoutes())
    renderApp('/configuracion/negocio')

    const name = await screen.findByLabelText('Nombre comercial')
    await user.type(name, ' SAS')
    await user.click(screen.getByRole('button', { name: 'Descartar' }))
    expect(name).toHaveValue('Agropecuaria El Campo')
  })

  it('el envío por correo muestra sus campos al activarlo e inserta marcadores', async () => {
    const user = userEvent.setup()
    mockApi(baseRoutes())
    renderApp('/configuracion/negocio')

    expect(await screen.findByRole('switch', { name: 'Permitir enviar comprobantes por correo' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.queryByLabelText(/^Asunto/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('switch', { name: 'Permitir enviar comprobantes por correo' }))
    expect(screen.getByLabelText(/^Asunto/)).toHaveValue('Comprobante de tu compra en {negocio}')

    await user.click(screen.getByRole('button', { name: '{numero}' }))
    expect(screen.getByLabelText(/^Mensaje$/)).toHaveValue('Hola {cliente} {numero}')
    // Vista previa del correo con datos de ejemplo
    expect(screen.getByText('Comprobante de tu compra en Agropecuaria El Campo')).toBeInTheDocument()
  })

  it('sube el logo al elegirlo y rechaza archivos que no son imágenes sin llamar a la API', async () => {
    const user = userEvent.setup({ applyAccept: false })
    const calls = mockApi({
      ...baseRoutes(),
      'PUT /settings/logo': ok({ logo: { mimeType: 'image/png', size: 10, updatedAt: '2026-11-17T00:00:00.000Z', version: 1 } }),
    })
    renderApp('/configuracion/negocio')

    const input = await screen.findByLabelText('Archivo del logo')
    await user.upload(input, new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' }))
    expect(screen.getByRole('alert')).toHaveTextContent('El logo debe ser una imagen PNG, JPG o WEBP')
    expect(calls.some((call) => call.url === '/settings/logo')).toBe(false)

    await user.upload(input, new File([new Uint8Array([137, 80, 78, 71])], 'logo.png', { type: 'image/png' }))
    expect(await screen.findByText('Logo actualizado')).toBeInTheDocument()
    const upload = calls.find((call) => call.url === '/settings/logo')
    expect(upload.method).toBe('PUT')
    expect(upload.data).toBeInstanceOf(FormData)
    expect(upload.data.get('logo').name).toBe('logo.png')
  })
})

describe('IVA y redondeo', () => {
  it('cambiar cómo se interpretan los precios pide confirmación y la envía', async () => {
    const user = userEvent.setup()
    const calls = mockApi({
      ...baseRoutes(),
      'GET /settings': settingsResponse({ 'tax.enabled': true }),
      'PATCH /settings': (call) => settingsResponse({ 'tax.enabled': true, ...call.data.values }),
    })
    renderApp('/configuracion/impuestos')

    await user.click(await screen.findByRole('radio', { name: /El IVA se suma al precio/ }))
    await user.click(screen.getByRole('radio', { name: /A \$ 50/ }))
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    const dialog = await screen.findByRole('dialog', { name: 'Cambiar cómo se interpretan los precios' })
    expect(calls.some((call) => call.method === 'PATCH')).toBe(false)
    await user.click(within(dialog).getByRole('button', { name: 'Sí, cambiarlo' }))

    expect(await screen.findByText('Configuración de IVA y redondeo guardada')).toBeInTheDocument()
    expect(calls.find((call) => call.method === 'PATCH').data).toEqual({
      values: { 'tax.prices_include_tax': false, 'rounding.increment': 50 },
      confirmTaxChange: true,
    })
  })

  it('el redondeo solo se guarda sin confirmación; con el IVA apagado no se pregunta por los precios', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ ...baseRoutes(), 'PATCH /settings': (call) => settingsResponse(call.data.values) })
    renderApp('/configuracion/impuestos')

    expect(await screen.findByRole('switch', { name: 'Cobrar IVA en las ventas' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.queryByRole('radio', { name: /Mis precios ya incluyen/ })).not.toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: /A la centena/ }))
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await screen.findByText('Configuración de IVA y redondeo guardada')
    expect(calls.find((call) => call.method === 'PATCH').data).toEqual({ values: { 'rounding.increment': 100 } })
  })
})

describe('métodos de pago', () => {
  it('lista también los inactivos; el efectivo no se puede desactivar', async () => {
    const calls = mockApi({ ...baseRoutes(), 'GET /payment-methods': ok(METHODS) })
    renderApp('/configuracion/metodos-de-pago')

    expect(await screen.findByText('Cuenta en la caja')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Efectivo no se puede desactivar' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Activar Tarjeta' })).toBeEnabled()
    expect(calls.find((call) => call.url === '/payment-methods').params).toEqual({ includeInactive: 'true' })
  })

  it('crea un método nuevo y la vista previa lo ubica según el orden', async () => {
    const user = userEvent.setup()
    const calls = mockApi({
      ...baseRoutes(),
      'GET /payment-methods': ok(METHODS),
      'POST /payment-methods': (call) => ok({ id: 9, isCash: false, isSystem: false, isActive: true, ...call.data }),
    })
    renderApp('/configuracion/metodos-de-pago')

    await user.click(await screen.findByRole('button', { name: 'Nuevo método' }))
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo método de pago' })
    await user.type(within(dialog).getByLabelText(/^Nombre/), 'Bancolombia QR')
    await user.clear(within(dialog).getByLabelText('Orden'))
    await user.type(within(dialog).getByLabelText('Orden'), '2')
    await user.click(within(dialog).getByRole('switch', { name: 'Pedir número de referencia' }))

    // Vista previa: Efectivo (1), el nuevo (2), Nequi (3). Tarjeta está inactiva: no aparece
    const buttons = within(dialog).getAllByRole('listitem').map((item) => item.textContent)
    expect(buttons[0]).toMatch(/Efectivo/)
    expect(buttons[1]).toMatch(/Bancolombia QR/)
    expect(buttons.join()).not.toMatch(/Tarjeta/)

    await user.click(within(dialog).getByRole('button', { name: 'Crear método' }))
    await waitFor(() => expect(calls.some((call) => call.method === 'POST')).toBe(true))
    expect(calls.find((call) => call.method === 'POST').data).toEqual({ name: 'Bancolombia QR', sortOrder: 2, requiresReference: true })
  })

  it('al editar el efectivo no se puede pedir referencia', async () => {
    const user = userEvent.setup()
    mockApi({ ...baseRoutes(), 'GET /payment-methods': ok(METHODS) })
    renderApp('/configuracion/metodos-de-pago')

    await user.click(await screen.findByRole('button', { name: 'Editar Efectivo' }))
    const dialog = await screen.findByRole('dialog', { name: 'Editar método de pago' })
    expect(within(dialog).getByRole('switch', { name: 'Pedir número de referencia' })).toBeDisabled()
  })
})

describe('unidades de medida', () => {
  it('valida la abreviatura y crea la unidad', async () => {
    const user = userEvent.setup()
    const calls = mockApi({
      ...baseRoutes(),
      'GET /units': ok(UNITS),
      'POST /units': (call) => ok({ id: 5, isActive: true, ...call.data }),
    })
    renderApp('/configuracion/unidades')

    await user.click(await screen.findByRole('button', { name: 'Nueva unidad' }))
    const dialog = await screen.findByRole('dialog', { name: 'Nueva unidad de medida' })
    await user.type(within(dialog).getByLabelText(/^Nombre/), 'Dosis')
    await user.type(within(dialog).getByLabelText(/^Abreviatura/), 'do sis')
    await user.click(within(dialog).getByRole('radio', { name: /Solo enteros/ }))
    await user.click(within(dialog).getByRole('button', { name: 'Crear unidad' }))

    expect(within(dialog).getByText(/sin espacios/)).toBeInTheDocument()
    expect(calls.some((call) => call.method === 'POST')).toBe(false)

    await user.clear(within(dialog).getByLabelText(/^Abreviatura/))
    await user.type(within(dialog).getByLabelText(/^Abreviatura/), 'dosis')
    // La vista previa refleja "solo enteros"
    expect(within(dialog).getByText(/Solo cantidades enteras/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Crear unidad' }))

    expect(await screen.findByText('Dosis creada')).toBeInTheDocument()
    expect(calls.find((call) => call.method === 'POST').data).toEqual({ name: 'Dosis', symbol: 'dosis', allowsDecimals: false })
  })

  it('muestra el error de duplicado del servidor en el campo', async () => {
    const user = userEvent.setup()
    mockApi({
      ...baseRoutes(),
      'GET /units': ok(UNITS),
      'POST /units': fail(409, 'CONFLICT', 'Ya existe una unidad con esa abreviatura', [
        { field: 'symbol', message: 'Ya existe una unidad con esa abreviatura' },
      ]),
    })
    renderApp('/configuracion/unidades')

    await user.click(await screen.findByRole('button', { name: 'Nueva unidad' }))
    const dialog = await screen.findByRole('dialog', { name: 'Nueva unidad de medida' })
    await user.type(within(dialog).getByLabelText(/^Nombre/), 'Kilo')
    await user.type(within(dialog).getByLabelText(/^Abreviatura/), 'KG')
    await user.click(within(dialog).getByRole('button', { name: 'Crear unidad' }))

    expect(await within(dialog).findByText('Ya existe una unidad con esa abreviatura')).toBeInTheDocument()
  })
})

describe('consecutivos', () => {
  it('muestra el próximo número y no deja bajarlo', async () => {
    const user = userEvent.setup()
    const calls = mockApi({
      ...baseRoutes(),
      'GET /document-sequences': ok(SEQUENCES),
      'PATCH /document-sequences/1': (call) => ok({ ...SEQUENCES[0], prefix: call.data.prefix, nextNumber: call.data.nextNumber, preview: 'FV-001250' }),
    })
    renderApp('/configuracion/consecutivos')

    expect(await screen.findByText('V-000124')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Editar el consecutivo de Ventas' }))
    const dialog = await screen.findByRole('dialog', { name: 'Consecutivo de ventas' })

    const number = within(dialog).getByLabelText(/^Próximo número/)
    await user.clear(number)
    await user.type(number, '100')
    await user.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }))
    expect(within(dialog).getByText('Solo puede aumentar: ya se va en el 124')).toBeInTheDocument()
    expect(calls.some((call) => call.method === 'PATCH')).toBe(false)

    // El prefijo se escribe en mayúsculas y la ficha muestra cómo quedará
    await user.clear(within(dialog).getByLabelText('Prefijo'))
    await user.type(within(dialog).getByLabelText('Prefijo'), 'fv')
    await user.clear(number)
    await user.type(number, '1250')
    expect(within(dialog).getByText('FV-001250')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByText('Ventas: el próximo será FV-001250')).toBeInTheDocument()
    expect(calls.find((call) => call.method === 'PATCH').data).toEqual({ prefix: 'FV', nextNumber: 1250 })
  })
})

describe('apariencia y marca', () => {
  it('el usuario elige el modo oscuro: se aplica al instante y se guarda en su perfil', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ ...baseRoutes(), 'PATCH /me/preferences': (call) => ok({ theme: call.data.theme }) })
    renderApp('/')

    await user.click(await screen.findByRole('button', { name: /Menú de Robinson Barrios/ }))
    await user.click(screen.getByRole('menuitemradio', { name: 'Oscuro' }))

    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('dark'))
    expect(screen.getByRole('menuitemradio', { name: 'Oscuro' })).toHaveAttribute('aria-checked', 'true')
    expect(calls.find((call) => call.method === 'PATCH').data).toEqual({ theme: 'dark' })
    expect(window.localStorage.getItem('nexsupply.theme')).toBe('dark')
  })

  it('la pantalla de inicio de sesión muestra la marca del negocio', async () => {
    mockApi({
      'GET /auth/me': fail(401, 'UNAUTHORIZED', 'Debes iniciar sesión'),
      'POST /auth/refresh': fail(401, 'UNAUTHORIZED', 'Debes iniciar sesión'),
      'GET /branding': ok({ name: 'Agropecuaria El Campo', logo: { mimeType: 'image/png', size: 10, updatedAt: 'x', version: 42 } }),
    })
    renderApp('/iniciar-sesion')

    const logo = await screen.findByRole('img', { name: 'Logo de Agropecuaria El Campo' })
    expect(logo).toHaveAttribute('src', '/api/v1/branding/logo?v=42')
    expect(screen.getByText('Agropecuaria El Campo')).toBeInTheDocument()
  })
})
