import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import './SecretValue.css'

/** Muestra un valor para copiar (ej. contraseña temporal) con botón "Copiar". */
export function SecretValue({ value, label }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Sin permiso de portapapeles: el valor sigue visible para copiarlo a mano
    }
  }

  return (
    <div className="secret-value">
      <span className="u-visually-hidden">{label}: </span>
      <code className="secret-value__code">{value}</code>
      <button type="button" className="secret-value__copy" onClick={handleCopy}>
        {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        <span>{copied ? 'Copiada' : 'Copiar'}</span>
      </button>
    </div>
  )
}
