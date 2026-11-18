import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlarmClock, CalendarClock, HandCoins, ReceiptText, Search, Users } from 'lucide-react'
import { useGetCustomerPaymentsQuery, useGetReceivablesQuery, useGetReceivablesSummaryQuery } from './customersApi'
import { receivableState } from './customerOptions'
import { PaymentReceiptModal } from './PaymentReceiptModal'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { PageHeader } from '../../components/layout/PageHeader/PageHeader'
import { FilterBar } from '../../components/layout/FilterBar/FilterBar'
import { TextField } from '../../components/ui/TextField/TextField'
import { DataTable } from '../../components/ui/DataTable/DataTable'
import { Pagination } from '../../components/ui/Pagination/Pagination'
import { IconButton } from '../../components/ui/IconButton/IconButton'
import { formatCurrency, formatDateTime } from '../../utils/format'
import { formatDay } from '../purchases/purchaseOptions'
import { customerPath } from '../../routes/paths'
import { BranchScopeToggle } from '../../components/layout/BranchScopeToggle/BranchScopeToggle'
import { branchParams } from '../../components/layout/BranchScopeToggle/branchScope'
import '../cash/cash.css'
import '../purchases/purchases.css'
import './customers.css'

const VIEWS = [
  { value: 'open', label: 'Por cobrar' },
  { value: 'overdue', label: 'Vencidas' },
  { value: 'paid', label: 'Pagadas' },
  { value: 'cancelled', label: 'Anuladas' },
  { value: 'payments', label: 'Abonos recibidos' },
]

function Pill({ tone, children }) {
  return (
    <span className={`status-pill status-pill--${tone}`}>
      <span className="status-pill__dot" aria-hidden="true" />
      {children}
    </span>
  )
}

/** Cartera: todas las deudas de los clientes y los abonos recibidos (D7, D-CLI-1). */
export default function ReceivablesPage() {
  const [view, setView] = useState('open')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [receipt, setReceipt] = useState(null)
  const debouncedSearch = useDebouncedValue(search.trim())
  const isPayments = view === 'payments'
  // Deudas de la sucursal activa o de «Todas» las del usuario (Fase 19, D-INT-4)
  const [scope, setScope] = useState('active')
  const { data: summary } = useGetReceivablesSummaryQuery(branchParams(scope))
  const receivables = useGetReceivablesQuery(
    { page, pageSize: 20, ...branchParams(scope), ...(view === 'overdue' ? { overdue: 'true' } : { status: view }), ...(debouncedSearch && { search: debouncedSearch }) },
    { skip: isPayments },
  )
  const payments = useGetCustomerPaymentsQuery({ page, pageSize: 20 }, { skip: !isPayments })
  const current = isPayments ? payments : receivables

  const receivableColumns = [
    {
      key: 'number',
      header: 'Deuda',
      primary: true,
      render: (row) => (
        <span className="cash-stack">
          <span className="cash-link__name">{row.number}</span>
          <span className="cash-stack__detail">{row.description}</span>
        </span>
      ),
    },
    {
      key: 'customer',
      header: 'Cliente',
      render: (row) => (
        <Link className="purchase-link" to={customerPath(row.customer.id)}>
          <span className="cash-link__name">{row.customer.name}</span>
          <span className="cash-stack__detail">{row.customer.phone ?? ''}</span>
        </Link>
      ),
    },
    // Con «Todas», de qué sucursal es cada deuda
    ...(scope === 'all' ? [{ key: 'branch', header: 'Sucursal', render: (row) => row.branch?.name ?? '—' }] : []),
    { key: 'due', header: 'Vence', render: (row) => (row.status === 'open' ? formatDay(row.nextDue?.dueDate ?? row.dueDate) : '—') },
    {
      key: 'balance',
      header: 'Debe',
      align: 'end',
      render: (row) => (
        <span className="cash-stack customer-debt">
          <strong className="numeric">{formatCurrency(row.status === 'open' ? row.balance : row.total)}</strong>
          {row.isOverdue && <span className="customer-debt__overdue">{formatCurrency(row.overdueAmount)} vencido</span>}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Estado',
      render: (row) => {
        const state = receivableState(row)
        return <Pill tone={state.tone}>{state.label}</Pill>
      },
    },
  ]

  const paymentColumns = [
    { key: 'number', header: 'Abono', primary: true, render: (row) => <span className="cash-link__name">{row.number}</span> },
    {
      key: 'customer',
      header: 'Cliente',
      render: (row) => (
        <Link className="purchase-link" to={customerPath(row.customer.id)}>
          {row.customer.name}
        </Link>
      ),
    },
    { key: 'date', header: 'Fecha', render: (row) => formatDateTime(row.paidAt) },
    { key: 'method', header: 'Método', render: (row) => `${row.paymentMethod?.name ?? '—'}${row.cashSessionId ? ' · a la caja' : ''}` },
    { key: 'amount', header: 'Valor', align: 'end', render: (row) => <strong className={`numeric${row.status === 'cancelled' ? ' customer-strike' : ''}`}>{formatCurrency(row.amount)}</strong> },
    { key: 'actions', header: 'Recibo', align: 'end', render: (row) => <IconButton icon={ReceiptText} label={`Ver recibo ${row.number}`} onClick={() => setReceipt(row)} /> },
  ]

  return (
    <>
      <PageHeader description="Lo que te deben los clientes: deudas por cobrar, vencidas y los abonos recibidos. Para registrar un abono o una deuda, entra al cliente." />

      {summary && (
        <section className="cash-tiles cash-tiles--four" aria-label="Resumen de la cartera">
          <div className="cash-tile cash-tile--info">
            <HandCoins aria-hidden="true" />
            <span className="cash-tile__value">{formatCurrency(summary.balance)}</span>
            <span className="cash-tile__label">Por cobrar</span>
          </div>
          <div className="cash-tile cash-tile--danger">
            <AlarmClock aria-hidden="true" />
            <span className="cash-tile__value">{formatCurrency(summary.overdue)}</span>
            <span className="cash-tile__label">Vencido</span>
          </div>
          <div className="cash-tile cash-tile--warning">
            <CalendarClock aria-hidden="true" />
            <span className="cash-tile__value">{formatCurrency(summary.dueThisWeek)}</span>
            <span className="cash-tile__label">Vence esta semana</span>
          </div>
          <div className="cash-tile cash-tile--accent">
            <Users aria-hidden="true" />
            <span className="cash-tile__value">{summary.customersWithDebt}</span>
            <span className="cash-tile__label">{summary.customersOverdue ? `Clientes con deuda · ${summary.customersOverdue} morosos` : 'Clientes con deuda'}</span>
          </div>
        </section>
      )}

      <div className="segmented" role="tablist" aria-label="Cartera">
        {VIEWS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={view === option.value}
            className={`segmented__option${view === option.value ? ' segmented__option--active' : ''}`}
            onClick={() => {
              setView(option.value)
              setPage(1)
            }}
          >
            {option.label}
          </button>
        ))}
      </div>

      {!isPayments && (
        <FilterBar>
          <BranchScopeToggle
            value={scope}
            feature="multi_branch"
            onChange={(next) => {
              setScope(next)
              setPage(1)
            }}
          />
          <TextField
            label="Buscar"
            icon={Search}
            type="search"
            placeholder="Cliente, número (CXC-000012) o concepto"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
          />
        </FilterBar>
      )}

      <DataTable
        caption={isPayments ? 'Abonos recibidos' : 'Deudas de los clientes'}
        columns={isPayments ? paymentColumns : receivableColumns}
        rows={current.data?.rows ?? []}
        isLoading={current.isFetching}
        error={current.error}
        onRetry={current.refetch}
        emptyTitle={isPayments ? 'Aún no hay abonos' : view === 'overdue' ? 'Nadie está atrasado' : 'Sin deudas aquí'}
      />
      <Pagination meta={current.data?.pagination} onPageChange={setPage} itemLabel={isPayments ? 'abonos' : 'deudas'} />

      {receipt && <PaymentReceiptModal payment={receipt} onClose={() => setReceipt(null)} />}
    </>
  )
}
