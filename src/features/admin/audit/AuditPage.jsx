import { useState } from 'react'
import { Eye, ShieldAlert } from 'lucide-react'
import { useGetAuditLogsQuery } from '../adminApi'
import { PageHeader } from '../../../components/layout/PageHeader/PageHeader'
import { FilterBar } from '../../../components/layout/FilterBar/FilterBar'
import { SelectField } from '../../../components/ui/SelectField/SelectField'
import { TextField } from '../../../components/ui/TextField/TextField'
import { DataTable } from '../../../components/ui/DataTable/DataTable'
import { Pagination } from '../../../components/ui/Pagination/Pagination'
import { IconButton } from '../../../components/ui/IconButton/IconButton'
import { Badge } from '../../../components/ui/Badge/Badge'
import { formatDateTime } from '../../../utils/format'
import { ACTION_LABELS, ENTITY_LABELS, SENSITIVE_ACTIONS, actionLabel } from './auditLabels'
import { AuditDetailModal } from './AuditDetailModal'
import '../admin.css'
import './AuditPage.css'

const ACTION_OPTIONS = Object.entries(ACTION_LABELS).map(([value, label]) => ({ value, label }))

export default function AuditPage() {
  const [action, setAction] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState(null)

  const params = { page, pageSize: 25, ...(action && { action }), ...(from && { from }), ...(to && { to }) }
  const { data, error, isFetching, refetch } = useGetAuditLogsQuery(params)

  const onFilter = (setter) => (event) => {
    setter(event.target.value)
    setPage(1)
  }

  const columns = [
    {
      key: 'action',
      header: 'Acción',
      primary: true,
      render: (log) => (
        <span className={`audit-action${SENSITIVE_ACTIONS.has(log.action) ? ' audit-action--sensitive' : ''}`}>
          {SENSITIVE_ACTIONS.has(log.action) && <ShieldAlert size={16} aria-hidden="true" />}
          {actionLabel(log.action)}
        </span>
      ),
    },
    { key: 'user', header: 'Usuario', render: (log) => log.user?.fullName ?? <span className="u-text-muted">No identificado</span> },
    {
      key: 'entity',
      header: 'Registro',
      render: (log) => (log.entityType ? <Badge>{`${ENTITY_LABELS[log.entityType] ?? log.entityType} #${log.entityId}`}</Badge> : '—'),
    },
    { key: 'date', header: 'Fecha', render: (log) => <span className="u-tabular-nums">{formatDateTime(log.createdAt)}</span> },
    {
      key: 'detail',
      header: 'Detalle',
      align: 'end',
      render: (log) => <IconButton icon={Eye} label={`Ver detalle: ${actionLabel(log.action)}`} onClick={() => setSelected(log)} />,
    },
  ]

  return (
    <>
      <PageHeader description="Registro inalterable de las operaciones importantes: quién hizo qué, cuándo y qué cambió." />

      <FilterBar>
        <SelectField label="Acción" placeholder="Todas las acciones" options={ACTION_OPTIONS} value={action} onChange={onFilter(setAction)} />
        <TextField label="Desde" type="date" value={from} onChange={onFilter(setFrom)} max={to || undefined} />
        <TextField label="Hasta" type="date" value={to} onChange={onFilter(setTo)} min={from || undefined} />
      </FilterBar>

      <DataTable
        caption="Auditoría"
        columns={columns}
        rows={data?.rows ?? []}
        isLoading={isFetching}
        error={error}
        onRetry={refetch}
        emptyTitle="No hay registros con estos filtros"
      />
      <Pagination meta={data?.pagination} onPageChange={setPage} itemLabel="registros" />

      <AuditDetailModal log={selected} onClose={() => setSelected(null)} />
    </>
  )
}
