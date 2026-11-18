import { useState } from 'react'
import { PackageCheck, ShieldAlert, Trash2, Wallet } from 'lucide-react'
import { useGetQuarantineQuery, useReleaseQuarantineMutation, useWriteOffQuarantineMutation } from './returnsApi'
import { useCan } from '../../hooks/usePermissions'
import { useToast } from '../../components/feedback/Toast/toastContext'
import { PageHeader } from '../../components/layout/PageHeader/PageHeader'
import { DataTable } from '../../components/ui/DataTable/DataTable'
import { Pagination } from '../../components/ui/Pagination/Pagination'
import { Button } from '../../components/ui/Button/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog/ConfirmDialog'
import { formatCurrency, formatDateTime, formatQuantity } from '../../utils/format'
import { ReasonModal } from '../purchases/detail/PurchaseModals'
import '../cash/cash.css'
import '../purchases/purchases.css'
import './returns.css'

const FILTERS = [
  { value: 'pending', label: 'Por decidir' },
  { value: 'released', label: 'Volvieron a la venta' },
  { value: 'written_off', label: 'Dados de baja' },
  { value: 'all', label: 'Todos' },
]
const TONES = { pending: 'warning', released: 'success', written_off: 'danger' }

/**
 * Cuarentena (D-DEV-6): producto devuelto que no se puede vender. No cuenta en la existencia.
 * Quien tenga inventory.quarantine decide: vuelve a la venta o se da de baja (pérdida).
 */
export default function QuarantinePage() {
  const toast = useToast()
  const canDecide = useCan('inventory.quarantine')
  const [status, setStatus] = useState('pending')
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState(null) // { release: row } | { writeOff: row }
  const { data, isFetching, error, refetch } = useGetQuarantineQuery({ status, page, pageSize: 20 })
  const [release, releaseState] = useReleaseQuarantineMutation()
  const [writeOff, writeOffState] = useWriteOffQuarantineMutation()
  const summary = data?.summary

  const handleRelease = async () => {
    try {
      const result = await release({ id: modal.release.id }).unwrap()
      toast.success(result.message ?? 'Volvió a la venta')
    } catch (releaseError) {
      toast.error(releaseError.message)
    }
    setModal(null)
  }

  const handleWriteOff = async (reason) => {
    try {
      const result = await writeOff({ id: modal.writeOff.id, reason }).unwrap()
      toast.success(result.message ?? 'Se dio de baja')
      setModal(null)
    } catch {
      // Se muestra en el modal
    }
  }

  const columns = [
    {
      key: 'product',
      header: 'Producto',
      primary: true,
      render: (row) => (
        <span className="cash-stack">
          <strong>{row.product?.name}</strong>
          <span className="cash-stack__detail">
            {row.product?.code} · {formatDateTime(row.createdAt)}
          </span>
        </span>
      ),
    },
    { key: 'quantity', header: 'Cantidad', align: 'end', render: (row) => `${formatQuantity(row.quantity)} ${row.product?.unitSymbol ?? ''}` },
    { key: 'value', header: 'Valor (costo)', align: 'end', render: (row) => <span className="numeric">{formatCurrency(row.value)}</span> },
    // De dónde viene: una devolución o una transferencia que llegó dañada (Fase 18)
    { key: 'origin', header: 'Viene de', render: (row) => <span className="cash-stack"><span>{row.saleReturn ? `Devolución ${row.saleReturn.number}` : row.transfer ? `Transferencia ${row.transfer.number}` : '—'}</span><span className="cash-stack__detail">{row.reason}</span></span> },
    {
      key: 'status',
      header: 'Estado',
      render: (row) => (
        <span className="cash-stack">
          <span className={`status-pill status-pill--${TONES[row.status]}`}>
            <span className="status-pill__dot" aria-hidden="true" />
            {row.statusLabel}
          </span>
          {row.resolvedBy && <span className="cash-stack__detail">{row.resolvedBy.fullName}{row.resolutionNotes ? ` · ${row.resolutionNotes}` : ''}</span>}
        </span>
      ),
    },
    ...(canDecide
      ? [
          {
            key: 'actions',
            header: 'Decidir',
            align: 'end',
            render: (row) =>
              row.status === 'pending' && (
                <span className="sale-row-actions">
                  <Button size="sm" variant="secondary" icon={PackageCheck} onClick={() => setModal({ release: row })}>
                    Vuelve a la venta
                  </Button>
                  <Button size="sm" variant="ghost" icon={Trash2} onClick={() => setModal({ writeOff: row })}>
                    Dar de baja
                  </Button>
                </span>
              ),
          },
        ]
      : []),
  ]

  return (
    <>
      <PageHeader description="Producto que no se puede vender (devuelto vencido, dañado o abierto, o que llegó dañado de otra sede). No cuenta como existencia hasta que se decida qué hacer con él." />

      {summary && (
        <section className="cash-tiles" aria-label="Resumen de la cuarentena">
          <div className={`cash-tile cash-tile--${summary.pending > 0 ? 'warning' : 'success'}`}>
            <ShieldAlert aria-hidden="true" />
            <span className="cash-tile__value">{summary.pending}</span>
            <span className="cash-tile__label">Por decidir</span>
          </div>
          <div className="cash-tile cash-tile--info">
            <Wallet aria-hidden="true" />
            <span className="cash-tile__value">{formatCurrency(summary.pendingValue)}</span>
            <span className="cash-tile__label">Valor en cuarentena (costo)</span>
          </div>
        </section>
      )}

      <div className="segmented" role="tablist" aria-label="Estado de la cuarentena">
        {FILTERS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={status === option.value}
            className={`segmented__option${status === option.value ? ' segmented__option--active' : ''}`}
            onClick={() => {
              setStatus(option.value)
              setPage(1)
            }}
          >
            {option.label}
          </button>
        ))}
      </div>

      <DataTable caption="Cuarentena" columns={columns} rows={data?.rows ?? []} isLoading={isFetching} error={error} onRetry={refetch} emptyTitle={status === 'pending' ? 'Nada en cuarentena' : 'Sin registros'} emptyDescription={status === 'pending' ? 'Aquí llega lo devuelto que no se puede vender.' : undefined} />
      <Pagination meta={data?.pagination} onPageChange={setPage} itemLabel="productos" />

      <ConfirmDialog
        isOpen={Boolean(modal?.release)}
        tone="primary"
        title="Vuelve a la venta"
        message={modal?.release ? `${formatQuantity(modal.release.quantity)} ${modal.release.product?.unitSymbol ?? ''} de ${modal.release.product?.name} entran de nuevo a la existencia al costo con que salieron.` : ''}
        confirmLabel="Volver a la venta"
        isLoading={releaseState.isLoading}
        onConfirm={handleRelease}
        onCancel={() => setModal(null)}
      />
      {modal?.writeOff && (
        <ReasonModal
          title={`Dar de baja ${modal.writeOff.product?.name}`}
          description={`Se registra una pérdida de ${formatCurrency(modal.writeOff.value)} (al costo). No vuelve a la venta.`}
          confirmLabel="Dar de baja"
          placeholder="Ej.: el bulto llegó mojado"
          isLoading={writeOffState.isLoading}
          error={writeOffState.error}
          onClose={() => setModal(null)}
          onConfirm={handleWriteOff}
        />
      )}
    </>
  )
}
