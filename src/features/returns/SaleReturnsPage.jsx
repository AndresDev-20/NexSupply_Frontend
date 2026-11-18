import { useState } from 'react'
import { Gift, ReceiptText, Search, Undo2, Wallet } from 'lucide-react'
import { useGetSaleReturnsQuery } from './returnsApi'
import { ReturnReceiptModal } from './ReturnReceipt'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { PageHeader } from '../../components/layout/PageHeader/PageHeader'
import { FilterBar } from '../../components/layout/FilterBar/FilterBar'
import { TextField } from '../../components/ui/TextField/TextField'
import { DataTable } from '../../components/ui/DataTable/DataTable'
import { Pagination } from '../../components/ui/Pagination/Pagination'
import { IconButton } from '../../components/ui/IconButton/IconButton'
import { formatCurrency, formatDateTime } from '../../utils/format'
import { addDays, todayIso } from '../purchases/purchaseOptions'
import '../cash/cash.css'
import '../purchases/purchases.css'
import './returns.css'

/** Cómo se reintegró una devolución, en palabras. */
function refundText(row) {
  const parts = []
  if (Number(row.debtReduction) > 0) parts.push(`Bajó la deuda ${formatCurrency(row.debtReduction)}`)
  if (Number(row.refundedAmount) > 0) parts.push(`${row.refundMethod?.name ?? 'Dinero'} ${formatCurrency(row.refundedAmount)}`)
  if (Number(row.creditedAmount) > 0) parts.push(`Saldo a favor ${formatCurrency(row.creditedAmount)}`)
  return parts.join(' · ') || '—'
}

/** Devoluciones de clientes (Fase 11). Por defecto, las de los últimos 30 días. */
export default function SaleReturnsPage() {
  const [from, setFrom] = useState(addDays(todayIso(), -30))
  const [to, setTo] = useState(todayIso())
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [receiptId, setReceiptId] = useState(null)
  const debouncedSearch = useDebouncedValue(search.trim())
  const params = { page, pageSize: 20, ...(from && { from }), ...(to && { to }), ...(debouncedSearch && { search: debouncedSearch }) }
  const { data, isFetching, error, refetch } = useGetSaleReturnsQuery(params)
  const summary = data?.summary

  const reset = (setter) => (value) => {
    setter(value)
    setPage(1)
  }

  const columns = [
    {
      key: 'number',
      header: 'Devolución',
      primary: true,
      render: (row) => (
        <span className="cash-stack">
          <span className="cash-link__name">{row.number}</span>
          <span className="cash-stack__detail">{formatDateTime(row.createdAt)}</span>
        </span>
      ),
    },
    { key: 'sale', header: 'Venta', render: (row) => row.sale?.number },
    { key: 'customer', header: 'Cliente', render: (row) => (row.customer?.isFinalConsumer ? 'Consumidor final' : row.customer?.name) },
    { key: 'reason', header: 'Motivo', render: (row) => <span className="cash-stack__detail">{row.reason}</span> },
    { key: 'refund', header: 'Reintegro', render: (row) => refundText(row) },
    { key: 'total', header: 'Valor', align: 'end', render: (row) => <strong className="numeric">{formatCurrency(row.total)}</strong> },
    { key: 'actions', header: 'Comprobante', align: 'end', render: (row) => <IconButton icon={ReceiptText} label={`Ver comprobante ${row.number}`} onClick={() => setReceiptId(row.id)} /> },
  ]

  return (
    <>
      <PageHeader description="Productos que los clientes devolvieron. Para devolver, busca la venta en «Ventas» y toca el botón de devolver." />

      {summary && (
        <section className="cash-tiles cash-tiles--four" aria-label="Resumen de devoluciones">
          <div className="cash-tile cash-tile--info">
            <Undo2 aria-hidden="true" />
            <span className="cash-tile__value">{summary.count}</span>
            <span className="cash-tile__label">Devoluciones</span>
          </div>
          <div className="cash-tile cash-tile--warning">
            <ReceiptText aria-hidden="true" />
            <span className="cash-tile__value">{formatCurrency(summary.total)}</span>
            <span className="cash-tile__label">Valor devuelto</span>
          </div>
          <div className="cash-tile cash-tile--danger">
            <Wallet aria-hidden="true" />
            <span className="cash-tile__value">{formatCurrency(summary.refunded)}</span>
            <span className="cash-tile__label">Dinero devuelto</span>
          </div>
          <div className="cash-tile cash-tile--success">
            <Gift aria-hidden="true" />
            <span className="cash-tile__value">{formatCurrency(summary.credited)}</span>
            <span className="cash-tile__label">Saldo a favor</span>
          </div>
        </section>
      )}

      <FilterBar>
        <TextField label="Buscar" icon={Search} type="search" placeholder="DV-000003 o venta V-000012" value={search} onChange={(event) => reset(setSearch)(event.target.value)} />
        <TextField label="Desde" type="date" value={from} max={to || undefined} onChange={(event) => reset(setFrom)(event.target.value)} />
        <TextField label="Hasta" type="date" value={to} min={from || undefined} onChange={(event) => reset(setTo)(event.target.value)} />
      </FilterBar>

      <DataTable caption="Devoluciones" columns={columns} rows={data?.rows ?? []} isLoading={isFetching} error={error} onRetry={refetch} emptyTitle="No hay devoluciones en este periodo" />
      <Pagination meta={data?.pagination} onPageChange={setPage} itemLabel="devoluciones" />

      {receiptId && <ReturnReceiptModal returnId={receiptId} onClose={() => setReceiptId(null)} />}
    </>
  )
}
