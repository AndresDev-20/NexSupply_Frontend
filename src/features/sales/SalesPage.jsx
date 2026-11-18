import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Ban, HandCoins, ReceiptText, Search, ShoppingBag, TrendingUp, Undo2, Wallet } from 'lucide-react'
import { useGetSalesQuery } from './salesApi'
import { SaleReceiptModal } from './SaleReceiptModal'
import { CancelSaleModal, ReturnModal } from '../returns/ReturnModals'
import { ReturnReceiptModal } from '../returns/ReturnReceipt'
import { useToast } from '../../components/feedback/Toast/toastContext'
import { useCan } from '../../hooks/usePermissions'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { PageHeader } from '../../components/layout/PageHeader/PageHeader'
import { FilterBar } from '../../components/layout/FilterBar/FilterBar'
import { TextField } from '../../components/ui/TextField/TextField'
import { SelectField } from '../../components/ui/SelectField/SelectField'
import { DataTable } from '../../components/ui/DataTable/DataTable'
import { Pagination } from '../../components/ui/Pagination/Pagination'
import { IconButton } from '../../components/ui/IconButton/IconButton'
import { formatCurrency, formatDateTime } from '../../utils/format'
import { todayIso } from '../purchases/purchaseOptions'
import { ROUTES, customerPath } from '../../routes/paths'
import '../cash/cash.css'
import '../purchases/purchases.css'
import './sales.css'

/** Historial de ventas con el resumen del periodo (D-VEN-1). */
export default function SalesPage() {
  const toast = useToast()
  const canSell = useCan('sales.create')
  // Devolver y anular: con el permiso propio o, quien vende, con la clave de un supervisor (D-DEV-7)
  const canReturn = useCan('sales.return') || canSell
  const canCancel = useCan('sales.cancel') || canSell
  const canViewCost = useCan('inventory.cost_view')
  const [from, setFrom] = useState(todayIso())
  const [to, setTo] = useState(todayIso())
  const [saleType, setSaleType] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [receiptId, setReceiptId] = useState(null)
  const [action, setAction] = useState(null) // { return: saleId } | { cancel: sale } | { returnReceipt: id }
  const debouncedSearch = useDebouncedValue(search.trim())
  const params = { page, pageSize: 20, ...(from && { from }), ...(to && { to }), ...(saleType && { saleType }), ...(debouncedSearch && { search: debouncedSearch }) }
  const { data, isFetching, error, refetch } = useGetSalesQuery(params)
  const summary = data?.summary

  const reset = (setter) => (value) => {
    setter(value)
    setPage(1)
  }

  const columns = [
    {
      key: 'number',
      header: 'Venta',
      primary: true,
      render: (row) => (
        <span className="cash-stack">
          <span className="cash-link__name">{row.number}</span>
          <span className="cash-stack__detail">{formatDateTime(row.createdAt)}</span>
        </span>
      ),
    },
    {
      key: 'customer',
      header: 'Cliente',
      render: (row) => (row.customer?.isFinalConsumer ? 'Consumidor final' : <Link className="purchase-link" to={customerPath(row.customer.id)}>{row.customer?.name}</Link>),
    },
    { key: 'seller', header: 'Vendió', render: (row) => `${row.seller?.fullName ?? '—'}${row.register ? ` · ${row.register.name}` : ''}` },
    {
      key: 'type',
      header: 'Tipo',
      render: (row) => (
        row.status === 'cancelled' ? (
          <span className="status-pill status-pill--danger">
            <span className="status-pill__dot" aria-hidden="true" />
            Anulada
          </span>
        ) : (
          <span className={`status-pill status-pill--${row.saleType === 'credit' ? 'warning' : row.saleType === 'layaway' ? 'info' : 'success'}`}>
            <span className="status-pill__dot" aria-hidden="true" />
            {row.saleTypeLabel}
          </span>
        )
      ),
    },
    {
      key: 'total',
      header: 'Total',
      align: 'end',
      render: (row) => (
        <span className="cash-stack sale-amount">
          <strong className="numeric">{formatCurrency(row.total)}</strong>
          {Number(row.creditAmount) > 0 && <span className="sale-amount__credit">Fiado {formatCurrency(row.creditAmount)}</span>}
          {Number(row.returnedTotal) > 0 && <span className="sale-amount__returned">Devuelto {formatCurrency(row.returnedTotal)}</span>}
        </span>
      ),
    },
    ...(canViewCost ? [{ key: 'profit', header: 'Utilidad', align: 'end', render: (row) => <span className={`numeric${row.profit?.startsWith('-') ? ' margin--negative' : ''}`}>{formatCurrency(row.profit)}</span> }] : []),
    {
      key: 'actions',
      header: 'Acciones',
      align: 'end',
      render: (row) => (
        <span className="sale-row-actions">
          <IconButton icon={ReceiptText} label={`Ver comprobante ${row.number}`} onClick={() => setReceiptId(row.id)} />
          {row.status === 'completed' && canReturn && Number(row.returnedTotal) < Number(row.total) && <IconButton icon={Undo2} label={`Devolver productos de ${row.number}`} onClick={() => setAction({ return: row.id })} />}
          {row.status === 'completed' && canCancel && row.saleType !== 'layaway' && Number(row.returnedTotal) === 0 && <IconButton icon={Ban} label={`Anular ${row.number}`} onClick={() => setAction({ cancel: row })} />}
        </span>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        description="Todas las ventas con su comprobante. Por defecto, las de hoy."
        actions={
          canSell && (
            <Link className="button button--primary button--md" to={ROUTES.pos}>
              <ShoppingBag className="button__icon" aria-hidden="true" />
              <span className="button__label">Ir al punto de venta</span>
            </Link>
          )
        }
      />

      {summary && (
        <section className={`cash-tiles${canViewCost ? ' cash-tiles--four' : ''}`} aria-label="Resumen del periodo">
          <div className="cash-tile cash-tile--info">
            <ShoppingBag aria-hidden="true" />
            <span className="cash-tile__value">{summary.count}</span>
            <span className="cash-tile__label">Ventas</span>
          </div>
          <div className="cash-tile cash-tile--success">
            <Wallet aria-hidden="true" />
            <span className="cash-tile__value">{formatCurrency(summary.total)}</span>
            <span className="cash-tile__label">Vendido</span>
          </div>
          <div className="cash-tile cash-tile--warning">
            <HandCoins aria-hidden="true" />
            <span className="cash-tile__value">{formatCurrency(summary.credit)}</span>
            <span className="cash-tile__label">Fiado</span>
          </div>
          {canViewCost && (
            <div className="cash-tile cash-tile--accent">
              <TrendingUp aria-hidden="true" />
              <span className="cash-tile__value">{formatCurrency(summary.profit)}</span>
              <span className="cash-tile__label">Utilidad</span>
            </div>
          )}
        </section>
      )}

      <FilterBar>
        <TextField label="Buscar" icon={Search} type="search" placeholder="Número (V-000012)" value={search} onChange={(event) => reset(setSearch)(event.target.value)} />
        <TextField label="Desde" type="date" value={from} max={to || undefined} onChange={(event) => reset(setFrom)(event.target.value)} />
        <TextField label="Hasta" type="date" value={to} min={from || undefined} onChange={(event) => reset(setTo)(event.target.value)} />
        <SelectField
          label="Tipo"
          placeholder="Todas"
          options={[
            { value: 'cash', label: 'Contado' },
            { value: 'credit', label: 'Fiado' },
            { value: 'layaway', label: 'Apartado' },
          ]}
          value={saleType}
          onChange={(event) => reset(setSaleType)(event.target.value)}
        />
      </FilterBar>

      <DataTable caption="Ventas" columns={columns} rows={data?.rows ?? []} isLoading={isFetching} error={error} onRetry={refetch} emptyTitle="No hay ventas en este periodo" />
      <Pagination meta={data?.pagination} onPageChange={setPage} itemLabel="ventas" />

      {receiptId && <SaleReceiptModal saleId={receiptId} onClose={() => setReceiptId(null)} />}
      {action?.return && (
        <ReturnModal
          saleId={action.return}
          onClose={() => setAction(null)}
          onSaved={(saved) => {
            toast.success(saved.message ?? `Devolución ${saved.number} registrada`)
            setAction({ returnReceipt: saved.id })
          }}
        />
      )}
      {action?.cancel && (
        <CancelSaleModal
          sale={action.cancel}
          onClose={() => setAction(null)}
          onSaved={(saved) => {
            toast.success(saved.message ?? `Venta ${saved.number} anulada`)
            setAction(null)
          }}
        />
      )}
      {action?.returnReceipt && <ReturnReceiptModal returnId={action.returnReceipt} justCreated onClose={() => setAction(null)} />}
    </>
  )
}
