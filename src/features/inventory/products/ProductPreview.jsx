import { Barcode, Boxes, Layers, Package, Star, Warehouse } from 'lucide-react'
import { formatCurrency, formatQuantity } from '../../../utils/format'
import { TAX_RATE_OPTIONS, toApiNumber } from '../inventoryOptions'
import './ProductPreview.css'

/**
 * Ficha del producto como se verá en el punto de venta, con los datos que se escriben.
 * profit: { profit, percent } de la vista previa (solo con permiso de costos).
 * pack: { name, salePrice } del bulto, si se vende por bulto. stock: cantidad inicial en unidad base.
 */
export function ProductPreview({ form, category, parentName, unit, profit = null, pack = null, stock }) {
  const price = toApiNumber(form.salePrice)
  const taxCode = form.taxRate || category?.defaultTaxRate
  const primary = form.suppliers.find((link) => link.isPrimary)

  return (
    <article className="product-preview">
      <div className="product-preview__top">
        <span className="product-preview__icon" aria-hidden="true">
          <Package />
        </span>
        <span className="product-preview__code">{form.code.trim() || 'P-·····'}</span>
      </div>
      <p className="product-preview__name">{form.name.trim() || 'Nombre del producto'}</p>
      {category && (
        <p className="product-preview__category">
          <Layers aria-hidden="true" /> {parentName ? `${parentName} › ${category.name}` : category.name}
        </p>
      )}
      <p className="product-preview__price">
        {price ? formatCurrency(price) : '$ —'}
        {unit && <span className="product-preview__unit"> / {unit.symbol}</span>}
      </p>
      {profit && (
        <p className={`product-preview__profit${profit.profit.startsWith('-') ? ' product-preview__profit--loss' : ''}`}>
          {profit.profit.startsWith('-') ? 'Pierde' : 'Gana'} {formatCurrency(profit.profit.replace('-', ''))}
          {profit.percent !== null && ` (${profit.percent.replace('.', ',')} %)`} por {unit?.symbol ?? 'unidad'}
        </p>
      )}
      {pack && (
        <p className="product-preview__pack">
          <Boxes aria-hidden="true" />
          <span>{pack.name}</span>
          <strong>{pack.salePrice ? formatCurrency(pack.salePrice) : '$ —'}</strong>
        </p>
      )}
      {stock !== undefined && (
        <p className={`product-preview__stock${stock ? '' : ' product-preview__stock--out'}`}>
          <Warehouse aria-hidden="true" />
          {stock ? `Hay ${formatQuantity(stock)} ${unit?.symbol ?? ''}` : 'Agotado'}
        </p>
      )}
      <div className="product-preview__tags">
        {taxCode && <span className="product-preview__tag">{TAX_RATE_OPTIONS.find((option) => option.value === taxCode)?.label}</span>}
        {form.tracksBatches && <span className="product-preview__tag">Con lotes</span>}
        {unit && !unit.allowsDecimals && <span className="product-preview__tag">Solo enteros</span>}
      </div>
      {form.barcode.trim() && (
        <p className="product-preview__barcode">
          <Barcode aria-hidden="true" />
          <span>{form.barcode.trim()}</span>
        </p>
      )}
      {primary && (
        <p className="product-preview__supplier">
          <Star aria-hidden="true" /> {primary.name}
        </p>
      )}
    </article>
  )
}
