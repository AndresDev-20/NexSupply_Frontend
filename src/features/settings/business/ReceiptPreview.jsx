import { Paperclip } from 'lucide-react'
import { logoUrl } from '../settingsApi'
import { formatDateTime } from '../../../utils/format'
import './ReceiptPreview.css'

// Productos de ejemplo: solo ilustran cómo se verá el comprobante (no son datos reales)
const SAMPLE_ITEMS = [
  { name: 'Concentrado cerdos levante 40 kg', quantity: '1', total: '$ 98.000' },
  { name: 'Ivermectina 1 % x 50 mL', quantity: '2', total: '$ 25.000' },
]
const SAMPLE_TOTAL = '$ 123.000'
const SAMPLE_NUMBER = 'V-000124'

const PAPER_LABELS = { '58mm': 'Tirilla 58 mm', '80mm': 'Tirilla 80 mm', letter: 'Hoja carta' }

/**
 * Comprobante de venta de ejemplo con los datos que se están editando.
 * El ancho cambia según el formato de impresión elegido.
 */
export function ReceiptPreview({ values, fixed, logo }) {
  const paper = values['receipt.paper_format'] ?? '80mm'
  const regime = values['receipt.tax_regime_text']?.trim() || fixed?.taxRegimeText
  const showLogo = values['receipt.show_logo'] && logo

  return (
    <figure className="receipt-preview">
      <div className={`receipt-preview__paper receipt-preview__paper--${paper}`}>
        <header className="receipt-preview__header">
          {showLogo && <img className="receipt-preview__logo" src={logoUrl(logo)} alt="" />}
          <p className="receipt-preview__business">{values['business.name']?.trim() || 'Nombre del negocio'}</p>
          {values['business.nit'] && <p>NIT {values['business.nit']}</p>}
          {values['business.address'] && <p>{values['business.address']}</p>}
          {values['business.phone'] && <p>Tel. {values['business.phone']}</p>}
          {regime && <p className="receipt-preview__regime">{regime}</p>}
        </header>

        <div className="receipt-preview__divider" />

        <p className="receipt-preview__title">{fixed?.receiptTitle ?? 'Comprobante de venta'}</p>
        <div className="receipt-preview__meta">
          <span>No. {SAMPLE_NUMBER}</span>
          <span>{formatDateTime(new Date())}</span>
        </div>

        <div className="receipt-preview__divider" />

        <ul className="receipt-preview__items">
          {SAMPLE_ITEMS.map((item) => (
            <li key={item.name} className="receipt-preview__item">
              <span className="receipt-preview__item-name">
                {item.quantity} × {item.name}
              </span>
              <span>{item.total}</span>
            </li>
          ))}
        </ul>

        <div className="receipt-preview__divider" />

        <p className="receipt-preview__total">
          <span>TOTAL</span>
          <span>{SAMPLE_TOTAL}</span>
        </p>
        <p className="receipt-preview__payment">Pago: Efectivo</p>

        {values['receipt.footer_message'] && <p className="receipt-preview__footer">{values['receipt.footer_message']}</p>}

        {(values['business.whatsapp'] || values['business.social']) && (
          <p className="receipt-preview__contact">
            {values['business.whatsapp'] && <span>WhatsApp {values['business.whatsapp']}</span>}
            {values['business.social'] && <span>{values['business.social']}</span>}
          </p>
        )}

        <p className="receipt-preview__legal">{fixed?.legalNotice}</p>
      </div>
      <figcaption className="receipt-preview__caption">{PAPER_LABELS[paper]} · ejemplo con productos ficticios</figcaption>
    </figure>
  )
}

/** Reemplaza los marcadores con datos de ejemplo, como se verá el correo. */
function fillPlaceholders(text, businessName) {
  return (text ?? '')
    .replaceAll('{negocio}', businessName || 'tu negocio')
    .replaceAll('{cliente}', 'Carlos')
    .replaceAll('{numero}', SAMPLE_NUMBER)
}

/** Correo de ejemplo con el asunto y el mensaje configurados. */
export function EmailPreview({ values }) {
  const businessName = values['business.name']?.trim()
  return (
    <div className="email-preview">
      <p className="email-preview__from">De: {businessName || 'Tu negocio'}</p>
      <p className="email-preview__subject">{fillPlaceholders(values['receipt_email.subject'], businessName) || 'Sin asunto'}</p>
      <p className="email-preview__body">{fillPlaceholders(values['receipt_email.message'], businessName)}</p>
      <p className="email-preview__attachment">
        <Paperclip aria-hidden="true" /> Comprobante-{SAMPLE_NUMBER}.pdf
      </p>
    </div>
  )
}
