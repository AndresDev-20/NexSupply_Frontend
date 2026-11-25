import { Button } from '../../components/ui/Button/Button'
import { formatCurrency } from '../../utils/format'
import { ReceiptDocumentModal } from '../sales/ReceiptDocumentModal'
import { shareReceiptPdf } from '../sales/shareReceipt'
import { ticketFormat } from '../sales/receiptHelpers'
import { getPaymentPdfFile, useEmailPaymentReceiptMutation, useGetPaymentReceiptQuery } from './customersApi'
import { PaymentReceiptPaper } from './AccountReceiptPaper'

/**
 * Recibo de un abono (D-CLI-4, D-CLI-11): como el comprobante de venta, en tirilla o carta, PDF,
 * WhatsApp con el PDF y correo. Dice a qué deudas se aplicó y lo que le queda debiendo.
 */
export function PaymentReceiptModal({ payment, onClose }) {
  const { data, isLoading, error, refetch } = useGetPaymentReceiptQuery(payment.id)
  const [sendEmail, emailState] = useEmailPaymentReceiptMutation()
  const current = data?.payment

  return (
    <ReceiptDocumentModal
      title={`Recibo ${payment.number}`}
      onClose={onClose}
      footer={<Button onClick={onClose}>Listo</Button>}
      isLoading={isLoading}
      error={error}
      onRetry={refetch}
      receipt={data?.receipt}
      emailEnabled={data?.emailEnabled}
      defaultEmail={current?.customer?.email ?? ''}
      emailHint="El recibo al correo del cliente"
      renderReceipt={(view) => <PaymentReceiptPaper payment={current} customerBalance={data.customerBalance} business={data.business} receipt={data.receipt} format={view === 'letter' ? 'letter' : ticketFormat(data.receipt)} />}
      getPdfFile={() => getPaymentPdfFile(payment.id, payment.number)}
      onShare={(file) =>
        shareReceiptPdf({
          file,
          sale: { number: current.number, customer: { ...current.customer, isFinalConsumer: false } },
          businessName: data.business.name,
          title: `Recibo de abono ${current.number}`,
          text: `${data.business.name} · Recibo de abono ${current.number} por ${formatCurrency(current.amount)}. ¡Gracias por su pago!`,
        })
      }
      sendEmail={(email) => sendEmail({ id: payment.id, email }).unwrap()}
      emailState={emailState}
    />
  )
}
