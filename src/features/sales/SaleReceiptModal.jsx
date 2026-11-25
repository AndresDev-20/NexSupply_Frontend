import { Button } from '../../components/ui/Button/Button'
import { formatCurrency } from '../../utils/format'
import { getSalePdfFile, useEmailSaleReceiptMutation, useGetSaleReceiptQuery } from './salesApi'
import { shareReceiptPdf } from './shareReceipt'
import { SaleReceiptPaper } from './SaleReceiptPaper'
import { SaleReceiptLetter } from './SaleReceiptLetter'
import { ReceiptDocumentModal } from './ReceiptDocumentModal'

function Receipt({ view, ...props }) {
  return view === 'letter' ? <SaleReceiptLetter {...props} /> : <SaleReceiptPaper {...props} />
}

/**
 * Comprobante de una venta (D-VEN-4, D-VEN-10): imprimir en tirilla o en carta, PDF, WhatsApp
 * y correo. onNewSale: en el punto de venta, empieza la siguiente venta.
 */
export function SaleReceiptModal({ saleId, onClose, onNewSale, change = null }) {
  const { data, isLoading, error, refetch } = useGetSaleReceiptQuery(saleId)
  const [sendEmail, emailState] = useEmailSaleReceiptMutation()
  const sale = data?.sale

  const success =
    onNewSale && sale ? (
      <div className="sale-success" role="status">
        <svg className="sale-success__check" viewBox="0 0 52 52" aria-hidden="true">
          <circle className="sale-success__circle" cx="26" cy="26" r="24" />
          <path className="sale-success__tick" d="M15 27l7 7 15-16" />
        </svg>
        <div className="sale-success__text">
          <strong>¡Venta registrada!</strong>
          <span>
            {sale.number} · {formatCurrency(sale.total)}
            {Number(sale.creditAmount) > 0 && ` · fiado ${formatCurrency(sale.creditAmount)}`}
          </span>
        </div>
        {change !== null && Number(change) > 0 && (
          <div className="sale-success__change">
            <span>Entregar de cambio</span>
            <strong>{formatCurrency(change)}</strong>
          </div>
        )}
      </div>
    ) : null

  return (
    <ReceiptDocumentModal
      title={sale ? `Comprobante ${sale.number}` : 'Comprobante'}
      onClose={onClose}
      footer={onNewSale ? <Button onClick={onNewSale}>Nueva venta</Button> : <Button onClick={onClose}>Cerrar</Button>}
      isLoading={isLoading}
      error={error}
      onRetry={refetch}
      receipt={data?.receipt}
      emailEnabled={data?.emailEnabled}
      defaultEmail={sale?.customer?.email ?? ''}
      header={success}
      renderReceipt={(view) => <Receipt view={view} sale={sale} business={data.business} receipt={data.receipt} />}
      getPdfFile={() => getSalePdfFile(saleId, sale.number)}
      onShare={(file) => shareReceiptPdf({ file, sale, businessName: data.business.name })}
      sendEmail={(email) => sendEmail({ id: saleId, email }).unwrap()}
      emailState={emailState}
    />
  )
}
