import { Banknote, Coins } from 'lucide-react'
import { formatCurrency } from '../../utils/format'
import { useAnimatedNumber } from '../sales/pos/useAnimatedNumber'
import { DENOMINATIONS, countTotal, denominationLabel, keyOf } from './denominations'
import './DenominationCounter.css'

/** Una fila: denominación, cuántos hay y lo que suman ("—" si no hay). */
function DenominationRow({ item, quantity, onChange, index }) {
  const subtotal = item.value * (Number(quantity) || 0)
  return (
    <label className={`denominations__row${subtotal ? ' denominations__row--filled' : ''}`} style={{ '--row-index': index }}>
      <span className="denominations__value">{formatCurrency(String(item.value))}</span>
      <input
        className="denominations__input"
        inputMode="numeric"
        placeholder="0"
        aria-label={denominationLabel(item)}
        value={quantity}
        onChange={(event) => onChange(event.target.value)}
        onFocus={(event) => event.target.select()}
      />
      {/* La key cambia con el valor para repetir la animación de "pop" */}
      <span key={subtotal} className={`denominations__subtotal${subtotal ? '' : ' denominations__subtotal--zero'}`}>
        {subtotal ? formatCurrency(String(subtotal)) : '—'}
      </span>
    </label>
  )
}

/**
 * Conteo por billetes y monedas (D-CAJA-14): cuántos hay de cada uno; el total se suma solo.
 * quantities: { 'bill:50000': '3', … }. onChange(next).
 */
export function DenominationCounter({ quantities, onChange, error }) {
  const set = (item, value) => onChange({ ...quantities, [keyOf(item)]: value.replace(/\D/g, '').slice(0, 6) })
  const total = countTotal(quantities)
  const shownTotal = useAnimatedNumber(total)
  const pieces = DENOMINATIONS.reduce((sum, item) => sum + (Number(quantities[keyOf(item)]) || 0), 0)

  const group = (kind, title, Icon) => {
    const items = DENOMINATIONS.filter((item) => item.kind === kind)
    const groupTotal = items.reduce((sum, item) => sum + item.value * (Number(quantities[keyOf(item)]) || 0), 0)
    return (
      <fieldset className={`denominations__group denominations__group--${kind}`}>
        <legend className="denominations__legend">
          <Icon aria-hidden="true" /> {title}
        </legend>
        <div className="denominations__rows">
          {items.map((item, index) => (
            <DenominationRow key={keyOf(item)} item={item} index={index} quantity={quantities[keyOf(item)] ?? ''} onChange={(value) => set(item, value)} />
          ))}
        </div>
        <p className="denominations__group-total">
          <span>{title}</span>
          <strong>{groupTotal ? formatCurrency(String(groupTotal)) : '—'}</strong>
        </p>
      </fieldset>
    )
  }

  return (
    <div className="denominations">
      <div className="denominations__groups">
        {group('bill', 'Billetes', Banknote)}
        {group('coin', 'Monedas', Coins)}
      </div>
      <div className={`denominations__total${total ? ' denominations__total--filled' : ''}`}>
        {/* El número que se ve "cuenta" hasta el total; el lector de pantalla recibe el valor final */}
        <p className="denominations__total-main" role="status">
          Total contado <strong aria-hidden="true">{formatCurrency(String(shownTotal))}</strong>
          <span className="u-visually-hidden">{formatCurrency(String(total))}</span>
        </p>
        <small className="denominations__pieces">{pieces === 0 ? 'Escribe cuántos hay de cada uno' : `${pieces} ${pieces === 1 ? 'pieza' : 'piezas'} contadas`}</small>
      </div>
      {error && <p className="denominations__error">{error}</p>}
    </div>
  )
}
