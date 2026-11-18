import { useState } from 'react'
import { ArrowRight, Eye, PackageCheck, Send, Truck } from 'lucide-react'
import { useCancelTransferMutation, useGetTransfersQuery } from './transfersApi'
import { useCan } from '../../hooks/usePermissions'
import { useToast } from '../../components/feedback/Toast/toastContext'
import { PageHeader } from '../../components/layout/PageHeader/PageHeader'
import { DataTable } from '../../components/ui/DataTable/DataTable'
import { Pagination } from '../../components/ui/Pagination/Pagination'
import { Button } from '../../components/ui/Button/Button'
import { IconButton } from '../../components/ui/IconButton/IconButton'
import { formatCurrency, formatDateTime } from '../../utils/format'
import { ReasonModal } from '../purchases/detail/PurchaseModals'
import { SendTransferModal } from './SendTransferModal'
import { TransferDetailModal } from './TransferDetailModal'
import { TransferStatus } from './TransferStatus'
import '../admin/admin.css'
import '../cash/cash.css'
import '../purchases/purchases.css'
import './transfers.css'

// Pestañas: lo que espera esta sede, lo que envió, lo que recibió y todo
const TABS = [
  { value: 'pending', label: 'Por recibir', params: { direction: 'incoming', status: 'in_transit' } },
  { value: 'outgoing', label: 'Enviadas', params: { direction: 'outgoing' } },
  { value: 'incoming', label: 'Recibidas', params: { direction: 'incoming' } },
  { value: 'all', label: 'Todas', params: { direction: 'all' } },
]

/**
 * Transferencias entre sedes (Fase 18, plan intermedio). Todo desde la sede activa:
 * enviar a otra sede, recibir lo que llega (con diferencias si las hay) y anular lo enviado
 * que sigue en camino.
 */
export default function TransfersPage() {
  const toast = useToast()
  const canSend = useCan('transfers.send')
  const canReceive = useCan('transfers.receive')
  const canCancel = useCan('transfers.cancel')
  const [tab, setTab] = useState(canReceive ? 'pending' : 'all')
  const [page, setPage] = useState(1)
  const [sending, setSending] = useState(false)
  const [detailId, setDetailId] = useState(null)
  const [toCancel, setToCancel] = useState(null)
  const params = { ...TABS.find((item) => item.value === tab).params, page, pageSize: 20 }
  const { data, isFetching, error, refetch } = useGetTransfersQuery(params)
  const [cancelTransfer, cancelState] = useCancelTransferMutation()
  const summary = data?.summary

  const handleCancel = async (reason) => {
    try {
      const result = await cancelTransfer({ id: toCancel.id, reason }).unwrap()
      toast.success(result.message ?? 'Transferencia anulada')
      setToCancel(null)
      setDetailId(null)
    } catch {
      // Se muestra en el modal
    }
  }

  const columns = [
    {
      key: 'number',
      header: 'Transferencia',
      primary: true,
      render: (row) => (
        <span className="cash-stack">
          <strong>{row.number}</strong>
          <span className="cash-stack__detail">
            {formatDateTime(row.sentAt)} · {row.sentBy?.fullName}
          </span>
        </span>
      ),
    },
    {
      key: 'route',
      header: 'Ruta',
      render: (row) => (
        <span className="transfer-route">
          <span className={row.direction === 'outgoing' ? 'transfer-route__here' : undefined}>{row.origin.name}</span>
          <ArrowRight aria-label="hacia" />
          <span className={row.direction === 'incoming' ? 'transfer-route__here' : undefined}>{row.destination.name}</span>
        </span>
      ),
    },
    { key: 'status', header: 'Estado', render: (row) => <TransferStatus transfer={row} /> },
    ...(data?.rows?.some((row) => row.costTotal !== null) ? [{ key: 'cost', header: 'Costo', align: 'end', render: (row) => <span className="numeric">{formatCurrency(row.costTotal)}</span> }] : []),
    {
      key: 'actions',
      header: 'Acciones',
      align: 'end',
      render: (row) =>
        canReceive && row.direction === 'incoming' && row.status === 'in_transit' ? (
          <Button size="sm" icon={PackageCheck} onClick={() => setDetailId(row.id)}>
            Recibir
          </Button>
        ) : (
          <IconButton icon={Eye} label={`Ver ${row.number}`} onClick={() => setDetailId(row.id)} />
        ),
    },
  ]

  return (
    <>
      <PageHeader
        description="Mercancía que va de una sede a otra. Sale al costo de la sede que envía y entra a la otra cuando la recibe."
        actions={
          canSend && (
            <Button icon={Send} onClick={() => setSending(true)}>
              Enviar mercancía
            </Button>
          )
        }
      />

      {summary && (
        <section className="cash-tiles" aria-label="Resumen de transferencias">
          <div className={`cash-tile cash-tile--${summary.pendingToReceive > 0 ? 'warning' : 'success'}`}>
            <PackageCheck aria-hidden="true" />
            <span className="cash-tile__value">{summary.pendingToReceive}</span>
            <span className="cash-tile__label">Por recibir en esta sede</span>
          </div>
          <div className="cash-tile cash-tile--info">
            <Truck aria-hidden="true" />
            <span className="cash-tile__value">{summary.inTransitSent}</span>
            <span className="cash-tile__label">Enviadas que siguen en camino</span>
          </div>
        </section>
      )}

      <div className="segmented" role="tablist" aria-label="Transferencias">
        {TABS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={tab === option.value}
            className={`segmented__option${tab === option.value ? ' segmented__option--active' : ''}`}
            onClick={() => {
              setTab(option.value)
              setPage(1)
            }}
          >
            {option.label}
          </button>
        ))}
      </div>

      <DataTable
        caption="Transferencias"
        columns={columns}
        rows={data?.rows ?? []}
        isLoading={isFetching}
        error={error}
        onRetry={refetch}
        emptyTitle={tab === 'pending' ? 'Nada por recibir' : 'Sin transferencias'}
        emptyDescription={tab === 'pending' ? 'Cuando otra sede te envíe mercancía aparecerá aquí.' : undefined}
      />
      <Pagination meta={data?.pagination} onPageChange={setPage} itemLabel="transferencias" />

      {sending && (
        <SendTransferModal
          onClose={() => setSending(false)}
          onSent={(result) => {
            setSending(false)
            toast.success(result.message ?? `Transferencia ${result.number} enviada`)
            setTab('outgoing')
            setPage(1)
          }}
        />
      )}
      {detailId && !toCancel && (
        <TransferDetailModal
          id={detailId}
          canReceive={canReceive}
          canCancel={canCancel}
          onClose={() => setDetailId(null)}
          onCancelRequest={(transfer) => setToCancel(transfer)}
          onReceived={(result) => {
            setDetailId(null)
            // Con diferencias es un aviso informativo: la sede que envió ya fue notificada
            if (result.hasDifferences) toast.info(result.message ?? 'Transferencia recibida con diferencias')
            else toast.success(result.message ?? 'Transferencia recibida')
          }}
        />
      )}
      {toCancel && (
        <ReasonModal
          title={`Anular ${toCancel.number}`}
          description={`La mercancía vuelve al inventario de ${toCancel.origin.name} con su mismo costo y sus lotes, y ${toCancel.destination.name} recibe un aviso.`}
          confirmLabel="Anular envío"
          placeholder="Ej.: el camión no salió"
          isLoading={cancelState.isLoading}
          error={cancelState.error}
          onClose={() => setToCancel(null)}
          onConfirm={handleCancel}
        />
      )}
    </>
  )
}
