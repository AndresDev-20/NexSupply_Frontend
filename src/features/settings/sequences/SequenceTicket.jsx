import { FileText } from 'lucide-react'
import './SequenceTicket.css'

/** Ficha con el número del próximo documento: "V-000124". */
export function SequenceTicket({ documentName, number, compact = false }) {
  return (
    <div className={`sequence-ticket${compact ? ' sequence-ticket--compact' : ''}`}>
      <span className="sequence-ticket__icon" aria-hidden="true">
        <FileText />
      </span>
      <span className="sequence-ticket__label">{documentName}</span>
      <span className="sequence-ticket__number">{number}</span>
    </div>
  )
}
