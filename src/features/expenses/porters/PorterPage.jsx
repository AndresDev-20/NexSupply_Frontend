import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Ban, HandCoins, Pencil, Phone, Plus, Power, RotateCw, Truck, TriangleAlert } from 'lucide-react'
import { useCancelPorterTripMutation, useGetPorterQuery, useSetPorterActiveMutation } from './portersApi'
import { PayPorterModal, PorterFormModal, TripModal } from './PorterModals'
import { useCan } from '../../../hooks/usePermissions'
import { useToast } from '../../../components/feedback/Toast/toastContext'
import { StatusMessage } from '../../../components/feedback/StatusMessage/StatusMessage'
import { Button } from '../../../components/ui/Button/Button'
import { IconButton } from '../../../components/ui/IconButton/IconButton'
import { Badge } from '../../../components/ui/Badge/Badge'
import { DataTable } from '../../../components/ui/DataTable/DataTable'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog/ConfirmDialog'
import { Modal } from '../../../components/ui/Modal/Modal'
import { TextAreaField } from '../../../components/ui/TextAreaField/TextAreaField'
import { Spinner } from '../../../components/ui/Spinner/Spinner'
import { formatCurrency, formatDateTime } from '../../../utils/format'
import { ROUTES } from '../../../routes/paths'
import '../../admin/admin.css'
import '../../cash/cash.css'
import '../../quotes/quotes.css'

const STATUS = { pending: { label: 'Sin pagar', tone: 'warning' }, paid: { label: 'Pagado', tone: 'success' }, cancelled: { label: 'Anulado', tone: 'neutral' } }
const dayText = (iso) => iso.split('-').reverse().join('/')

/** /gastos/coteros/:id — Viajes y pagos de un cotero (D-CTR-1). */
export default function PorterPage() {
  const { id } = useParams()
  const toast = useToast()
  const can = { trips: useCan('porters.trips'), manage: useCan('porters.manage'), pay: useCan('porters.pay') }
  const { data: porter, error, isLoading, refetch } = useGetPorterQuery(id)
  const [cancelTrip, cancelState] = useCancelPorterTripMutation()
  const [setActive, activeState] = useSetPorterActiveMutation()
  const [modal, setModal] = useState(null) // 'trip' | 'pay' | 'edit' | 'toggle' | { cancel: trip }
  const [reason, setReason] = useState('')

  if (isLoading) return <Spinner label="Cargando el cotero…" />
  if (error || !porter) {
    return (
      <StatusMessage icon={TriangleAlert} tone="danger" title={error?.status === 404 ? 'El cotero no existe' : 'No se pudo cargar el cotero'} description={error?.message}>
        <Link className="button button--secondary button--md" to={ROUTES.porters}>
          <ArrowLeft className="button__icon" aria-hidden="true" />
          <span className="button__label">Volver a coteros</span>
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
    { key: 'date', header: 'Fecha', primary: true, render: (trip) => dayText(trip.tripDate) },
    {
      key: 'detail',
      header: 'Viaje',
      render: (trip) => (
        <span className="quote-product">
          <strong>{trip.description ?? (trip.sale ? `Venta ${trip.sale.number}` : 'Viaje al carro de línea')}</strong>
          {trip.sale && (
            <small>
              Venta {trip.sale.number}
              {trip.sale.customerName ? ` · ${trip.sale.customerName}` : ''}
            </small>
          )}
          {trip.cancelReason && <small>Anulado: {trip.cancelReason}</small>}
        </span>
      ),
    },
    { key: 'amount', header: 'Valor', align: 'end', render: (trip) => <span className="numeric">{formatCurrency(trip.amount)}</span> },
    { key: 'status', header: 'Estado', render: (trip) => <Badge tone={STATUS[trip.status].tone}>{STATUS[trip.status].label}</Badge> },
    {
      key: 'actions',
      header: 'Acciones',
      align: 'end',
      render: (trip) => (can.trips && trip.status === 'pending' ? <IconButton icon={Ban} tone="danger" label={`Anular el viaje del ${dayText(trip.tripDate)}`} onClick={() => setModal({ cancel: trip })} /> : null),
    },
  ]

  const handleCancel = async () => {
    if (reason.trim().length < 3) return toast.error('Escribe por qué se anula el viaje')
    try {
      await cancelTrip({ tripId: modal.cancel.id, porterId: porter.id, reason: reason.trim() }).unwrap()
      toast.success('Viaje anulado')
    } catch (cancelError) {
      toast.error(cancelError.message)
    }
    setModal(null)
    setReason('')
    return undefined
  }

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
        <ArrowLeft aria-hidden="true" /> Coteros
      </Link>
      <header className={`cash-session__header cash-session__header--${Number(porter.pendingAmount) > 0 ? 'warning' : 'success'}`}>
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
            {formatCurrency(porter.tripRate)} por viaje{porter.isActive ? '' : ' · Inactivo'}
          </p>
        </div>
        <div className="quote-totals__total">
          <span>Se le debe</span> <strong>{formatCurrency(porter.pendingAmount)}</strong>
        </div>
      </header>

      <div className="quote-actions">
        {can.trips && porter.isActive && (
          <Button icon={Plus} onClick={() => setModal('trip')}>
            Anotar viaje
          </Button>
        )}
        {can.pay && porter.pendingTrips > 0 && (
          <Button icon={HandCoins} onClick={() => setModal('pay')}>
            Pagar {formatCurrency(porter.pendingAmount)} ({porter.pendingTrips} {porter.pendingTrips === 1 ? 'viaje' : 'viajes'})
          </Button>
        )}
        {can.manage && (
          <>
            <Button variant="secondary" icon={Pencil} onClick={() => setModal('edit')}>
              Editar
            </Button>
            <Button variant="secondary" icon={Power} onClick={() => setModal('toggle')}>
              {porter.isActive ? 'Desactivar' : 'Activar'}
            </Button>
          </>
        )}
      </div>

      <DataTable caption={`Viajes de ${porter.name}`} columns={columns} rows={porter.trips} emptyTitle="Aún no tiene viajes" emptyDescription="Se anotan aquí o desde una venta con «Lo lleva un cotero»." />

      {porter.payments.length > 0 && (
        <section className="quote-totals" aria-label="Pagos">
          <strong>Pagos</strong>
          {porter.payments.map((payment) => (
            <div key={payment.id}>
              <span>
                {formatDateTime(payment.createdAt)} · {payment.tripsCount} {payment.tripsCount === 1 ? 'viaje' : 'viajes'}
              </span>
              <span>{formatCurrency(payment.amount)}</span>
            </div>
          ))}
        </section>
      )}

      {modal === 'trip' && (
        <TripModal
          porter={porter}
          onClose={() => setModal(null)}
          onSaved={(result) => {
            setModal(null)
            toast.success(result.message ?? 'Viaje anotado')
          }}
        />
      )}
      {modal === 'pay' && (
        <PayPorterModal
          porter={porter}
          onClose={() => setModal(null)}
          onSaved={(result) => {
            setModal(null)
            toast.success(result.message ?? 'Pago registrado')
          }}
        />
      )}
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
        title={porter.isActive ? 'Desactivar cotero' : 'Activar cotero'}
        message={porter.isActive ? `${porter.name} ya no se podrá escoger para nuevos viajes. Sus viajes y pagos se conservan.` : `${porter.name} se podrá escoger otra vez.`}
        confirmLabel={porter.isActive ? 'Desactivar' : 'Activar'}
        isLoading={activeState.isLoading}
        onConfirm={handleToggle}
        onCancel={() => setModal(null)}
      />
      {modal?.cancel && (
        <Modal
          isOpen
          onClose={() => setModal(null)}
          isBusy={cancelState.isLoading}
          icon={Ban}
          title="Anular viaje"
          description={`El viaje del ${dayText(modal.cancel.tripDate)} por ${formatCurrency(modal.cancel.amount)} deja de sumar a lo que se le debe. No se borra: queda anulado con su motivo.`}
          footer={
            <>
              <Button variant="secondary" onClick={() => setModal(null)} disabled={cancelState.isLoading}>
                Volver
              </Button>
              <Button variant="danger" isLoading={cancelState.isLoading} onClick={handleCancel}>
                Anular viaje
              </Button>
            </>
          }
        >
          <TextAreaField label="Motivo" rows={2} maxLength={255} data-autofocus placeholder="Ej.: se anotó dos veces" value={reason} onChange={(event) => setReason(event.target.value)} required />
        </Modal>
      )}
    </div>
  )
}
