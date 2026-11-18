import { useState } from 'react'
import { PackagePlus, ScanBarcode } from 'lucide-react'
import { useGetProductsQuery } from '../../inventory/inventoryApi'
import { useDebouncedValue } from '../../../hooks/useDebouncedValue'
import { formatCurrency } from '../../../utils/format'

/**
 * Buscador para agregar productos a la compra: por nombre, código o código de barras.
 * Con el lector (que envía Enter), un código exacto se agrega de una vez.
 */
export function ProductSearch({ onPick, disabled = false }) {
  const [text, setText] = useState('')
  const term = useDebouncedValue(text.trim(), 250)
  const { data, isFetching } = useGetProductsQuery({ search: term, isActive: 'true', pageSize: 8 }, { skip: term.length < 2 })
  const results = term.length >= 2 ? (data?.rows ?? []) : []

  const pick = (product) => {
    onPick(product)
    setText('')
  }

  const handleKeyDown = (event) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    const typed = text.trim()
    const exact = results.find((product) => product.barcode === typed || product.code === typed.toUpperCase())
    if (exact) pick(exact)
    else if (results.length === 1) pick(results[0])
  }

  return (
    <div className="product-search">
      <label className="text-field__label" htmlFor="purchase-product-search">
        Agregar producto
      </label>
      <div className="product-search__box">
        <ScanBarcode aria-hidden="true" />
        <input
          id="purchase-product-search"
          className="product-search__input"
          type="search"
          placeholder="Escribe el nombre o el código, o escanea el código de barras"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          autoComplete="off"
          aria-controls={term.length >= 2 && results.length > 0 ? 'purchase-product-results' : undefined}
        />
      </div>
      {term.length >= 2 && results.length === 0 && (
        <p className="product-search__results product-search__empty" role="status">
          {isFetching ? 'Buscando…' : `Ningún producto activo coincide con "${term}"`}
        </p>
      )}
      {term.length >= 2 && results.length > 0 && (
        <ul className="product-search__results" id="purchase-product-results" role="listbox" aria-label="Productos encontrados">
          {results.map((product) => (
            <li key={product.id} role="none">
              <button type="button" role="option" aria-selected="false" className="product-search__option" onClick={() => pick(product)}>
                <PackagePlus aria-hidden="true" />
                <span className="product-search__text">
                  <span className="product-search__name">{product.name}</span>
                  <span className="product-search__meta">
                    {product.code} · {product.unit?.symbol}
                    {product.presentations?.some((item) => item.isActive) &&
                      ` · ${product.presentations
                        .filter((item) => item.isActive)
                        .map((item) => item.name)
                        .join(', ')}`}
                    {product.tracksBatches && ' · con lotes'}
                  </span>
                </span>
                {product.purchasePrice && <span className="product-search__price">{formatCurrency(product.purchasePrice)}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
