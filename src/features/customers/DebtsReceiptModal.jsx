import { FileText } from 'lucide-react'
import { Button } from '../../components/ui/Button/Button'
import { formatCurrency } from '../../utils/format'
import { ReceiptDocumentModal } from '../sales/ReceiptDocumentModal'
import { shareReceiptPdf } from '../sales/shareReceipt'
import { ticketFormat } from '../sales/receiptHelpers'
import { getDebtsPdfFile, useEmailDebtsReceiptMutation, useGetDebtsReceiptQuery } from './customersApi'
import { DebtsReceiptPaper } from './AccountReceiptPaper'

/**
 * Comprobante de deuda (D-CLI-11): con receivableId, esa deuda; sin él, el estado de cuenta con todas
 * las que el cliente tiene por pagar. Cada una con sus cuotas, sus abonos y lo que falta. Se imprime,
 * se descarga en PDF, se manda por WhatsApp o por correo, como el comprobante de venta.
 */
export function DebtsReceiptModal({ customerId, receivableId = null, onClose }) {
  const { data, isLoading, error, refetch } = useGetDebtsReceiptQuery({ customerId, receivableId })
  const [sendEmail, emailState] = useEmailDebtsReceiptMutation()
  const document = data?.document
  const fileName = document ? (document.kind === 'debt' ? `deuda-${document.number}.pdf` : `estado-de-cuenta-${customerId}.pdf`) : ''
  const title = document ? (document.kind === 'debt' ? `Deuda ${document.number}` : `Estado de cuenta de ${document.customer.name}`) : receivableId ? 'Deuda' : 'Estado de cuenta'

  return (
    <ReceiptDocumentModal
      title={title}
      icon={FileText}
      onClose={onClose}
      footer={<Button onClick={onClose}>Listo</Button>}
      isLoading={isLoading}
      error={error}
      onRetry={refetch}
      receipt={data?.receipt}
      emailEnabled={data?.emailEnabled}
      defaultEmail={document?.customer.email ?? ''}
      emailHint="El comprobante al correo del cliente"
      renderReceipt={(view) => <DebtsReceiptPaper document={document} business={data.business} receipt={data.receipt} format={view === 'letter' ? 'letter' : ticketFormat(data.receipt)} />}
      getPdfFile={() => getDebtsPdfFile({ customerId, receivableId, fileName })}
      onShare={(file) =>
        shareReceiptPdf({
          file,
          sale: { number: document.number, customer: { ...document.customer, isFinalConsumer: false } },
          businessName: data.business.name,
          title: `${document.title} ${document.number}`,
          text: `${data.business.name} · ${document.kind === 'debt' ? `Estado de la deuda ${document.number}` : `Estado de cuenta de ${document.customer.name}`}. Saldo por pagar: ${formatCurrency(document.totals.balance)}.`,
        })
      }
      sendEmail={(email) => sendEmail({ customerId, receivableId, email }).unwrap()}
      emailState={emailState}
    />
  )
}
