import { MessageCircle, Printer, ReceiptText } from 'lucide-react'
import { Modal } from '../../components/ui/Modal/Modal'
import { Button } from '../../components/ui/Button/Button'
import { formatCurrency, formatDateTime } from '../../utils/format'
import { formatDay } from '../purchases/purchaseOptions'
import { useBusinessName } from '../settings/useBusinessName'
import { receiptLink } from './customerOptions'

/**
 * Recibo de un abono (D-CLI-4): se imprime (solo el recibo) o se comparte por WhatsApp.
 * Es un comprobante interno del negocio.
 */
export function PaymentReceiptModal({ payment, onClose }) {
  const businessName = useBusinessName()
  const whatsapp = receiptLink({ payment, businessName })
  const balance = payment.allocations.reduce((sum, item) => sum + Number(item.balanceNow), 0)
  // Fase 19: el abono puede bajar deudas de otras sucursales; si es así, cada línea dice de cuál
  const showBranch = new Set(payment.allocations.map((item) => item.branch?.id)).size > 1

  return (
    <Modal
      isOpen
      onClose={onClose}
      icon={ReceiptText}
      title={`Recibo ${payment.number}`}
      footer={
        <>
          {whatsapp && (
            <a className="button button--secondary button--md" href={whatsapp} target="_blank" rel="noreferrer">
              <MessageCircle className="button__icon" aria-hidden="true" />
              <span className="button__label">Enviar por WhatsApp</span>
            </a>
          )}
          <Button variant="secondary" icon={Printer} onClick={() => window.print()}>
            Imprimir
          </Button>
          <Button onClick={onClose}>Listo</Button>
        </>
      }
    >
      <article className="receipt-sheet" aria-label={`Recibo de abono ${payment.number}`}>
        <header className="receipt-sheet__head">
          <p className="receipt-sheet__business">{businessName ?? 'Agropecuaria'}</p>
          <p className="receipt-sheet__title">Recibo de abono {payment.number}</p>
          <p className="receipt-sheet__date">{formatDateTime(payment.paidAt)}</p>
          {payment.status === 'cancelled' && <p className="receipt-sheet__cancelled">ANULADO: {payment.cancelReason}</p>}
        </header>
        <dl className="receipt-sheet__rows">
          <div>
            <dt>Cliente</dt>
            <dd>
              {payment.customer?.name}
              {payment.customer?.documentNumber && ` · ${payment.customer.documentType} ${payment.customer.documentNumber}`}
            </dd>
          </div>
          <div>
            <dt>Método</dt>
            <dd>
              {payment.paymentMethod?.name}
              {payment.paymentReference && ` · Ref. ${payment.paymentReference}`}
            </dd>
          </div>
        </dl>
        <table className="receipt-sheet__table">
          <thead>
            <tr>
              <th scope="col">Abonado a</th>
              <th scope="col">Valor</th>
            </tr>
          </thead>
          <tbody>
            {payment.allocations.map((item) => (
              <tr key={item.receivableId}>
                <td>
                  {item.number} · {item.description}
                  {showBranch && item.branch && <small>Sucursal {item.branch.name}</small>}
                  {item.installments.length > 0 && (
                    <small>
                      {item.installments.map((cuota) => `Cuota ${cuota.installmentNumber} (${formatDay(cuota.dueDate)}): ${formatCurrency(cuota.amount)}`).join(' · ')}
                    </small>
                  )}
                </td>
                <td className="numeric">{formatCurrency(item.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total abonado</th>
              <td className="numeric">{formatCurrency(payment.amount)}</td>
            </tr>
            <tr>
              <th scope="row">Saldo de esas deudas</th>
              <td className="numeric">{formatCurrency(String(balance))}</td>
            </tr>
          </tfoot>
        </table>
        <p className="receipt-sheet__foot">
          Recibió: {payment.createdBy?.fullName ?? '—'} · Comprobante interno · Desarrollado por Nexoon
        </p>
      </article>
    </Modal>
  )
}
