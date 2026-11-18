import { createPortal } from 'react-dom'
import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { Archive, ExternalLink, Printer, RotateCw } from 'lucide-react'
import { Modal } from '../../components/ui/Modal/Modal'
import { Button } from '../../components/ui/Button/Button'
import { Spinner } from '../../components/ui/Spinner/Spinner'
import { Alert } from '../../components/feedback/Alert/Alert'
import { formatCurrency } from '../../utils/format'
import { ticketFormat } from '../sales/receiptHelpers'
import { printReceipt } from '../sales/printReceipt'
import { layawayPath } from './layawayOptions'
import { useGetLayawayReceiptQuery } from './layawaysApi'
import { LayawayReceiptPaper } from './LayawayReceiptPaper'
import '../sales/sales.css'

/**
 * Comprobante de apartado (D-APA-6): se imprime en tirilla para que el cliente sepa qué apartó,
 * cuánto abonó y hasta cuándo tiene. onNewSale: en el punto de venta, empieza la siguiente venta.
 */
export function LayawayReceiptModal({ layawayId, onClose, onNewSale }) {
  const { data, isLoading, error, refetch } = useGetLayawayReceiptQuery(layawayId)
  const printRef = useRef(null)
  const layaway = data?.layaway

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="md"
      icon={Archive}
      title={layaway ? `Apartado ${layaway.number}` : 'Apartado'}
      footer={onNewSale ? <Button onClick={onNewSale}>Nueva venta</Button> : <Button onClick={onClose}>Cerrar</Button>}
    >
      {isLoading ? (
        <Spinner label="Cargando el comprobante…" />
      ) : error ? (
        <Alert tone="danger" title="No se pudo cargar el comprobante">
          {error.message}{' '}
          <Button size="sm" variant="ghost" icon={RotateCw} onClick={refetch}>
            Reintentar
          </Button>
        </Alert>
      ) : (
        <>
          {onNewSale && (
            <div className="sale-success" role="status">
              <svg className="sale-success__check" viewBox="0 0 52 52" aria-hidden="true">
                <circle className="sale-success__circle" cx="26" cy="26" r="24" />
                <path className="sale-success__tick" d="M15 27l7 7 15-16" />
              </svg>
              <div className="sale-success__text">
                <strong>{layaway.status === 'paid' ? '¡Apartado pagado!' : '¡Producto apartado!'}</strong>
                <span>
                  {layaway.number} · abonó {formatCurrency(layaway.amountPaid)}
                </span>
              </div>
              {Number(layaway.balance) > 0 && (
                <div className="sale-success__change">
                  <span>Falta por pagar</span>
                  <strong>{formatCurrency(layaway.balance)}</strong>
                </div>
              )}
            </div>
          )}

          <div className="sale-actions">
            <button type="button" className="sale-action sale-action--primary" onClick={() => printReceipt(printRef.current?.firstElementChild, ticketFormat(data.receipt))}>
              <span className="sale-action__icon" aria-hidden="true">
                <Printer />
              </span>
              <span className="sale-action__text">
                <span className="sale-action__label">Imprimir tirilla</span>
                <span className="sale-action__hint">Para el cliente</span>
              </span>
            </button>
            <Link className="sale-action" to={layawayPath(layaway.id)} onClick={onClose}>
              <span className="sale-action__icon" aria-hidden="true">
                <ExternalLink />
              </span>
              <span className="sale-action__text">
                <span className="sale-action__label">Ver el apartado</span>
                <span className="sale-action__hint">Abonos, entrega y plazo</span>
              </span>
            </Link>
          </div>

          <div className="sale-preview">
            <div className="sale-receipt__scroll">
              <LayawayReceiptPaper layaway={layaway} business={data.business} receipt={data.receipt} />
            </div>
          </div>

          {createPortal(
            <div className="sale-print-root sale-print-root--ticket" ref={printRef} aria-hidden="true">
              <LayawayReceiptPaper layaway={layaway} business={data.business} receipt={data.receipt} />
            </div>,
            document.body,
          )}
        </>
      )}
    </Modal>
  )
}
