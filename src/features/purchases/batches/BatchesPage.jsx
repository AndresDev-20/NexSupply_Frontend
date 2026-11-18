import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarX2 } from 'lucide-react'
import { useGetExpiringBatchesQuery } from '../purchasesApi'
import { BatchExpiry } from './BatchExpiry'
import { formatDay, supplierName } from '../purchaseOptions'
import { PageHeader } from '../../../components/layout/PageHeader/PageHeader'
import { DataTable } from '../../../components/ui/DataTable/DataTable'
import { Pagination } from '../../../components/ui/Pagination/Pagination'
import { formatQuantity } from '../../../utils/format'
import { productPath } from '../../../routes/paths'
import '../../cash/cash.css'
import '../purchases.css'

const TABS = [
  { value: '', label: 'Todos' },
  { value: 'expiring', label: 'Por vencer' },
  { value: 'expired', label: 'Vencidos' },
]

const COLUMNS = [
  {
    key: 'product',
    header: 'Producto',
    primary: true,
    render: (batch) => (
      <Link className="purchase-link" to={productPath(batch.product.id)}>
        <span className="cash-link__name">{batch.product.name}</span>
        <span className="cash-stack__detail">
          {batch.product.code} · lote {batch.lotNumber}
        </span>
      </Link>
    ),
  },
  { key: 'expires', header: 'Vence', render: (batch) => <BatchExpiry batch={batch} /> },
  { key: 'available', header: 'Disponible', align: 'end', render: (batch) => `${formatQuantity(batch.availableQuantity)} ${batch.product.unitSymbol ?? ''}` },
  { key: 'supplier', header: 'Proveedor', render: (batch) => supplierName(batch.supplier) },
  { key: 'received', header: 'Recibido', render: (batch) => formatDay(batch.receivedAt?.slice(0, 10)) },
]

/** Lotes con existencia por vencer o vencidos (D-COMP-5), del que vence primero. */
export default function BatchesPage() {
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const { data, isFetching, error, refetch } = useGetExpiringBatchesQuery({ page, pageSize: 20, ...(status && { status }) })

  return (
    <>
      <PageHeader description={`Lotes con existencia que vencen en los próximos ${data?.alertDays ?? 30} días o que ya vencieron. Véndelos primero o sácalos con un ajuste.`} />
      <div className="segmented" role="tablist" aria-label="Estado de los lotes">
        {TABS.map((tab) => (
          <button
            key={tab.value || 'all'}
            type="button"
            role="tab"
            aria-selected={status === tab.value}
            className={`segmented__option${status === tab.value ? ' segmented__option--active' : ''}`}
            onClick={() => {
              setStatus(tab.value)
              setPage(1)
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <DataTable
        caption="Lotes por vencer"
        columns={COLUMNS}
        rows={data?.rows ?? []}
        isLoading={isFetching}
        error={error}
        onRetry={refetch}
        emptyTitle={status === 'expired' ? 'No hay lotes vencidos con existencia' : 'No hay lotes por vencer'}
        emptyDescription="Los lotes se registran al confirmar compras de productos que manejan lotes."
      />
      <Pagination meta={data?.pagination} onPageChange={setPage} itemLabel="lotes" />
      <p className="purchase-hint">
        <CalendarX2 aria-hidden="true" /> El aviso de cada lote llega a la campana una sola vez: cuando entra en este plazo y cuando vence.
      </p>
    </>
  )
}
