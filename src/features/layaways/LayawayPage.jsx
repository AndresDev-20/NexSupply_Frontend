import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Archive, ArrowLeft, Ban, CalendarClock, CalendarPlus, Gift, HandCoins, PackageCheck, Printer, ReceiptText, RotateCw, Undo2, UserRound, Wallet } from 'lucide-react'
import { useGetLayawayQuery } from './layawaysApi'
import { dueText } from './layawayOptions'
import { LayawayStatus, PaidProgress } from './LayawaysPage'
import { CancelModal, DeliverModal, ExtendModal, LayawayPaymentModal } from './LayawayModals'
import { LayawayReceiptModal } from './LayawayReceiptModal'
import { SaleReceiptModal } from '../sales/SaleReceiptModal'
import { useCan } from '../../hooks/usePermissions'
import { useToast } from '../../components/feedback/Toast/toastContext'
import { StatusMessage } from '../../components/feedback/StatusMessage/StatusMessage'
import { Alert } from '../../components/feedback/Alert/Alert'
import { Button } from '../../components/ui/Button/Button'
import { Spinner } from '../../components/ui/Spinner/Spinner'
import { DataTable } from '../../components/ui/DataTable/DataTable'
import { formatCurrency, formatDate, formatDateTime, formatQuantity } from '../../utils/format'
import { formatDay } from '../purchases/purchaseOptions'
import { ROUTES, customerPath } from '../../routes/paths'
import '../admin/admin.css'
import '../cash/cash.css'
import '../purchases/purchases.css'
import '../inventory/products/ProductDetailPage.css'
import '../customers/customers.css'
import './layaways.css'

/** Detalle de un apartado (Fase 10b): productos, abonos, cuotas y lo que se puede hacer. */
export default function LayawayPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const can = {
    collect: useCan('layaways.create'),
    deliver: useCan('layaways.deliver'),
    extend: useCan('layaways.extend'),
    cancel: useCan('layaways.cancel'),
  }
  const [modal, setModal] = useState(null)
  const { data: layaway, isLoading, error, refetch } = useGetLayawayQuery(id)

  if (isLoading) return <Spinner label="Cargando el apartado…" />
  if (error) {
    return (
      <StatusMessage icon={Archive} title="No se pudo cargar el apartado" description={error.message}>
        <Button variant="secondary" icon={RotateCw} onClick={refetch}>
          Reintentar
        </Button>
      </StatusMessage>
    )
  }

  const isOpen = ['active', 'paid'].includes(layaway.status)
  const payments = layaway.payments ?? []
  const installments = layaway.installments ?? []

  const itemColumns = [
    {
      key: 'product',
      header: 'Producto',
      primary: true,
      render: (row) => (
        <span className="cash-stack">
          <strong>{row.productName}</strong>
          <span className="cash-stack__detail">{row.productCode}</span>
        </span>
      ),
    },
    { key: 'quantity', header: 'Cantidad', align: 'end', render: (row) => `${formatQuantity(row.quantity)} ${row.presentationName ?? row.unitSymbol}` },
    { key: 'price', header: 'Precio', align: 'end', render: (row) => <span className="numeric">{formatCurrency(row.unitPrice)}</span> },
    { key: 'discount', header: 'Descuento', align: 'end', render: (row) => (Number(row.lineDiscount) > 0 ? <span className="numeric">−{formatCurrency(row.lineDiscount)}</span> : '—') },
    { key: 'total', header: 'Valor', align: 'end', render: (row) => <strong className="numeric">{formatCurrency(row.total)}</strong> },
  ]

  return (
    <div className="product-detail">
      <button type="button" className="product-detail__back" onClick={() => navigate(ROUTES.layaways)}>
        <ArrowLeft aria-hidden="true" /> Apartados
      </button>

      <header className="product-hero">
        <span className="product-hero__icon" aria-hidden="true">
          <Archive />
        </span>
        <div className="product-hero__text">
          <h2 className="product-hero__name">Apartado {layaway.number}</h2>
          <p className="product-hero__meta">
            <span className="customer-meta">
              <UserRound aria-hidden="true" /> <Link className="purchase-link" to={customerPath(layaway.customer.id)}>{layaway.customer.name}</Link>
            </span>
            <span className="customer-meta">
              <CalendarClock aria-hidden="true" /> {formatDateTime(layaway.createdAt)} · {layaway.createdBy?.fullName}
            </span>
          </p>
          <div className="product-hero__badges">
            <LayawayStatus layaway={layaway} />
          </div>
        </div>
        <div className="product-hero__actions">
          {layaway.status === 'active' && can.collect && (
            <Button variant="accent" icon={HandCoins} onClick={() => setModal('pay')}>
              Abonar
            </Button>
          )}
          {layaway.status === 'paid' && can.deliver && (
            <Button icon={PackageCheck} onClick={() => setModal('deliver')}>
              Entregar
            </Button>
          )}
          {layaway.status === 'delivered' && layaway.sale && (
            <Button variant="secondary" icon={ReceiptText} onClick={() => setModal({ sale: layaway.sale.id })}>
              Comprobante de venta {layaway.sale.number}
            </Button>
          )}
          <Button variant="secondary" icon={Printer} onClick={() => setModal('receipt')}>
            Comprobante de apartado
          </Button>
          {layaway.status === 'active' && can.extend && (
            <Button variant="ghost" icon={CalendarPlus} onClick={() => setModal('extend')}>
              Ampliar plazo
            </Button>
          )}
          {isOpen && can.cancel && (
            <Button variant="ghost" icon={Ban} onClick={() => setModal('cancel')}>
              Cancelar
            </Button>
          )}
        </div>
      </header>

      {layaway.isOverdue && (
        <Alert tone="danger" title="Apartado vencido">
          La fecha límite era el {formatDay(layaway.dueDate)}. El producto sigue reservado: amplía el plazo o cancela el apartado.
        </Alert>
      )}
      {layaway.status === 'paid' && <Alert tone="success" title="Pagado: listo para entregar">Cuando el cliente recoja, toca «Entregar».</Alert>}

      <section className="cash-tiles cash-tiles--four" aria-label="Cuenta del apartado">
        <div className="cash-tile cash-tile--info">
          <Archive aria-hidden="true" />
          <span className="cash-tile__value">{formatCurrency(layaway.total)}</span>
          <span className="cash-tile__label">Total (precio congelado)</span>
        </div>
        <div className="cash-tile cash-tile--success">
          <HandCoins aria-hidden="true" />
          <span className="cash-tile__value">{formatCurrency(layaway.amountPaid)}</span>
          <span className="cash-tile__label">Abonado</span>
        </div>
        <div className={`cash-tile cash-tile--${Number(layaway.balance) > 0 ? 'warning' : 'success'}`}>
          <Wallet aria-hidden="true" />
          <span className="cash-tile__value">{formatCurrency(layaway.balance)}</span>
          <span className="cash-tile__label">Falta por pagar</span>
        </div>
        <div className={`cash-tile cash-tile--${layaway.isOverdue ? 'danger' : 'accent'}`}>
          <CalendarClock aria-hidden="true" />
          <span className="cash-tile__value">{isOpen ? formatDay(layaway.dueDate) : '—'}</span>
          <span className="cash-tile__label">{layaway.status === 'active' ? `Fecha límite · ${dueText(layaway)}` : 'Fecha límite'}</span>
        </div>
      </section>

      <div className="layaway-progress-card">
        <PaidProgress layaway={layaway} />
      </div>

      {layaway.status === 'cancelled' && (
        <section className="layaway-cancelled" aria-label="Cancelación">
          <h3>
            <Ban aria-hidden="true" /> Cancelado el {formatDate(layaway.cancelledAt)} por {layaway.cancelledBy?.fullName}
          </h3>
          <p>{layaway.cancelReason}</p>
          <div className="layaway-cancelled__split">
            <span>
              <Gift aria-hidden="true" /> Saldo a favor <strong>{formatCurrency(layaway.creditedAmount)}</strong>
            </span>
            <span>
              <Undo2 aria-hidden="true" /> Devuelto <strong>{formatCurrency(layaway.refundedAmount)}</strong>
            </span>
            <span>
              <Wallet aria-hidden="true" /> Retenido <strong>{formatCurrency(layaway.retainedAmount)}</strong>
            </span>
          </div>
        </section>
      )}
      {layaway.status === 'delivered' && (
        <Alert tone="success" title={`Entregado el ${formatDate(layaway.deliveredAt)}`}>
          Lo entregó {layaway.deliveredBy?.fullName}. Venta {layaway.sale?.number}.
        </Alert>
      )}

      <h3 className="layaway-section-title">Productos apartados</h3>
      <DataTable caption="Productos apartados" columns={itemColumns} rows={layaway.items} />

      <div className="layaway-columns">
        <section className="layaway-panel" aria-label="Abonos">
          <h3 className="layaway-section-title">Abonos</h3>
          {payments.length === 0 ? (
            <p className="layaway-empty">Aún no hay abonos.</p>
          ) : (
            <ul className="layaway-list">
              {payments.map((payment) => (
                <li key={payment.id} className={payment.status === 'cancelled' ? 'layaway-list__item--cancelled' : undefined}>
                  <span className="cash-stack">
                    <strong>{payment.number}</strong>
                    <span className="cash-stack__detail">
                      {formatDateTime(payment.paidAt)}
                      {payment.method && ` · ${payment.method}`}
                      {payment.status === 'cancelled' && ' · Anulado'}
                    </span>
                  </span>
                  <strong className="numeric">{formatCurrency(payment.amount)}</strong>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="layaway-panel" aria-label="Plan de pago">
          <h3 className="layaway-section-title">{installments.length > 1 ? 'Cuotas' : 'Plazo'}</h3>
          <ul className="layaway-list">
            {installments.map((item) => (
              <li key={item.id}>
                <span className="cash-stack">
                  <strong>{installments.length > 1 ? `Cuota ${item.installmentNumber}` : 'Pagar antes del'}</strong>
                  <span className="cash-stack__detail">{formatDay(item.dueDate)}</span>
                </span>
                <span className="cash-stack layaway-list__amount">
                  <strong className="numeric">{formatCurrency(item.amount)}</strong>
                  {Number(item.pending) > 0 && layaway.status === 'active' ? <span className="cash-stack__detail">Falta {formatCurrency(item.pending)}</span> : <span className="cash-stack__detail">Pagada</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
      {layaway.notes && <p className="product-detail__description">{layaway.notes}</p>}

      {modal === 'pay' && (
        <LayawayPaymentModal
          layaway={layaway}
          onClose={() => setModal(null)}
          onSaved={(saved) => {
            setModal(null)
            toast.success(saved.message ?? 'Abono registrado')
          }}
        />
      )}
      {modal === 'deliver' && (
        <DeliverModal
          layaway={layaway}
          onClose={() => setModal(null)}
          onDelivered={(result) => {
            toast.success(result.message ?? `Apartado ${layaway.number} entregado`)
            setModal({ sale: result.sale.id })
          }}
        />
      )}
      {modal === 'extend' && (
        <ExtendModal
          layaway={layaway}
          onClose={() => setModal(null)}
          onSaved={(saved) => {
            setModal(null)
            toast.success(saved.message ?? 'Plazo ampliado')
          }}
        />
      )}
      {modal === 'cancel' && (
        <CancelModal
          layaway={layaway}
          onClose={() => setModal(null)}
          onSaved={(saved) => {
            setModal(null)
            toast.success(saved.message ?? `Apartado ${layaway.number} cancelado`)
          }}
        />
      )}
      {modal === 'receipt' && <LayawayReceiptModal layawayId={layaway.id} onClose={() => setModal(null)} />}
      {modal?.sale && <SaleReceiptModal saleId={modal.sale} onClose={() => setModal(null)} />}
    </div>
  )
}
