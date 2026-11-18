import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlarmClock, FolderCog, Landmark, Paperclip, Plus, Receipt, Search, Wallet } from 'lucide-react'
import { useGetExpenseCategoriesQuery, useGetExpensesQuery, useGetRecurringExpensesQuery } from './expensesApi'
import { categoryTone, monthStart } from './expenseOptions'
import { ExpenseFormModal } from './ExpenseFormModal'
import { ExpenseDetailModal } from './ExpenseDetailModal'
import { ExpenseCategoriesModal } from './ExpenseCategoriesModal'
import { useCan } from '../../hooks/usePermissions'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { useToast } from '../../components/feedback/Toast/toastContext'
import { PageHeader } from '../../components/layout/PageHeader/PageHeader'
import { FilterBar } from '../../components/layout/FilterBar/FilterBar'
import { TextField } from '../../components/ui/TextField/TextField'
import { SelectField } from '../../components/ui/SelectField/SelectField'
import { DataTable } from '../../components/ui/DataTable/DataTable'
import { Pagination } from '../../components/ui/Pagination/Pagination'
import { Button } from '../../components/ui/Button/Button'
import { Alert } from '../../components/feedback/Alert/Alert'
import { formatCurrency } from '../../utils/format'
import { formatDay, todayIso } from '../purchases/purchaseOptions'
import { ROUTES } from '../../routes/paths'
import '../cash/cash.css'
import '../purchases/purchases.css'
import './expenses.css'

/** Barras del total por categoría: en qué se va la plata del periodo. */
function CategoryBreakdown({ items, total, onPick }) {
  if (!items?.length) return null
  const max = Math.max(...items.map((item) => Number(item.total)))
  return (
    <section className="expense-breakdown" aria-label="Gastos por categoría">
      <h3>¿En qué se fue la plata?</h3>
      <ul>
        {items.map((item) => {
          const share = Number(total) ? Math.round((Number(item.total) / Number(total)) * 100) : 0
          return (
            <li key={item.categoryId}>
              <button type="button" onClick={() => onPick(String(item.categoryId))} aria-label={`Ver los gastos de ${item.name}`}>
                <span className="expense-breakdown__name">{item.name}</span>
                <span className="expense-breakdown__bar" aria-hidden="true">
                  <span className={`expense-breakdown__fill tone-${categoryTone(item.categoryId)}`} style={{ width: `${Math.max(4, (Number(item.total) / max) * 100)}%` }} />
                </span>
                <span className="expense-breakdown__value">
                  <strong className="numeric">{formatCurrency(item.total)}</strong>
                  <small>{share} %</small>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** Gastos (Fase 12): lo que se pagó en el periodo, con su categoría, soporte y si salió de la caja. */
export default function ExpensesPage() {
  const toast = useToast()
  const canCreate = useCan('expenses.create')
  const canManage = useCan('expenses.manage')
  const [from, setFrom] = useState(monthStart(todayIso()))
  const [to, setTo] = useState(todayIso())
  const [categoryId, setCategoryId] = useState('')
  const [cash, setCash] = useState('')
  const [status, setStatus] = useState('active')
  const [withoutAttachment, setWithoutAttachment] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState(null) // 'create' | 'categories' | { detail: id }
  const debouncedSearch = useDebouncedValue(search.trim())
  const params = {
    page,
    pageSize: 20,
    ...(from && { from }),
    ...(to && { to }),
    ...(categoryId && { categoryId }),
    ...(cash && { fromCash: cash }),
    ...(status && { status }),
    ...(withoutAttachment && { withoutAttachment: 'true' }),
    ...(debouncedSearch && { search: debouncedSearch }),
  }
  const { data, isFetching, error, refetch } = useGetExpensesQuery(params)
  const { data: categories = [] } = useGetExpenseCategoriesQuery()
  const { data: recurring = [] } = useGetRecurringExpensesQuery(undefined, { skip: !canCreate })
  const due = recurring.filter((item) => item.isDue)
  const summary = data?.summary

  const reset = (setter) => (value) => {
    setter(value)
    setPage(1)
  }

  const columns = [
    {
      key: 'number',
      header: 'Gasto',
      primary: true,
      render: (row) => (
        <button type="button" className="expense-link" onClick={() => setModal({ detail: row.id })}>
          <span className="cash-stack">
            <span className="cash-link__name">{row.number}</span>
            <span className="cash-stack__detail">{formatDay(row.expenseDate)}</span>
          </span>
        </button>
      ),
    },
    { key: 'category', header: 'Categoría', render: (row) => <span className={`expense-chip tone-${categoryTone(row.category?.id)}`}>{row.category?.name}</span> },
    {
      key: 'description',
      header: 'Descripción',
      render: (row) => (
        <span className="cash-stack">
          <span>{row.description}</span>
          {row.payee && <span className="cash-stack__detail">{row.payee}</span>}
        </span>
      ),
    },
    {
      key: 'method',
      header: 'Pago',
      render: (row) => (
        <span className="cash-stack">
          <span>{row.paymentMethod?.name}</span>
          {row.fromCash && (
            <span className="expense-cash-tag">
              <Landmark aria-hidden="true" /> De la caja
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'support',
      header: 'Soporte',
      render: (row) =>
        row.hasAttachment ? (
          <span className="expense-support expense-support--ok" title={`${row.attachmentsCount} soporte(s)`}>
            <Paperclip aria-hidden="true" /> {row.attachmentsCount}
          </span>
        ) : (
          <span className="expense-support">Sin soporte</span>
        ),
    },
    {
      key: 'amount',
      header: 'Valor',
      align: 'end',
      render: (row) => (row.status === 'cancelled' ? <span className="expense-amount--cancelled numeric">{formatCurrency(row.amount)} · Anulado</span> : <strong className="numeric">{formatCurrency(row.amount)}</strong>),
    },
  ]

  return (
    <>
      <PageHeader
        description="Lo que se paga para que el negocio funcione: servicios, transporte, arriendo, nómina… Por defecto, los de este mes."
        actions={
          <>
            {canManage && (
              <Button variant="ghost" icon={FolderCog} onClick={() => setModal('categories')}>
                Categorías
              </Button>
            )}
            {canCreate && (
              <Button icon={Plus} onClick={() => setModal('create')}>
                Registrar gasto
              </Button>
            )}
          </>
        }
      />

      {due.length > 0 && (
        <div className="expense-due">
          <Alert tone="warning" title={due.length === 1 ? 'Hay un gasto fijo por pagar' : `Hay ${due.length} gastos fijos por pagar`}>
            {due.map((item) => item.name).join(', ')}.{' '}
            <Link className="purchase-link" to={ROUTES.recurringExpenses}>
              Ir a gastos fijos
            </Link>
          </Alert>
        </div>
      )}

      {summary && (
        <section className="cash-tiles cash-tiles--four" aria-label="Resumen de gastos">
          <div className="cash-tile cash-tile--danger">
            <Wallet aria-hidden="true" />
            <span className="cash-tile__value">{formatCurrency(summary.total)}</span>
            <span className="cash-tile__label">Gastado</span>
          </div>
          <div className="cash-tile cash-tile--info">
            <Receipt aria-hidden="true" />
            <span className="cash-tile__value">{summary.count}</span>
            <span className="cash-tile__label">Gastos</span>
          </div>
          <div className="cash-tile cash-tile--accent">
            <Landmark aria-hidden="true" />
            <span className="cash-tile__value">{formatCurrency(summary.fromCash)}</span>
            <span className="cash-tile__label">Salió de la caja</span>
          </div>
          <button type="button" className={`cash-tile cash-tile--${summary.withoutAttachment > 0 ? 'warning' : 'success'} expense-tile`} onClick={() => reset(setWithoutAttachment)(true)}>
            <AlarmClock aria-hidden="true" />
            <span className="cash-tile__value">{summary.withoutAttachment}</span>
            <span className="cash-tile__label">Sin soporte</span>
          </button>
        </section>
      )}

      <CategoryBreakdown items={summary?.byCategory} total={summary?.total} onPick={reset(setCategoryId)} />

      <FilterBar>
        <TextField label="Buscar" icon={Search} type="search" placeholder="G-000012, descripción o beneficiario" value={search} onChange={(event) => reset(setSearch)(event.target.value)} />
        <TextField label="Desde" type="date" value={from} max={to || undefined} onChange={(event) => reset(setFrom)(event.target.value)} />
        <TextField label="Hasta" type="date" value={to} min={from || undefined} onChange={(event) => reset(setTo)(event.target.value)} />
        <SelectField label="Categoría" placeholder="Todas" options={categories.map((row) => ({ value: String(row.id), label: row.name }))} value={categoryId} onChange={(event) => reset(setCategoryId)(event.target.value)} />
        <SelectField
          label="Caja"
          placeholder="Todos"
          options={[
            { value: 'true', label: 'Salieron de la caja' },
            { value: 'false', label: 'No tocaron la caja' },
          ]}
          value={cash}
          onChange={(event) => reset(setCash)(event.target.value)}
        />
        <SelectField
          label="Estado"
          placeholder="Todos"
          options={[
            { value: 'active', label: 'Vigentes' },
            { value: 'cancelled', label: 'Anulados' },
          ]}
          value={status}
          onChange={(event) => reset(setStatus)(event.target.value)}
        />
      </FilterBar>
      {withoutAttachment && (
        <p className="expense-filter-note">
          <Paperclip aria-hidden="true" /> Mostrando solo los gastos sin soporte.{' '}
          <button type="button" className="purchase-link" onClick={() => reset(setWithoutAttachment)(false)}>
            Ver todos
          </button>
        </p>
      )}

      <DataTable caption="Gastos" columns={columns} rows={data?.rows ?? []} isLoading={isFetching} error={error} onRetry={refetch} emptyTitle="No hay gastos en este periodo" emptyDescription={canCreate ? 'Registra el primero con «Registrar gasto».' : undefined} />
      <Pagination meta={data?.pagination} onPageChange={setPage} itemLabel="gastos" />

      {modal === 'create' && (
        <ExpenseFormModal
          onClose={() => setModal(null)}
          onSaved={(saved) => {
            toast.success(saved.message ?? `Gasto ${saved.number} registrado`)
            setModal({ detail: saved.id })
          }}
        />
      )}
      {modal?.detail && <ExpenseDetailModal expenseId={modal.detail} onClose={() => setModal(null)} />}
      {modal === 'categories' && <ExpenseCategoriesModal onClose={() => setModal(null)} />}
    </>
  )
}
