import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Pencil, Phone, Power, RotateCw, Truck, TriangleAlert } from 'lucide-react'
import { useGetPorterQuery, useSetPorterActiveMutation } from './portersApi'
import { PorterFormModal } from './PorterModals'
import { useCan } from '../../../hooks/usePermissions'
import { useToast } from '../../../components/feedback/Toast/toastContext'
import { StatusMessage } from '../../../components/feedback/StatusMessage/StatusMessage'
import { Button } from '../../../components/ui/Button/Button'
import { Badge } from '../../../components/ui/Badge/Badge'
import { DataTable } from '../../../components/ui/DataTable/DataTable'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog/ConfirmDialog'
import { Spinner } from '../../../components/ui/Spinner/Spinner'
import { formatCurrency, formatDateTime } from '../../../utils/format'
import { ROUTES } from '../../../routes/paths'
import '../../admin/admin.css'
import '../../cash/cash.css'
import '../../quotes/quotes.css'

const SALE_TYPES = { cash: 'Contado', credit: 'Fiado' }

/** /ventas/conductores/:id — Un conductor y los fletes que ha llevado (D-FLE-1). */
export default function PorterPage() {
  const { id } = useParams()
  const toast = useToast()
  const canManage = useCan('porters.manage')
  const { data: porter, error, isLoading, refetch } = useGetPorterQuery(id)
  const [setActive, activeState] = useSetPorterActiveMutation()
  const [modal, setModal] = useState(null) // 'edit' | 'toggle'

  if (isLoading) return <Spinner label="Cargando el conductor…" />
  if (error || !porter) {
    return (
      <StatusMessage icon={TriangleAlert} tone="danger" title={error?.status === 404 ? 'El conductor no existe' : 'No se pudo cargar el conductor'} description={error?.message}>
        <Link className="button button--secondary button--md" to={ROUTES.porters}>
          <ArrowLeft className="button__icon" aria-hidden="true" />
          <span className="button__label">Volver a conductores</span>
        </Link>
        {error?.status !== 404 && (
          <Button icon={RotateCw} onClick={refetch}>
            Reintentar
          </Button>
        )}
      </StatusMessage>
    )
  }

  const columns = [
    { key: 'date', header: 'Fecha', primary: true, render: (row) => formatDateTime(row.createdAt) },
    {
      key: 'sale',
      header: 'Venta',
      render: (row) => (
        <span className="quote-product">
          <strong>Venta {row.number}</strong>
          <small>
            {row.customerName ?? 'Consumidor final'} · {SALE_TYPES[row.saleType] ?? row.saleType}
          </small>
        </span>
      ),
    },
    { key: 'amount', header: 'Flete', align: 'end', render: (row) => <span className="numeric">{formatCurrency(row.amount)}</span> },
    { key: 'status', header: 'Estado', render: (row) => (row.status === 'cancelled' ? <Badge tone="neutral">Venta anulada</Badge> : <Badge tone="success">Pagado</Badge>) },
  ]

  const handleToggle = async () => {
    try {
      await setActive({ id: porter.id, active: !porter.isActive }).unwrap()
      toast.success(porter.isActive ? `${porter.name} desactivado` : `${porter.name} activado`)
    } catch (toggleError) {
      toast.error(toggleError.message)
    }
    setModal(null)
  }

  return (
    <div className="purchase-detail">
      <Link className="cash-session__back" to={ROUTES.porters}>
        <ArrowLeft aria-hidden="true" /> Conductores
      </Link>
      <header className="cash-session__header cash-session__header--success">
        <span className="cash-session__icon" aria-hidden="true">
          <Truck />
        </span>
        <div className="cash-session__title">
          <h2>{porter.name}</h2>
          <p>
            {porter.phone && (
              <>
                <Phone size={14} aria-hidden="true" /> {porter.phone} ·{' '}
              </>
            )}
            {Number(porter.tripRate) > 0 ? `Flete propuesto ${formatCurrency(porter.tripRate)}` : 'Sin flete propuesto'}
            {porter.isActive ? '' : ' · Inactivo'}
          </p>
        </div>
        <div className="quote-totals__total">
          <span>
            {porter.freights} {porter.freights === 1 ? 'flete' : 'fletes'}
          </span>{' '}
          <strong>{formatCurrency(porter.freightTotal)}</strong>
        </div>
      </header>

      {canManage && (
        <div className="quote-actions">
          <Button variant="secondary" icon={Pencil} onClick={() => setModal('edit')}>
            Editar
          </Button>
          <Button variant="secondary" icon={Power} onClick={() => setModal('toggle')}>
            {porter.isActive ? 'Desactivar' : 'Activar'}
          </Button>
        </div>
      )}

      <DataTable caption={`Fletes de ${porter.name}`} columns={columns} rows={porter.freightSales} emptyTitle="Aún no ha llevado fletes" emptyDescription="Se agregan en el punto de venta con «Agregar flete»." />

      {modal === 'edit' && (
        <PorterFormModal
          porter={porter}
          onClose={() => setModal(null)}
          onSaved={(saved) => {
            setModal(null)
            toast.success(`${saved.name} actualizado`)
          }}
        />
      )}
      <ConfirmDialog
        isOpen={modal === 'toggle'}
        tone={porter.isActive ? 'danger' : 'primary'}
        title={porter.isActive ? 'Desactivar conductor' : 'Activar conductor'}
        message={porter.isActive ? `${porter.name} ya no se podrá escoger para nuevos fletes. Sus fletes se conservan.` : `${porter.name} se podrá escoger otra vez.`}
        confirmLabel={porter.isActive ? 'Desactivar' : 'Activar'}
        isLoading={activeState.isLoading}
        onConfirm={handleToggle}
        onCancel={() => setModal(null)}
      />
    </div>
  )
}
