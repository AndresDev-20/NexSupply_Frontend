import { Minus, Plus } from 'lucide-react'
import './UnitPreview.css'

/** Selector de cantidad de ejemplo: con decimales avanza de 0,5 en 0,5; sin decimales, de 1 en 1. */
export function UnitPreview({ name, symbol, allowsDecimals }) {
  const label = symbol.trim() || 'und'
  const quantity = allowsDecimals ? '2,5' : '3'

  return (
    <div className="unit-preview">
      <p className="unit-preview__product">Producto de ejemplo</p>
      <p className="unit-preview__unit">Se vende por {name.trim().toLowerCase() || 'unidad'}</p>
      <div className="unit-preview__stepper" aria-hidden="true">
        <span className="unit-preview__step">
          <Minus />
        </span>
        <span className="unit-preview__quantity">
          {quantity} <small>{label}</small>
        </span>
        <span className="unit-preview__step">
          <Plus />
        </span>
      </div>
      <p className="unit-preview__hint">{allowsDecimals ? `Acepta fracciones: 0,25 ${label} · 1,5 ${label}` : `Solo cantidades enteras: 1, 2, 3 ${label}`}</p>
    </div>
  )
}
