import { useState } from 'react'
import { Minus, Plus, ShoppingCart, Tag, Trash2 } from 'lucide-react'
import { formatCurrency, formatQuantity } from '../../../utils/format'
import { toApiNumber } from '../../../utils/numberInput'
import { lineLot, lineUnit, linePrice } from '../saleOptions'
import { formatDay } from '../../purchases/purchaseOptions'

// Color del avatar de cada producto: estable por id (8 tonos de la paleta)
const TONES = 8
const toneOf = (id) => `pos-avatar--t${id % TONES}`
const initials = (name) =>
  name
    .split(/\s+/)
    .filter((word) => word.length > 2)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('') || name.slice(0, 2).toUpperCase()

function EmptyCart() {
  return (
    <div className="pos-empty">
      <span className="pos-empty__icon" aria-hidden="true">
        <ShoppingCart />
      </span>
      <p>Busca o escanea un producto para empezar la venta.</p>
    </div>
  )
}

function LineDiscount({ line, product, onChange }) {
  const hasDiscount = Boolean(toApiNumber(line.discountValue))
  const [isOpen, setIsOpen] = useState(hasDiscount)
  if (!isOpen) {
    return (
      <button type="button" className="pos-chip-button" onClick={() => setIsOpen(true)} aria-label={`Agregar descuento a ${product.name}`}>
        <Tag aria-hidden="true" /> Descuento
      </button>
    )
  }
  return (
    <div className="pos-discount">
      <input
        className="pos-discount__input"
        inputMode="decimal"
        placeholder="0"
        aria-label={`Descuento de ${product.name}`}
        value={line.discountValue}
        autoFocus={!hasDiscount}
        onChange={(event) => onChange(line.key, { discountValue: event.target.value })}
        onBlur={() => !toApiNumber(line.discountValue) && setIsOpen(false)}
      />
      <div className="pos-discount__types" role="group" aria-label={`Tipo de descuento de ${product.name}`}>
        {[
          { value: 'percent', label: '%' },
          { value: 'amount', label: '$' },
        ].map((option) => (
          <button
            key={option.value}
            type="button"
            className={`pos-discount__type${line.discountType === option.value ? ' pos-discount__type--active' : ''}`}
            aria-pressed={line.discountType === option.value}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onChange(line.key, { discountType: option.value })}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * Carrito del punto de venta: una tarjeta por producto con su unidad o bulto (botones),
 * cantidad, descuento (se abre solo si se necesita) y su total calculado por el servidor.
 */
export function PosCart({ lines, computed, onChange, onRemove }) {
  if (lines.length === 0) return <EmptyCart />

  const step = (line, delta) => {
    const current = Number(toApiNumber(line.quantity)) || 0
    const next = Math.max(current + delta, 0)
    onChange(line.key, { quantity: String(next).replace('.', ',') })
  }

  return (
    <ol className="pos-cart" aria-label="Productos de la venta">
      {lines.map((line, index) => {
        const { product } = line
        const result = computed?.[index]
        const outOfStock = Number(product.stock) <= 0
        const units = [{ id: '', name: product.unit.symbol }, ...product.presentations]
        // Animal (D-ANI-1): se escoge el lote; cada uno tiene su precio de hoy
        const isAnimal = product.productKind === 'animal'
        const lot = isAnimal ? lineLot(product, line.animalLotId) : null
        // El precio oficial (con la lista del cliente, D-PRE-1) viene del servidor en la vista previa
        const price = !isAnimal && result?.unitPrice ? result.unitPrice : linePrice(product, line.presentationId, line.animalLotId)
        const regular = !isAnimal && result?.regularUnitPrice && Number(result.regularUnitPrice) > Number(result.unitPrice) ? result.regularUnitPrice : null
        return (
          <li key={line.key} className="pos-item">
            <span className={`pos-avatar ${toneOf(product.id)}`} aria-hidden="true">
              {initials(product.name)}
            </span>
            <div className="pos-item__body">
              <div className="pos-item__head">
                <span className="pos-item__name">{product.name}</span>
                <span className="pos-item__total numeric" aria-label={`Total de ${product.name}`}>
                  {result ? formatCurrency(result.total) : '—'}
                </span>
              </div>
              <p className="pos-item__meta">
                {price === null ? (
                  <span className="pos-item__pick">Escoge el lote</span>
                ) : (
                  <>
                    {regular && <s className="pos-item__regular">{formatCurrency(regular)}</s>}
                    {`${formatCurrency(price)} / ${lineUnit(product, line.presentationId)}`}
                  </>
                )}
                {isAnimal && lot ? (
                  <span className="pos-item__stock">Lote {lot.lotNumber} · quedan {formatQuantity(lot.availableQuantity)}</span>
                ) : (
                  <span className={`pos-item__stock${outOfStock ? ' pos-item__stock--out' : ''}`}>{outOfStock ? 'Agotado' : `Hay ${formatQuantity(product.stock)} ${product.unit.symbol}`}</span>
                )}
                {result && Number(result.lineDiscount) > 0 && <span className="pos-item__saving">Ahorra {formatCurrency(result.lineDiscount)}</span>}
              </p>
              <div className="pos-item__controls">
                {isAnimal && (product.animalLots ?? []).length > 1 && (
                  <div className="pos-units pos-units--lots" role="radiogroup" aria-label={`Lote de ${product.name}`}>
                    {product.animalLots.map((option) => {
                      const active = String(line.animalLotId) === String(option.id)
                      return (
                        <button
                          key={option.id}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          aria-label={`Lote ${option.lotNumber}, llegó el ${formatDay(option.receivedOn)}, ${formatCurrency(option.priceToday)}, quedan ${formatQuantity(option.availableQuantity)}`}
                          className={`pos-units__option${active ? ' pos-units__option--active' : ''}`}
                          onClick={() => onChange(line.key, { animalLotId: String(option.id) })}
                        >
                          {formatDay(option.receivedOn).slice(0, 5)} · {formatCurrency(option.priceToday)}
                        </button>
                      )
                    })}
                  </div>
                )}
                {!isAnimal && units.length > 1 && (
                  <div className="pos-units" role="radiogroup" aria-label={`Unidad de ${product.name}`}>
                    {units.map((unit) => {
                      const active = String(line.presentationId) === String(unit.id)
                      return (
                        <button key={unit.id || 'base'} type="button" role="radio" aria-checked={active} className={`pos-units__option${active ? ' pos-units__option--active' : ''}`} onClick={() => onChange(line.key, { presentationId: String(unit.id) })}>
                          {unit.name}
                        </button>
                      )
                    })}
                  </div>
                )}
                <div className="pos-qty">
                  <button type="button" className="pos-qty__button" aria-label={`Restar 1 a ${product.name}`} onClick={() => step(line, -1)}>
                    <Minus aria-hidden="true" />
                  </button>
                  <input className="pos-qty__input" inputMode="decimal" aria-label={`Cantidad de ${product.name}`} value={line.quantity} onChange={(event) => onChange(line.key, { quantity: event.target.value })} onFocus={(event) => event.target.select()} />
                  <button type="button" className="pos-qty__button" aria-label={`Sumar 1 a ${product.name}`} onClick={() => step(line, 1)}>
                    <Plus aria-hidden="true" />
                  </button>
                </div>
                <LineDiscount line={line} product={product} onChange={onChange} />
                <button type="button" className="pos-item__remove" aria-label={`Quitar ${product.name}`} onClick={() => onRemove(line.key)}>
                  <Trash2 aria-hidden="true" />
                </button>
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
