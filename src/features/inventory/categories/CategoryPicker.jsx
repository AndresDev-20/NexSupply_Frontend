import { useEffect, useId, useRef, useState } from 'react'
import { ArrowLeft, Check, ChevronDown, ChevronRight, FolderOpen, Search, X } from 'lucide-react'
import '../../../components/ui/TextField/TextField.css'
import './CategoryPicker.css'
import { CategoryBadge } from './CategoryBadge'

const normalize = (text) =>
  String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

/** Lo elegido, con su categoría principal (para mostrar "Alimentos › Cerdos"). */
function findSelection(tree, value) {
  for (const category of tree) {
    if (String(category.id) === String(value)) return { item: category, parent: null }
    const child = category.children.find((item) => String(item.id) === String(value))
    if (child) return { item: child, parent: category }
  }
  return null
}

/**
 * Una opción de la lista (categoría o subcategoría), con su ícono y color.
 * badgeParent: categoría principal de una subcategoría (para su ícono de especie y color).
 */
function PickerOption({ item, parent, value, onClick, children, showChevron = false, badgeParent }) {
  const isSelected = String(item.id) === String(value)
  return (
    <li role="none">
      <button type="button" className={`category-picker__option${isSelected ? ' category-picker__option--selected' : ''}`} onClick={onClick} role="option" aria-selected={isSelected}>
        <CategoryBadge name={item.name} parentName={badgeParent ?? parent?.name} size="sm" />
        <span className="category-picker__option-text">
          <span className="category-picker__option-name" title={typeof (children ?? item.name) === 'string' ? (children ?? item.name) : undefined}>
            {children ?? item.name}
          </span>
          {parent && <span className="category-picker__option-parent">{parent.name}</span>}
        </span>
        {isSelected && <Check className="category-picker__check" aria-hidden="true" />}
        {showChevron && (
          <span className="category-picker__count">
            {item.children.length}
            <ChevronRight aria-hidden="true" />
          </span>
        )}
      </button>
    </li>
  )
}

/**
 * Selector de categoría en dos niveles (reemplaza la lista nativa con decenas de opciones):
 * - Al abrir: buscador y categorías principales. Al elegir una, sus subcategorías,
 *   con la opción de usar la categoría sola.
 * - Escribiendo: resultados directos, cada subcategoría con su categoría al lado.
 * value: id (texto) de la categoría o subcategoría elegida; onChange(id | '').
 * allowClear: muestra la opción de quitar la selección (filtros: "Todas").
 */
export function CategoryPicker({ label, tree = [], value, onChange, error, hint, required = false, placeholder = 'Elige una categoría', allowClear = false, clearLabel = 'Todas' }) {
  const id = useId()
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [browsing, setBrowsing] = useState(null) // categoría principal abierta
  const containerRef = useRef(null)
  const panelRef = useRef(null)
  const searchRef = useRef(null)

  const categories = tree.filter((category) => category.isActive !== false)

  // Lo elegido, con su categoría principal (para mostrar "Alimentos › Cerdos")
  const selected = findSelection(tree, value)

  const term = normalize(search.trim())
  const results = !term
    ? []
    : categories.flatMap((category) => [
        ...(normalize(category.name).includes(term) ? [{ item: category, parent: null }] : []),
        ...category.children.filter((child) => child.isActive !== false && normalize(child.name).includes(term)).map((child) => ({ item: child, parent: category })),
      ])

  const open = () => {
    setSearch('')
    // Si ya hay una subcategoría elegida, se abre directamente en su categoría
    setBrowsing(selected?.parent ?? null)
    setIsOpen(true)
  }
  const close = () => setIsOpen(false)

  const choose = (categoryId) => {
    onChange(categoryId === '' ? '' : String(categoryId))
    close()
  }

  useEffect(() => {
    if (!isOpen) return undefined
    searchRef.current?.focus()
    const handlePointer = (event) => {
      if (!containerRef.current?.contains(event.target)) close()
    }
    // Escape cierra solo el selector, no el modal que lo contiene
    const panel = panelRef.current
    const handleKey = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        close()
      }
    }
    document.addEventListener('mousedown', handlePointer)
    panel?.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      panel?.removeEventListener('keydown', handleKey)
    }
  }, [isOpen])

  let body
  if (term) {
    body =
      results.length === 0 ? (
        <p className="category-picker__empty">Sin resultados para "{search.trim()}"</p>
      ) : (
        <ul className="category-picker__list" role="listbox" aria-label="Resultados">
          {results.map(({ item, parent }) => (
            <PickerOption value={value} key={item.id} item={item} parent={parent} onClick={() => choose(item.id)} />
          ))}
        </ul>
      )
  } else if (browsing) {
    const children = browsing.children.filter((child) => child.isActive !== false)
    body = (
      <>
        <button type="button" className="category-picker__back" onClick={() => setBrowsing(null)}>
          <ArrowLeft aria-hidden="true" /> Todas las categorías
        </button>
        <p className="category-picker__group">{browsing.name}</p>
        <ul className="category-picker__list" role="listbox" aria-label={`Subcategorías de ${browsing.name}`}>
          <PickerOption value={value} item={browsing} onClick={() => choose(browsing.id)}>
            Usar solo «{browsing.name}»
          </PickerOption>
          {children.map((child) => (
            <PickerOption value={value} key={child.id} item={child} badgeParent={browsing.name} onClick={() => choose(child.id)} />
          ))}
        </ul>
      </>
    )
  } else {
    body = (
      <ul className="category-picker__list" role="listbox" aria-label="Categorías">
        {allowClear && (
          <li role="none">
            <button type="button" role="option" aria-selected={!value} className={`category-picker__option${!value ? ' category-picker__option--selected' : ''}`} onClick={() => choose('')}>
              <span className="category-picker__option-name">{clearLabel}</span>
              {!value && <Check className="category-picker__check" aria-hidden="true" />}
            </button>
          </li>
        )}
        {categories.map((category) => (
          // Con subcategorías se entra a ellas; sin subcategorías se elige directo
          <PickerOption
            value={value}
            key={category.id}
            item={category}
            showChevron={category.children.length > 0}
            onClick={() => (category.children.length > 0 ? setBrowsing(category) : choose(category.id))}
          />
        ))}
      </ul>
    )
  }

  const errorId = error ? `${id}-error` : undefined
  const hintId = hint ? `${id}-hint` : undefined

  return (
    <div className={`text-field category-picker${error ? ' text-field--invalid' : ''}`} ref={containerRef}>
      <label className={`text-field__label${required ? ' text-field__label--required' : ''}`} htmlFor={id}>
        {label}
      </label>
      <button
        id={id}
        type="button"
        className={`category-picker__trigger${isOpen ? ' category-picker__trigger--open' : ''}`}
        onClick={() => (isOpen ? close() : open())}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={[errorId, hintId].filter(Boolean).join(' ') || undefined}
      >
        {selected ? (
          <CategoryBadge name={selected.item.name} parentName={selected.parent?.name} size="sm" />
        ) : (
          <FolderOpen className="category-picker__trigger-icon" aria-hidden="true" />
        )}
        {selected ? (
          <span className="category-picker__value">
            {selected.parent && <span className="category-picker__value-parent">{selected.parent.name} ›</span>}
            <span className="category-picker__value-name">{selected.item.name}</span>
          </span>
        ) : (
          <span className="category-picker__placeholder">{allowClear ? clearLabel : placeholder}</span>
        )}
        <ChevronDown className="category-picker__chevron" aria-hidden="true" />
      </button>
      {allowClear && value && (
        <button type="button" className="category-picker__clear" onClick={() => choose('')} aria-label={`Quitar el filtro de ${label.toLowerCase()}`}>
          <X aria-hidden="true" />
        </button>
      )}

      {isOpen && (
        <div className="category-picker__panel" ref={panelRef} role="dialog" aria-label={`Elegir ${label.toLowerCase()}`}>
          <div className="category-picker__search">
            <Search aria-hidden="true" />
            <input
              ref={searchRef}
              type="search"
              placeholder="Buscar categoría o subcategoría"
              aria-label="Buscar categoría o subcategoría"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                // Enter con un solo resultado lo elige
                if (event.key === 'Enter') {
                  event.preventDefault()
                  if (results.length === 1) choose(results[0].item.id)
                }
              }}
            />
          </div>
          <div className="category-picker__body">{body}</div>
        </div>
      )}

      {error && (
        <p className="text-field__error" id={errorId}>
          {error}
        </p>
      )}
      {hint && !error && (
        <p className="text-field__hint" id={hintId}>
          {hint}
        </p>
      )}
    </div>
  )
}
