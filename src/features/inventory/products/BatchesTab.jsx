import { useGetProductBatchesQuery } from '../../purchases/purchasesApi'
import { BatchExpiry } from '../../purchases/batches/BatchExpiry'
import { formatDay, supplierName } from '../../purchases/purchaseOptions'
import { DataTable } from '../../../components/ui/DataTable/DataTable'
import { formatCurrency, formatQuantity } from '../../../utils/format'

/** Lotes del producto en la sucursal, del que vence primero (FEFO, D-COMP-5). */
export function BatchesTab({ product, canViewCost }) {
  const { data = [], isFetching, error, refetch } = useGetProductBatchesQuery({ productId: product.id })
  const symbol = product.unit.symbol
  const columns = [
    { key: 'lot', header: 'Lote', primary: true, render: (batch) => <span className="entity-cell__code">{batch.lotNumber}</span> },
    { key: 'expires', header: 'Vence', render: (batch) => <BatchExpiry batch={batch} /> },
    { key: 'available', header: 'Disponible', render: (batch) => `${formatQuantity(batch.availableQuantity)} de ${formatQuantity(batch.receivedQuantity)} ${symbol}` },
    { key: 'supplier', header: 'Proveedor', render: (batch) => supplierName(batch.supplier) },
    ...(canViewCost ? [{ key: 'cost', header: 'Costo', align: 'end', render: (batch) => `${formatCurrency(batch.unitCost)} / ${symbol}` }] : []),
    { key: 'received', header: 'Recibido', render: (batch) => formatDay(batch.receivedAt?.slice(0, 10)) },
  ]
  return (
    <DataTable
      caption="Lotes del producto"
      columns={columns}
      rows={data}
      isLoading={isFetching}
      error={error}
      onRetry={refetch}
      emptyTitle="Sin lotes con existencia"
      emptyDescription="Los lotes se registran al confirmar una compra. La primera venta saldrá del lote que vence primero."
    />
  )
}
