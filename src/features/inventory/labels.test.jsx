// Etiquetas con código de barras (D-INV-21) con el backend simulado: buscar, agregar, preparar
// y la vista previa de la hoja.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import JsBarcode from 'jsbarcode'
import { renderApp } from '../../test/renderWithProviders'
import { BASIC_PLAN, buildUser, healthyResponse, mockApi, ok, restoreApi, session } from '../../test/mockApi'

// JsBarcode mide el texto en el SVG y jsdom no sabe medir: se prueba qué se dibuja, no el dibujo
vi.mock('jsbarcode', () => ({ default: vi.fn() }))

const ALL = ['inventory.view', 'inventory.update']
const FEED = {
  id: 5,
  code: 'P-00005',
  name: 'Concentrado cerdos',
  productKind: 'standard',
  unit: { id: 2, name: 'Kilogramo', symbol: 'kg', allowsDecimals: true },
  salePrice: '2600.00',
  barcode: null,
  presentations: [{ id: 3, name: 'Bulto 40 kg', factor: '40.000', salePrice: '100000.00', barcode: '7700000000028', isActive: true, isSoldWhole: true }],
  isActive: true,
}
const LABELS = [
  { productId: 5, presentationId: null, name: 'Concentrado cerdos', presentationName: null, barcode: '2000000000053', price: '2600.00', copies: 2 },
  { productId: 5, presentationId: 3, name: 'Concentrado cerdos', presentationName: 'Bulto 40 kg', barcode: '7700000000028', price: '100000.00', copies: 1 },
]

const page = (rows) => ({ status: 200, body: { success: true, data: rows, meta: { page: 1, pageSize: 20, total: rows.length, totalPages: 1 }, message: 'ok' } })

const baseRoutes = (permissions = ALL) => ({
  'GET /auth/me': session(buildUser({ permissions }), BASIC_PLAN),
  'GET /health': healthyResponse,
  'GET /notifications/unread-count': ok({ unread: 0 }),
  'GET /notifications': page([]),
  'GET /branding': ok({ name: 'Agro El Campo', logo: null }),
  'GET /me/preferences': ok({ theme: 'system' }),
  'GET /products': page([FEED]),
})

beforeEach(() => window.localStorage.clear())
afterEach(() => restoreApi())

/** Busca el concentrado y lo agrega en la unidad y en bulto. */
async function addBoth(user) {
  await user.type(await screen.findByLabelText('Buscar producto'), 'concen')
  const results = await screen.findByRole('list', { name: 'Productos encontrados' })
  await user.click(within(results).getByRole('button', { name: 'kg' }))
  await user.type(screen.getByLabelText('Buscar producto'), 'concen')
  await user.click(within(await screen.findByRole('list', { name: 'Productos encontrados' })).getByRole('button', { name: 'Bulto 40 kg' }))
  return screen.getByRole('region', { name: 'Etiquetas a imprimir' })
}

describe('Etiquetas', () => {
  it('busca y agrega productos: lo que no tiene código avisa que se le creará uno', async () => {
    const user = userEvent.setup()
    const calls = mockApi(baseRoutes())
    renderApp('/inventario/etiquetas')

    const list = await addBoth(user)
    expect(calls.some((call) => call.url === '/products' && call.params?.search === 'concen')).toBe(true)
    expect(within(list).getByText('kg · $ 2.600')).toBeInTheDocument()
    expect(within(list).getByText('Bulto 40 kg · $ 100.000')).toBeInTheDocument()
    // Solo la unidad no tiene código de barras
    expect(within(list).getAllByText('Se le creará un código interno')).toHaveLength(1)
    expect(within(list).getByRole('button', { name: 'Preparar 2 etiquetas' })).toBeInTheDocument()
  })

  it('«Preparar N etiquetas» manda los productos con sus copias y muestra la hoja', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ ...baseRoutes(), 'POST /products/labels': { status: 200, body: { success: true, data: { labels: LABELS, generated: 1 }, message: 'Etiquetas listas: se creó 1 código interno' } } })
    renderApp('/inventario/etiquetas')

    const list = await addBoth(user)
    const copies = within(list).getAllByLabelText('Etiquetas de Concentrado cerdos')[0]
    await user.clear(copies)
    await user.type(copies, '2')
    await user.click(within(list).getByRole('button', { name: 'Preparar 3 etiquetas' }))

    await waitFor(() => expect(calls.some((call) => call.method === 'POST' && call.url === '/products/labels')).toBe(true))
    expect(calls.find((call) => call.method === 'POST').data).toEqual({
      items: [
        { productId: 5, presentationId: null, copies: 2 },
        { productId: 5, presentationId: 3, copies: 1 },
      ],
    })
    expect(await screen.findByText('Etiquetas listas: se creó 1 código interno')).toBeInTheDocument()

    const sheet = screen.getByRole('region', { name: 'Vista previa de la hoja' })
    expect(within(sheet).getAllByText('Concentrado cerdos')).toHaveLength(3)
    expect(within(sheet).getAllByText('$ 2.600')).toHaveLength(2)
    expect(within(sheet).getByText('$ 100.000')).toBeInTheDocument()
    expect(within(sheet).getByText('Bulto 40 kg')).toBeInTheDocument()
    expect(within(sheet).getAllByRole('img', { name: 'Código de barras 2000000000053' })).toHaveLength(2)
    // Los códigos de 13 dígitos se dibujan como EAN-13
    expect(JsBarcode).toHaveBeenCalledWith(expect.anything(), '7700000000028', expect.objectContaining({ format: 'EAN13' }))
    expect(screen.getByRole('button', { name: 'Imprimir' })).toBeInTheDocument()
  })

  it('quitar un producto lo saca de la lista', async () => {
    const user = userEvent.setup()
    mockApi(baseRoutes())
    renderApp('/inventario/etiquetas')

    const list = await addBoth(user)
    await user.click(within(list).getAllByRole('button', { name: 'Quitar Concentrado cerdos' })[0])
    expect(within(list).queryByText('kg · $ 2.600')).not.toBeInTheDocument()
    expect(within(list).getByRole('button', { name: 'Preparar 1 etiqueta' })).toBeInTheDocument()
  })
})
