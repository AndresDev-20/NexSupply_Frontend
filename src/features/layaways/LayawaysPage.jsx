import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlarmClock, Archive, PackageCheck, Search, ShoppingBag, Wallet } from 'lucide-react'
import { useGetLayawaysQuery } from './layawaysApi'
import { LAYAWAY_FILTERS, dueText, layawayPath, layawayTone, paidPercent } from './layawayOptions'
import { useCan } from '../../hooks/usePermissions'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { PageHeader } from '../../components/layout/PageHeader/PageHeader'
import { FilterBar } from '../../components/layout/FilterBar/FilterBar'
import { TextField } from '../../components/ui/TextField/TextField'
import { DataTable } from '../../components/ui/DataTable/DataTable'
import { Pagination } from '../../components/ui/Pagination/Pagination'
import { formatCurrency, formatDateTime } from '../../utils/format'
import { formatDay } from '../purchases/purchaseOptions'
import { ROUTES, customerPath } from '../../routes/paths'
import '../cash/cash.css'
import '../purchases/purchases.css'
import './layaways.css'

/** Barra de avance: cuánto lleva pagado del total. */
export function PaidProgress({ layaway }) {
  const percent = paidPercent(layaway)
  return (
    <span className="layaway-progress" title={`${percent} % pagado`}>
      <span className="layaway-progress__bar" aria-hidden="true">
        <span className={`layaway-progress__fill layaway-progress__fill--${layawayTone(layaway)}`} style={{ width: `${percent}%` }} />
      </span>
      <span className="layaway-progress__text">
        <strong className="numeric">{formatCurrency(layaway.amountPaid)}</strong> de {formatCurrency(layaway.total)}
      </span>
    </span>
  )
}

export function LayawayStatus({ layaway }) {
  return (
    <span className={`status-pill status-pill--${layawayTone(layaway)}`}>
      <span className="status-pill__dot" aria-hidden="true" />
      {layaway.statusLabel}
    </span>
  )
}

/** Apartados (Fase 10b): lo que se está pagando, lo vencido y lo que falta entregar. */
export default function LayawaysPage() {
  const canSell = useCan('sales.create')
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const debouncedSearch = useDebouncedValue(search.trim())
  const params = { page, pageSize: 20, ...(status && { status }), ...(debouncedSearch && { search: debouncedSearch }) }
  const { data, isFetching, error, refetch } = useGetLayawaysQuery(params)
  const summary = data?.summary

  const choose = (value) => {
    setStatus(value)
    setPage(1)
  }

  const columns = [
    {
      key: 'number',
      header: 'Apartado',
      primary: true,
      render: (row) => (
        <span className="cash-stack">
          <Link className="cash-link__name purchase-link" to={layawayPath(row.id)}>
            {row.number}
          </Link>
          <span className="cash-stack__detail">{formatDateTime(row.createdAt)}</span>
        </span>
      ),
    },
    { key: 'customer', header: 'Cliente', render: (row) => <Link className="purchase-link" to={customerPath(row.customer.id)}>{row.customer.name}</Link> },
    { key: 'paid', header: 'Pagado', render: (row) => <PaidProgress layaway={row} /> },
    {
      key: 'due',
      header: 'Fecha límite',
      render: (row) =>
        ['active', 'paid'].includes(row.status) ? (
          <span className="cash-stack">
            <span>{formatDay(row.dueDate)}</span>
            {row.status === 'active' && <span className={`cash-stack__detail${row.isOverdue ? ' layaway-due--late' : ''}`}>{dueText(row)}</span>}
          </span>
        ) : (
          '—'
        ),
    },
    { key: 'balance', header: 'Falta', align: 'end', render: (row) => <strong className="numeric">{formatCurrency(row.balance)}</strong> },
    { key: 'status', header: 'Estado', render: (row) => <LayawayStatus layaway={row} /> },
  ]

  return (
    <>
      <PageHeader
        description="Productos reservados para clientes que los pagan con abonos. Se entregan cuando están pagados."
        actions={
          canSell && (
            <Link className="button button--primary button--md" to={ROUTES.pos}>
              <ShoppingBag className="button__icon" aria-hidden="true" />
              <span className="button__label">Apartar en el punto de venta</span>
            </Link>
          )
        }
      />

      {summary && (
        <section className="cash-tiles cash-tiles--four" aria-label="Resumen de apartados">
          <button type="button" className="cash-tile cash-tile--warning layaway-tile" onClick={() => choose('active')}>
            <Archive aria-hidden="true" />
            <span className="cash-tile__value">{summary.active}</span>
            <span className="cash-tile__label">Pagando</span>
          </button>
          <button type="button" className={`cash-tile cash-tile--${summary.overdue > 0 ? 'danger' : 'info'} layaway-tile`} onClick={() => choose('overdue')}>
            <AlarmClock aria-hidden="true" />
            <span className="cash-tile__value">{summary.overdue}</span>
            <span className="cash-tile__label">Vencidos</span>
          </button>
          <button type="button" className="cash-tile cash-tile--success layaway-tile" onClick={() => choose('paid')}>
            <PackageCheck aria-hidden="true" />
            <span className="cash-tile__value">{summary.readyToDeliver}</span>
            <span className="cash-tile__label">Por entregar</span>
          </button>
          <div className="cash-tile cash-tile--accent">
            <Wallet aria-hidden="true" />
            <span className="cash-tile__value">{formatCurrency(summary.pendingBalance)}</span>
            <span className="cash-tile__label">Falta por cobrar</span>
          </div>
        </section>
      )}

      <div className="segmented" role="tablist" aria-label="Estado de los apartados">
        {LAYAWAY_FILTERS.map((option) => (
          <button key={option.value} type="button" role="tab" aria-selected={status === option.value} className={`segmented__option${status === option.value ? ' segmented__option--active' : ''}`} onClick={() => choose(option.value)}>
            {option.label}
          </button>
        ))}
      </div>

      <FilterBar>
        <TextField
          label="Buscar"
          icon={Search}
          type="search"
          placeholder="Número (APA-000012) o cliente"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setPage(1)
          }}
        />
      </FilterBar>

      <DataTable caption="Apartados" columns={columns} rows={data?.rows ?? []} isLoading={isFetching} error={error} onRetry={refetch} emptyTitle="No hay apartados" emptyDescription="Aparta desde el punto de venta con la opción «Apartar»." />
      <Pagination meta={data?.pagination} onPageChange={setPage} itemLabel="apartados" />
    </>
  )
}
