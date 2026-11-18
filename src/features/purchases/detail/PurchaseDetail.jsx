import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Ban, CalendarClock, CreditCard, HandCoins, Package, Receipt, TrendingDown, Truck, Wallet } from 'lucide-react'
import { useCancelPurchaseMutation, useCancelSupplierPaymentMutation } from '../purchasesApi'
import { formatDay, purchaseState, supplierName } from '../purchaseOptions'
import { AttachmentBox } from './AttachmentBox'
import { PaymentModal, ReasonModal } from './PurchaseModals'
import { useCan } from '../../../hooks/usePermissions'
import { useToast } from '../../../components/feedback/Toast/toastContext'
import { Alert } from '../../../components/feedback/Alert/Alert'
import { Button } from '../../../components/ui/Button/Button'
import { IconButton } from '../../../components/ui/IconButton/IconButton'
import { Badge } from '../../../components/ui/Badge/Badge'
import { DataTable } from '../../../components/ui/DataTable/DataTable'
import { formatCurrency, formatDateTime, formatQuantity } from '../../../utils/format'
import { ROUTES, productPath } from '../../../routes/paths'
import '../../cash/cash.css'
import '../purchases.css'

const ITEM_COLUMNS = [
  {
    key: 'product',
    header: 'Producto',
    primary: true,
    render: (item) => (
      <span className="cash-stack">
        {item.product ? (
          <Link className="cash-link__name purchase-link" to={productPath(item.product.id)}>
            {item.productName}
          </Link>
        ) : (
          <span className="cash-link__name">{item.productName}</span>
        )}
        {item.lotNumber && (
          <span className="cash-stack__detail">
            Lote {item.lotNumber} · vence {formatDay(item.expirationDate)}
          </span>
        )}
      </span>
    ),
  },
  {
    key: 'quantity',
    header: 'Cantidad',
    render: (item) => (
      <span className="cash-stack">
        <span>
          {formatQuantity(item.quantity)} {item.presentation ? item.presentation.name : item.unitSymbol}
        </span>
        {item.presentation && (
          <span className="cash-stack__detail">
            = {formatQuantity(item.baseQuantity)} {item.unitSymbol}
          </span>
        )}
      </span>
    ),
  },
  { key: 'price', header: 'Precio', align: 'end', render: (item) => formatCurrency(item.unitPrice) },
  { key: 'discount', header: 'Descuento', align: 'end', render: (item) => (Number(item.discount) > 0 ? formatCurrency(item.discount) : '—') },
  { key: 'tax', header: 'IVA', render: (item) => (Number(item.taxAmount) > 0 ? `${item.taxRateLabel} · ${formatCurrency(item.taxAmount)}` : item.taxRateLabel) },
  {
    key: 'cost',
    header: 'Costo real',
    align: 'end',
    render: (item) => (
      <strong>
        {formatCurrency(item.unitCost)} / {item.unitSymbol}
      </strong>
    ),
  },
]

/**
 * Compra confirmada o anulada: productos con su costo real, totales, factura, pagos y abonos.
 * priceWarnings: productos que quedaron en pérdida con el nuevo precio de compra (D-COMP-2).
 */
export function PurchaseDetail({ purchase, priceWarnings = [] }) {
  const toast = useToast()
  const canPay = useCan('payables.pay')
  const canCancel = useCan('purchases.cancel')
  const canCancelPayment = useCan('payables.cancel_payment')
  const [dialog, setDialog] = useState(null) // 'pay' | 'cancel' | { payment }
  const [cancelPurchase, cancelState] = useCancelPurchaseMutation()
  const [cancelPayment, cancelPaymentState] = useCancelSupplierPaymentMutation()
  const state = purchaseState(purchase)
  const isConfirmed = purchase.status === 'confirmed'
  const activePayments = purchase.payments.filter((payment) => payment.status === 'active')

  const handleCancel = async (reason) => {
    try {
      await cancelPurchase({ id: purchase.id, reason }).unwrap()
      setDialog(null)
      toast.success(`Compra ${purchase.number} anulada`)
    } catch {
      // Se muestra en el modal
    }
  }

  const handleCancelPayment = async (reason) => {
    try {
      await cancelPayment({ paymentId: dialog.payment.id, purchaseId: purchase.id, reason }).unwrap()
      setDialog(null)
      toast.success('Pago anulado')
    } catch {
      // Se muestra en el modal
    }
  }

  return (
    <div className="purchase-detail">
      <Link className="cash-session__back" to={ROUTES.purchases}>
        <ArrowLeft aria-hidden="true" /> Compras
      </Link>

      <header className={`cash-session__header cash-session__header--${state.tone}`}>
        <span className="cash-session__icon" aria-hidden="true">
          <Receipt />
        </span>
        <div className="cash-session__title">
          <h2>
            {supplierName(purchase.supplier)}
            {purchase.number && <span className="cash-session__number">{purchase.number}</span>}
          </h2>
          <p>
            {purchase.supplierInvoiceNumber ? `Factura ${purchase.supplierInvoiceNumber} · ` : ''}
            {formatDay(purchase.invoiceDate)} · confirmada {formatDateTime(purchase.confirmedAt)} por {purchase.confirmedBy?.fullName ?? '—'}
          </p>
        </div>
        <span className={`status-pill status-pill--${state.tone}`}>
          <span className="status-pill__dot" aria-hidden="true" />
          {state.label}
        </span>
      </header>

      {priceWarnings.length > 0 && (
        <Alert tone="warning" title="Revisa el precio de venta">
          Con el nuevo precio de compra, {priceWarnings.map((warning) => `${warning.name} (compra ${formatCurrency(warning.purchasePrice)}, venta ${formatCurrency(warning.salePrice)})`).join('; ')} {priceWarnings.length === 1 ? 'quedó' : 'quedaron'} en pérdida.
        </Alert>
      )}
      {purchase.status === 'cancelled' && (
        <Alert tone="danger" title="Compra anulada">
          {formatDateTime(purchase.cancelledAt)} por {purchase.cancelledBy?.fullName ?? '—'}: {purchase.cancelReason}. La mercancía salió del inventario.
        </Alert>
      )}

      {isConfirmed && (
        <div className="cash-session__actions">
          {canCancel && (
            <Button variant="ghost" icon={Ban} onClick={() => setDialog('cancel')}>
              Anular compra
            </Button>
          )}
          {canPay && Number(purchase.balance) > 0 && (
            <Button icon={HandCoins} onClick={() => setDialog('pay')}>
              Registrar pago
            </Button>
          )}
        </div>
      )}

      <section className="cash-tiles cash-tiles--four" aria-label="Resumen de la compra">
        <div className="cash-tile cash-tile--info">
          <Receipt aria-hidden="true" />
          <span className="cash-tile__value">{formatCurrency(purchase.payableTotal)}</span>
          <span className="cash-tile__label">Total a pagar</span>
        </div>
        <div className="cash-tile cash-tile--success">
          <Wallet aria-hidden="true" />
          <span className="cash-tile__value">{formatCurrency(purchase.amountPaid)}</span>
          <span className="cash-tile__label">Pagado</span>
        </div>
        <div className={`cash-tile cash-tile--${Number(purchase.balance) > 0 ? 'warning' : 'success'}`}>
          <TrendingDown aria-hidden="true" />
          <span className="cash-tile__value">{formatCurrency(purchase.balance)}</span>
          <span className="cash-tile__label">Saldo</span>
        </div>
        <div className={`cash-tile cash-tile--${purchase.paymentStatus === 'overdue' ? 'danger' : 'accent'}`}>
          <CalendarClock aria-hidden="true" />
          <span className="cash-tile__value">{purchase.paymentType === 'credit' ? formatDay(purchase.dueDate) : 'Contado'}</span>
          <span className="cash-tile__label">{purchase.paymentType === 'credit' ? 'Vence' : 'Forma de pago'}</span>
        </div>
      </section>

      <section className="cash-panel cash-panel--flush" aria-labelledby="items-title">
        <h3 className="cash-panel__title" id="items-title">
          <Package aria-hidden="true" /> Productos
        </h3>
        <DataTable caption="Productos de la compra" columns={ITEM_COLUMNS} rows={purchase.items} emptyTitle="Sin productos" />
      </section>

      <div className="purchase-detail__grid">
        <section className="closing-report" aria-label="Totales">
          <header className="closing-report__header">
            <div>
              <h3>Totales</h3>
              <p>{purchase.taxMode === 'in_cost' ? 'El negocio no cobra IVA: el IVA pagado se sumó al costo.' : 'El IVA va aparte (descontable): no subió el costo.'}</p>
            </div>
          </header>
          <dl className="closing-summary">
            <div>
              <dt>Subtotal</dt>
              <dd>{formatCurrency(purchase.subtotal)}</dd>
            </div>
            <div>
              <dt>Descuentos</dt>
              <dd>{Number(purchase.discountTotal) > 0 ? `− ${formatCurrency(purchase.discountTotal)}` : formatCurrency(0)}</dd>
            </div>
            <div>
              <dt>IVA</dt>
              <dd>{formatCurrency(purchase.taxTotal)}</dd>
            </div>
            <div>
              <dt>Flete {purchase.freightInInvoice ? '(en la factura)' : '(pagado aparte)'}</dt>
              <dd>{formatCurrency(purchase.freight)}</dd>
            </div>
            <div className="closing-summary__row--strong">
              <dt>Total</dt>
              <dd>{formatCurrency(purchase.total)}</dd>
            </div>
            {purchase.notes && (
              <div className="closing-summary__note">
                <dt>Notas</dt>
                <dd>{purchase.notes}</dd>
              </div>
            )}
          </dl>
        </section>

        <div className="purchase-detail__side">
          <AttachmentBox purchase={purchase} />
          <section className="cash-panel" aria-labelledby="payments-title">
            <h3 className="cash-panel__title" id="payments-title">
              <CreditCard aria-hidden="true" /> Pagos
            </h3>
            {purchase.payments.length === 0 ? (
              <p className="cash-panel__empty">Sin pagos registrados.</p>
            ) : (
              <ul className="payment-list">
                {purchase.payments.map((payment) => (
                  <li key={payment.id} className={`payment-list__item${payment.status === 'cancelled' ? ' payment-list__item--cancelled' : ''}`}>
                    <span className="payment-list__text">
                      <span className="payment-list__amount">{formatCurrency(payment.amount)}</span>
                      <span className="payment-list__detail">
                        {payment.paymentMethod?.name}
                        {payment.paymentReference && ` · ${payment.paymentReference}`}
                        {payment.cashSessionId && ' · de la caja'} · {formatDateTime(payment.paidAt)}
                      </span>
                      {payment.status === 'cancelled' && <span className="payment-list__detail">Anulado: {payment.cancelReason}</span>}
                    </span>
                    {payment.status === 'cancelled' ? (
                      <Badge tone="neutral">Anulado</Badge>
                    ) : (
                      canCancelPayment && isConfirmed && <IconButton icon={Ban} tone="danger" label={`Anular el pago de ${formatCurrency(payment.amount)}`} onClick={() => setDialog({ payment })} />
                    )}
                  </li>
                ))}
              </ul>
            )}
            {activePayments.length > 0 && canCancel && isConfirmed && <p className="purchase-hint">Para anular la compra, primero anula sus pagos.</p>}
          </section>
          <p className="purchase-hint">
            <Truck aria-hidden="true" /> Costo real = precio − descuentos + su parte del flete{purchase.taxMode === 'in_cost' ? ' + IVA' : ''}, por unidad base. Es el nuevo precio de compra de cada producto y queda en su kárdex.
          </p>
        </div>
      </div>

      {dialog === 'pay' && (
        <PaymentModal
          purchase={purchase}
          onClose={() => setDialog(null)}
          onSaved={(saved, amount) => {
            setDialog(null)
            toast.success(`Pago de ${formatCurrency(amount)} registrado${Number(saved.balance) > 0 ? `. Quedan ${formatCurrency(saved.balance)}` : '. Compra pagada'}`)
          }}
        />
      )}
      {dialog === 'cancel' && (
        <ReasonModal
          title="Anular compra"
          description={`${purchase.number}: la mercancía sale del inventario y el costo vuelve a como estaba. Solo se puede si todavía está en la bodega y sin pagos vigentes.`}
          confirmLabel="Anular compra"
          isLoading={cancelState.isLoading}
          error={cancelState.error}
          onClose={() => setDialog(null)}
          onConfirm={handleCancel}
        />
      )}
      {dialog?.payment && (
        <ReasonModal
          title="Anular pago"
          description={`Pago de ${formatCurrency(dialog.payment.amount)} con ${dialog.payment.paymentMethod?.name}. ${dialog.payment.cashSessionId ? 'El efectivo vuelve a la caja de donde salió (debe seguir abierta).' : 'El saldo de la compra vuelve a subir.'}`}
          confirmLabel="Anular pago"
          isLoading={cancelPaymentState.isLoading}
          error={cancelPaymentState.error}
          onClose={() => setDialog(null)}
          onConfirm={handleCancelPayment}
        />
      )}
    </div>
  )
}
