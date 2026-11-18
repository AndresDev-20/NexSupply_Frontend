import { CalendarClock, Mail, MapPin, Phone, Truck, User } from 'lucide-react'
import { normalizeNit, formatDocument } from '../../../utils/identityDocument'
import './SupplierPreview.css'

/** Tarjeta de presentación del proveedor con los datos que se van escribiendo. */
export function SupplierPreview({ form }) {
  const document = form.documentType === 'NIT' ? normalizeNit(form.documentNumber) : form.documentNumber.replace(/[\s.-]/g, '')
  const days = Number(form.paymentTermDays)
  const terms = !Number.isInteger(days) || days <= 0 ? 'De contado' : `Crédito a ${days} día${days === 1 ? '' : 's'}`
  const city = [form.address.trim(), form.city.trim()].filter(Boolean).join(' · ')

  return (
    <div className="supplier-preview">
      <div className="supplier-preview__band">
        <span className="supplier-preview__icon" aria-hidden="true">
          <Truck />
        </span>
        <div className="supplier-preview__names">
          <p className="supplier-preview__trade">{form.tradeName.trim() || form.legalName.trim() || 'Nombre del proveedor'}</p>
          {form.tradeName.trim() && form.legalName.trim() && <p className="supplier-preview__legal">{form.legalName.trim()}</p>}
          {document && <p className="supplier-preview__document">{formatDocument(form.documentType, document)}</p>}
        </div>
      </div>
      <ul className="supplier-preview__lines">
        {form.phone.trim() && (
          <li>
            <Phone aria-hidden="true" /> {form.phone.trim()}
          </li>
        )}
        {form.contactName.trim() && (
          <li>
            <User aria-hidden="true" /> {form.contactName.trim()}
            {form.contactPhone.trim() && ` · ${form.contactPhone.trim()}`}
          </li>
        )}
        {form.email.trim() && (
          <li>
            <Mail aria-hidden="true" /> {form.email.trim()}
          </li>
        )}
        {city && (
          <li>
            <MapPin aria-hidden="true" /> {city}
          </li>
        )}
        <li className="supplier-preview__terms">
          <CalendarClock aria-hidden="true" /> {terms}
        </li>
      </ul>
    </div>
  )
}
