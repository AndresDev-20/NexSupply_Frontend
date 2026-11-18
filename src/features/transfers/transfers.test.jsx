// Fase 18 — Transferencias entre sedes: enviar, recibir con diferencias y anular.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '../../test/renderWithProviders'
import { BASIC_PLAN, buildUser, healthyResponse, mockApi, ok, restoreApi, session } from '../../test/mockApi'

const INTERMEDIATE = { ...BASIC_PLAN, code: 'intermediate', name: 'Intermedio', features: [...BASIC_PLAN.features, 'inventory', 'branch_transfers'], limits: { maxBranches: null } }
const CENTRO = { id: 1, code: 'MAIN', name: 'Centro' }
const NORTE = { id: 2, code: 'NOR', name: 'Norte' }
const ALL = ['transfers.view', 'transfers.send', 'transfers.receive', 'transfers.cancel', 'inventory.view', 'inventory.cost_view']

const page = (rows, meta = {}) => ({ status: 200, body: { success: true, data: rows, meta: { page: 1, pageSize: 20, total: rows.length, totalPages: 1, ...meta }, message: 'ok' } })

const PRODUCT = {
  id: 5,
  code: 'P-00005',
  name: 'Concentrado cerdos',
  unit: { id: 1, name: 'Kilogramo', symbol: 'kg', allowsDecimals: true },
  stock: '400.000',
  reservedStock: '100.000',
  tracksBatches: false,
  isActive: true,
  presentations: [{ id: 9, name: 'Bulto 40 kg', factor: '40.000', isActive: true }],
}

const ITEM = { id: 70, productId: 5, productCode: 'P-00005', productName: 'Concentrado cerdos', unitSymbol: 'kg', presentationName: 'Bulto 40 kg', factor: '40.000', quantity: '10.000', baseQuantity: '400.000', unitCost: '2000.0000', batches: null, receivedQuantity: '0.000', damagedQuantity: '0.000', missingQuantity: '0.000', differenceReason: null }

function transfer(overrides = {}) {
  return {
    id: 3,
    number: 'TR-000003',
    direction: 'incoming',
    origin: NORTE,
    destination: CENTRO,
    status: 'in_transit',
    statusLabel: 'En camino',
    notes: null,
    costTotal: '800000.00',
    missingCost: '0.00',
    damagedCost: '0.00',
    hasDifferences: false,
    sentAt: '2026-11-17T15:00:00.000Z',
    sentBy: { id: 4, fullName: 'Pedro Gómez' },
    receivedAt: null,
    receivedBy: null,
    cancelledAt: null,
    cancelledBy: null,
    cancelReason: null,
    items: [ITEM],
    ...overrides,
  }
}

function routes(permissions = ALL, overrides = {}) {
  return {
    'GET /auth/me': session(buildUser({ permissions, branch: CENTRO }), INTERMEDIATE, [CENTRO, NORTE]),
    'GET /health': healthyResponse,
    'GET /notifications/unread-count': ok({ unread: 0 }),
    'GET /notifications': page([]),
    'GET /branding': ok({ name: 'Agro El Campo', logo: null }),
    'GET /me/preferences': ok({ theme: 'system' }),
    'GET /transfers': page([transfer()], { summary: { pendingToReceive: 1, inTransitSent: 0 } }),
    'GET /transfers/3': ok(transfer()),
    'GET /transfers/destinations': ok([NORTE]),
    'GET /products': page([PRODUCT]),
    ...overrides,
  }
}

afterEach(() => restoreApi())

describe('menú', () => {
  it('Transferencias aparece solo en el plan intermedio', async () => {
    mockApi(routes())
    const first = renderApp('/')
    const nav = await screen.findByRole('complementary', { name: 'Menú principal' })
    expect(within(nav).getByRole('link', { name: 'Transferencias' })).toBeInTheDocument()
    first.unmount()

    mockApi(routes(ALL, { 'GET /auth/me': session(buildUser({ permissions: ALL, branch: CENTRO }), { ...BASIC_PLAN, features: [...BASIC_PLAN.features, 'inventory'] }, [CENTRO]) }))
    renderApp('/')
    const basicNav = await screen.findByRole('complementary', { name: 'Menú principal' })
    expect(within(basicNav).queryByRole('link', { name: 'Transferencias' })).not.toBeInTheDocument()
  })
})

describe('enviar', () => {
  it('escoge la sede, agrega productos en su presentación y envía una sola vez', async () => {
    const user = userEvent.setup()
    const calls = mockApi(
      routes(ALL, {
        'POST /transfers': () => ({ status: 201, body: { success: true, data: transfer({ id: 4, number: 'TR-000004', direction: 'outgoing', origin: CENTRO, destination: NORTE }), message: 'Transferencia TR-000004 enviada a Norte' } }),
      }),
    )
    renderApp('/inventario/transferencias')
    await user.click(await screen.findByRole('button', { name: 'Enviar mercancía' }))
    const dialog = await screen.findByRole('dialog', { name: 'Enviar mercancía a otra sede' })

    // Sin datos no envía
    await user.click(within(dialog).getByRole('button', { name: 'Enviar' }))
    expect(within(dialog).getByText('Escoge a qué sede va')).toBeInTheDocument()
    expect(within(dialog).getByText('Agrega al menos un producto')).toBeInTheDocument()

    await user.selectOptions(within(dialog).getByLabelText('Sede de destino'), '2')
    await user.type(within(dialog).getByLabelText('Agregar producto'), 'conc')
    await user.click(await within(dialog).findByRole('option', { name: /Concentrado cerdos/ }))
    // Disponible = existencia − apartado; propone el bulto
    expect(within(dialog).getByText(/disponible 300 kg/)).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Va en')).toHaveValue('9')
    await user.type(within(dialog).getByLabelText('Cantidad'), '5')
    expect(within(dialog).getByText('= 200 kg')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Enviar' }))

    expect(await screen.findByText('Transferencia TR-000004 enviada a Norte')).toBeInTheDocument()
    const sent = calls.filter((call) => call.method === 'POST' && call.url === '/transfers')
    expect(sent).toHaveLength(1)
    expect(sent[0].data).toMatchObject({ destinationBranchId: 2, notes: null, items: [{ productId: 5, presentationId: 9, quantity: '5' }] })
    expect(sent[0].data.idempotencyKey).toEqual(expect.any(String))
    // Pasa a la pestaña de enviadas
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Enviadas' })).toHaveAttribute('aria-selected', 'true'))
  })
})

describe('recibir', () => {
  it('por defecto todo llegó bien; con diferencias pide el motivo y envía bueno, dañado y faltante', async () => {
    const user = userEvent.setup()
    const calls = mockApi(
      routes(ALL, {
        'POST /transfers/3/receive': ok(transfer({ status: 'received', statusLabel: 'Recibida', hasDifferences: true }), 'Transferencia TR-000003 recibida con diferencias'),
      }),
    )
    renderApp('/inventario/transferencias')
    expect(within(await screen.findByRole('region', { name: 'Resumen de transferencias' })).getByText('1')).toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: 'Recibir' }))
    const dialog = await screen.findByRole('dialog', { name: 'Transferencia TR-000003' })
    await user.click(within(dialog).getByRole('button', { name: 'Recibir' }))

    const good = within(dialog).getByLabelText('Llegó bueno')
    expect(good).toHaveValue('10')
    expect(within(dialog).getByRole('button', { name: 'Todo llegó bien: recibir' })).toBeInTheDocument()

    await user.clear(good)
    await user.type(good, '8')
    await user.type(within(dialog).getByLabelText('Llegó dañado'), '1')
    expect(within(dialog).getByText(/faltan 1/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Recibir con diferencias' }))
    expect(within(dialog).getByText('Escribe qué pasó')).toBeInTheDocument()

    await user.type(within(dialog).getByLabelText('¿Qué pasó?'), 'Un bulto roto y otro no venía')
    await user.click(within(dialog).getByRole('button', { name: 'Recibir con diferencias' }))
    expect(await screen.findByText('Transferencia TR-000003 recibida con diferencias')).toBeInTheDocument()
    expect(calls.find((call) => call.method === 'POST' && call.url === '/transfers/3/receive').data).toEqual({
      notes: null,
      items: [{ itemId: 70, receivedQuantity: '8', damagedQuantity: '1', reason: 'Un bulto roto y otro no venía' }],
    })
  })

  it('sin permiso de recibir solo se ve el detalle', async () => {
    const user = userEvent.setup()
    mockApi(routes(['transfers.view']))
    renderApp('/inventario/transferencias')
    await user.click(await screen.findByRole('button', { name: 'Ver TR-000003' }))
    const dialog = await screen.findByRole('dialog', { name: 'Transferencia TR-000003' })
    expect(within(dialog).queryByRole('button', { name: 'Recibir' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Enviar mercancía' })).not.toBeInTheDocument()
  })
})

describe('anular', () => {
  it('lo enviado que sigue en camino se anula con motivo', async () => {
    const user = userEvent.setup()
    const outgoing = transfer({ direction: 'outgoing', origin: CENTRO, destination: NORTE })
    const calls = mockApi(
      routes(ALL, {
        'GET /transfers': page([outgoing], { summary: { pendingToReceive: 0, inTransitSent: 1 } }),
        'GET /transfers/3': ok(outgoing),
        'POST /transfers/3/cancel': ok({ ...outgoing, status: 'cancelled', statusLabel: 'Anulada' }, 'Transferencia TR-000003 anulada: la mercancía volvió al inventario'),
      }),
    )
    renderApp('/inventario/transferencias')
    await user.click(await screen.findByRole('tab', { name: 'Enviadas' }))
    await user.click(await screen.findByRole('button', { name: 'Ver TR-000003' }))
    const dialog = await screen.findByRole('dialog', { name: 'Transferencia TR-000003' })
    expect(within(dialog).queryByRole('button', { name: 'Recibir' })).not.toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Anular envío' }))
    const reason = await screen.findByRole('dialog', { name: 'Anular TR-000003' })
    await user.type(within(reason).getByLabelText('Motivo'), 'El camión no salió')
    await user.click(within(reason).getByRole('button', { name: 'Anular envío' }))
    expect(await screen.findByText('Transferencia TR-000003 anulada: la mercancía volvió al inventario')).toBeInTheDocument()
    expect(calls.find((call) => call.method === 'POST' && call.url === '/transfers/3/cancel').data).toEqual({ reason: 'El camión no salió' })
  })
})
