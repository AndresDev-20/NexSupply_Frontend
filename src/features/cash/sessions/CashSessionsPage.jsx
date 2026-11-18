import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, HandCoins, Lock, Power } from 'lucide-react'
import { useGetCashRegistersQuery, useGetCashSessionsQuery } from '../cashApi'
import { SESSION_STATUS_OPTIONS, differenceInfo, sessionState } from '../cashOptions'
import { SessionActionDialogs } from './SessionActions'
import { useSessionPermissions } from '../useSessionPermissions'
import { PageHeader } from '../../../components/layout/PageHeader/PageHeader'
import { FilterBar } from '../../../components/layout/FilterBar/FilterBar'
import { TextField } from '../../../components/ui/TextField/TextField'
import { SelectField } from '../../../components/ui/SelectField/SelectField'
import { DataTable } from '../../../components/ui/DataTable/DataTable'
import { Pagination } from '../../../components/ui/Pagination/Pagination'
import { IconButton } from '../../../components/ui/IconButton/IconButton'
import { Badge } from '../../../components/ui/Badge/Badge'
import { formatCurrency, formatDateTime } from '../../../utils/format'
import { cashSessionPath } from '../../../routes/paths'
import '../cash.css'

const STATUS_TABS = [{ value: '', label: 'Todos' }, ...SESSION_STATUS_OPTIONS]

/**
 * Turnos de las cajas de la sucursal (D-CAJA-10): el ojo muestra el turno (lo vendido y sus
 * movimientos), el candado cuenta la caja y la mano marca el dinero como recibido.
 */
export default function CashSessionsPage() {
  const navigate = useNavigate()
  const perms = useSessionPermissions()
  const [status, setStatus] = useState('')
  const [registerId, setRegisterId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [action, setAction] = useState(null)
  const { data: registers = [] } = useGetCashRegistersQuery()
  const params = { page, pageSize: 20, ...(status && { status }), ...(registerId && { registerId }), ...(from && { from }), ...(to && { to }) }
  const { data, error, isFetching, refetch } = useGetCashSessionsQuery(params)

  const reset = (setter) => (value) => {
    setter(value)
    setPage(1)
  }

  const columns = [
    {
      key: 'register',
      header: 'Turno',
      primary: true,
      render: (row) => (
        <span className="cash-stack">
          <span className="cash-link__name">{row.register?.name}</span>
          <span className="cash-stack__detail">{row.closingNumber ?? 'Sin contar'}</span>
        </span>
      ),
    },
    {
      key: 'opened',
      header: 'Apertura',
      render: (row) => (
        <span className="cash-stack">
          <span>{formatDateTime(row.openedAt)}</span>
          <span className="cash-stack__detail">{row.openedBy?.fullName ?? 'Sistema'}</span>
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Estado',
      render: (row) => {
        const state = sessionState(row)
        return (
          <span className={`status-pill status-pill--${state.tone}`}>
            <span className="status-pill__dot" aria-hidden="true" />
            {state.label}
          </span>
        )
      },
    },
    { key: 'counted', header: 'Contado', align: 'end', render: (row) => (row.countedCash ? formatCurrency(row.countedCash) : '—') },
    {
      key: 'difference',
      header: 'Diferencia',
      render: (row) => {
        const diff = differenceInfo(row.difference)
        if (!diff) return '—'
        return <Badge tone={diff.tone}>{diff.label === 'Cuadrada' ? 'Cuadrada' : `${diff.label} ${diff.amount}`}</Badge>
      },
    },
    { key: 'deliver', header: 'Para entregar', align: 'end', render: (row) => (row.cashWithdrawn ? <strong>{formatCurrency(row.cashWithdrawn)}</strong> : '—') },
    {
      key: 'actions',
      header: 'Acciones',
      align: 'end',
      render: (row) => (
        <div className="row-actions">
          <IconButton icon={Eye} label={`Ver turno de ${row.register?.name}`} onClick={() => navigate(cashSessionPath(row.id))} />
          {perms.canCut(row) && <IconButton icon={Power} tone="danger" label={`Cerrar turno de ${row.register?.name}`} onClick={() => setAction({ type: 'cut', session: row })} />}
          {perms.canCount(row) && <IconButton icon={Lock} tone="success" label={`Contar caja de ${row.register?.name}`} onClick={() => setAction({ type: 'count', session: row })} />}
          {perms.canReceive(row) && <IconButton icon={HandCoins} tone="success" label={`Recibir dinero de ${row.closingNumber}`} onClick={() => setAction({ type: 'receive', session: row })} />}
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader description="Todos los turnos de tus cajas. Ábrelos con el ojo, cuéntalos con el candado y marca el dinero como recibido." />

      <div className="segmented" role="tablist" aria-label="Estado de los turnos">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value || 'all'}
            type="button"
            role="tab"
            aria-selected={status === tab.value}
            className={`segmented__option${status === tab.value ? ' segmented__option--active' : ''}`}
            onClick={() => reset(setStatus)(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <FilterBar even>
        <SelectField label="Caja" placeholder="Todas las cajas" options={registers.map((register) => ({ value: String(register.id), label: register.name }))} value={registerId} onChange={(event) => reset(setRegisterId)(event.target.value)} />
        <TextField label="Desde" type="date" value={from} max={to || undefined} onChange={(event) => reset(setFrom)(event.target.value)} />
        <TextField label="Hasta" type="date" value={to} min={from || undefined} onChange={(event) => reset(setTo)(event.target.value)} />
      </FilterBar>

      <DataTable
        caption="Turnos"
        columns={columns}
        rows={data?.rows ?? []}
        isLoading={isFetching}
        error={error}
        onRetry={refetch}
        emptyTitle={status || registerId || from || to ? 'No hay turnos con estos filtros' : 'Aún no hay turnos'}
        emptyDescription={status || registerId || from || to ? undefined : 'Los turnos aparecen aquí cuando se abre una caja.'}
      />
      <Pagination meta={data?.pagination} onPageChange={setPage} itemLabel="turnos" />
      <SessionActionDialogs action={action} onClose={() => setAction(null)} />
    </>
  )
}
