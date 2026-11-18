import { forwardRef, useEffect, useState } from 'react'
import { PackageSearch, Plus, ScanBarcode, Search } from 'lucide-react'
import { useLazySearchSaleCatalogQuery } from '../salesApi'
import { useDebouncedValue } from '../../../hooks/useDebouncedValue'
import { formatCurrency, formatQuantity } from '../../../utils/format'

function IdleState() {
  return (
    <div className="pos-idle">
      <div className="pos-idle__art" aria-hidden="true">
        <span className="pos-idle__ring" />
        <ScanBarcode />
      </div>
      <p className="pos-idle__title">Lista para vender</p>
      <p className="pos-idle__text">Escribe para buscar o escanea el código de barras con el lector.</p>
      <ul className="pos-idle__keys" aria-label="Atajos de teclado">
        <li>
          <kbd>/</kbd> Buscar
        </li>
        <li>
          <kbd>Enter</kbd> Agregar
        </li>
        <li>
          <kbd>F2</kbd> Cobrar
        </li>
      </ul>
    </div>
  )
}

/**
 * Tarjeta "Buscar o escanear" (D10). El lector escribe el código y envía Enter: con un solo
 * resultado el producto entra directo a la venta (con la presentación del código si es la de
 * un bulto). Al escribir se listan coincidencias dentro de la tarjeta; ↑ ↓ y Enter para agregar.
 */
export const PosSearch = forwardRef(function PosSearch({ onPick, disabled = false }, ref) {
  const [text, setText] = useState('')
  const [highlight, setHighlight] = useState(0)
  const [search, { data: results = [], isFetching }] = useLazySearchSaleCatalogQuery()
  const debounced = useDebouncedValue(text.trim(), 250)
  const isSearching = debounced.length >= 2 && text.trim().length >= 2

  useEffect(() => {
    if (debounced.length >= 2) search(debounced, true)
  }, [debounced, search])

  const pick = (product) => {
    onPick(product, product.matchedPresentationId ?? '')
    setText('')
    setHighlight(0)
  }

  const handleKeyDown = async (event) => {
    if (event.key === 'ArrowDown' && isSearching) {
      event.preventDefault()
      setHighlight((value) => Math.min(value + 1, results.length - 1))
    } else if (event.key === 'ArrowUp' && isSearching) {
      event.preventDefault()
      setHighlight((value) => Math.max(value - 1, 0))
    } else if (event.key === 'Escape') {
      setText('')
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const value = text.trim()
      if (!value) return
      // Lo escrito coincide con la lista visible: se agrega el resaltado
      if (isSearching && debounced === value && results[highlight]) {
        pick(results[highlight])
        return
      }
      // Lector de código de barras (o Enter rápido): se busca ya
      try {
        const found = await search(value).unwrap()
        if (found.length === 1) pick(found[0])
      } catch {
        // La lista muestra "No se encontró"
      }
    }
  }

  return (
    <section className="pos-panel pos-panel--search" aria-label="Buscar o escanear">
      <header className="pos-panel__head">
        <span className="pos-panel__icon" aria-hidden="true">
          <Search />
        </span>
        <span className="pos-panel__titles">
          <strong>Buscar o escanear</strong>
          <small>Nombre, código interno o código de barras.</small>
        </span>
      </header>
      <div className="pos-search">
        <label className="u-visually-hidden" htmlFor="pos-search-input">
          Escanea o busca el producto
        </label>
        <div className="pos-search__control">
          <ScanBarcode className="pos-search__icon" aria-hidden="true" />
          <input
            ref={ref}
            id="pos-search-input"
            className="pos-search__input"
            type="search"
            autoComplete="off"
            placeholder="Nombre, código o escanea y Enter"
            value={text}
            disabled={disabled}
            onChange={(event) => {
              setText(event.target.value)
              setHighlight(0)
            }}
            onKeyDown={handleKeyDown}
            aria-controls={isSearching ? 'pos-search-results' : undefined}
          />
        </div>
      </div>

      {!isSearching ? (
        <IdleState />
      ) : (
        <ul id="pos-search-results" className="pos-results" aria-label="Productos encontrados">
          {!isFetching && results.length === 0 && (
            <li className="pos-results__empty">
              <PackageSearch aria-hidden="true" /> No se encontró “{text.trim()}”
            </li>
          )}
          {results.map((product, index) => {
            const outOfStock = Number(product.stock) <= 0
            return (
              <li key={product.id}>
                <button type="button" aria-current={index === highlight ? 'true' : undefined} className={`pos-result${index === highlight ? ' pos-result--active' : ''}`} onMouseEnter={() => setHighlight(index)} onClick={() => pick(product)}>
                  <span className="pos-result__text">
                    <strong>{product.name}</strong>
                    <small>
                      {product.code}
                      {product.presentations.length > 0 && ` · ${product.presentations.map((pack) => `${pack.name} ${formatCurrency(pack.salePrice)}`).join(' · ')}`}
                    </small>
                  </span>
                  <span className="pos-result__price">
                    {formatCurrency(product.salePrice)}
                    <small className={outOfStock ? 'pos-result__stock--out' : undefined}>{outOfStock ? 'Agotado' : `Hay ${formatQuantity(product.stock)} ${product.unit.symbol}`}</small>
                  </span>
                  <span className="pos-result__add" aria-hidden="true">
                    <Plus />
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
})
