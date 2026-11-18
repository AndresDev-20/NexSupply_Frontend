import { useMemo, useRef, useState } from 'react'
import { ChevronRight, FolderOpen, FolderPlus, Package, Pencil, Plus, Power, RotateCw, Search, Tags, TriangleAlert } from 'lucide-react'
import { useGetCategoriesQuery, useSetCategoryActiveMutation } from '../inventoryApi'
import { taxRateLabel, EXPIRED_POLICY_OPTIONS } from '../inventoryOptions'
import { useToast } from '../../../components/feedback/Toast/toastContext'
import { PageHeader } from '../../../components/layout/PageHeader/PageHeader'
import { StatusMessage } from '../../../components/feedback/StatusMessage/StatusMessage'
import { Button } from '../../../components/ui/Button/Button'
import { IconButton } from '../../../components/ui/IconButton/IconButton'
import { Badge } from '../../../components/ui/Badge/Badge'
import { Switch } from '../../../components/ui/Switch/Switch'
import { TextField } from '../../../components/ui/TextField/TextField'
import { Spinner } from '../../../components/ui/Spinner/Spinner'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog/ConfirmDialog'
import { CategoryFormModal } from './CategoryFormModal'
import { CategoryBadge } from './CategoryBadge'
import { categoryVisual } from './categoryVisuals'
import '../../admin/admin.css'
import './CategoriesPage.css'

const policyShort = (code) => EXPIRED_POLICY_OPTIONS.find((option) => option.value === code)?.short ?? code
const POLICY_TONE = { forbidden: 'danger', authorization: 'warning', allowed: 'success' }

/** Para buscar sin mayúsculas ni tildes. */
const normalize = (text) =>
  String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

const plural = (count, singular, pluralForm) => `${count} ${count === 1 ? singular : pluralForm}`

/**
 * Categorías y subcategorías (D-INV-1) en formato lista y detalle: a la izquierda
 * todas las categorías con el mismo tamaño; a la derecha, la elegida con sus
 * subcategorías en una cuadrícula uniforme. Pantalla para quien tiene categories.manage.
 */
export default function CategoriesPage() {
  const toast = useToast()
  const [showInactive, setShowInactive] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const detailRef = useRef(null)
  const { data: tree = [], isLoading, error, refetch } = useGetCategoriesQuery({ includeInactive: showInactive })
  const [setActive, toggleState] = useSetCategoryActiveMutation()
  const [editing, setEditing] = useState(null) // { category?, parent? }
  const [toToggle, setToToggle] = useState(null)

  // La búsqueda encuentra categorías por su nombre o por el de sus subcategorías
  const term = normalize(search.trim())
  const filtered = useMemo(() => {
    if (!term) return tree.map((category) => ({ category, children: category.children, matchedByChild: false }))
    return tree
      .map((category) => {
        const ownMatch = normalize(category.name).includes(term)
        const children = category.children.filter((child) => normalize(child.name).includes(term))
        return { category, children: ownMatch ? category.children : children, matchedByChild: !ownMatch && children.length > 0 }
      })
      .filter(({ category, children }) => normalize(category.name).includes(term) || children.length > 0)
  }, [tree, term])

  const selected = filtered.find(({ category }) => category.id === selectedId) ?? filtered[0] ?? null

  // Si la elegida no está visible (búsqueda o inactivas ocultas), se muestra la primera de la lista

  const choose = (id) => {
    setSelectedId(id)
    // En celular el detalle queda debajo de la lista: se lleva a la vista
    if (window.matchMedia?.('(max-width: 1023px)').matches) detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleToggle = async () => {
    try {
      const updated = await setActive({ id: toToggle.id, active: !toToggle.isActive }).unwrap()
      toast.success(updated.isActive ? `${updated.name} fue activada` : `${updated.name} fue desactivada`)
    } catch (toggleError) {
      toast.error(toggleError.message)
    }
    setToToggle(null)
  }

  let content
  if (isLoading) {
    content = (
      <div className="categories-page__state">
        <Spinner size="lg" label="Cargando categorías…" />
      </div>
    )
  } else if (error) {
    content = (
      <StatusMessage icon={TriangleAlert} tone="danger" title="No se pudieron cargar las categorías" description={error.message}>
        <Button icon={RotateCw} onClick={refetch}>
          Reintentar
        </Button>
      </StatusMessage>
    )
  } else if (tree.length === 0) {
    content = (
      <StatusMessage icon={FolderOpen} title="Aún no hay categorías" description="Crea la primera, por ejemplo: Alimentos, Medicamentos o Herramientas.">
        <Button icon={FolderPlus} onClick={() => setEditing({})}>
          Nueva categoría
        </Button>
      </StatusMessage>
    )
  } else {
    const totalProducts = (item) => item.productCount + item.children.reduce((sum, child) => sum + child.productCount, 0)
    content = (
      <div className="categories-layout">
        {/* ---------- Lista de categorías ---------- */}
        <nav className="categories-list" aria-label="Categorías">
          {filtered.length === 0 ? (
            <p className="categories-list__empty">Ninguna categoría coincide con "{search.trim()}".</p>
          ) : (
            <ul className="categories-list__items">
              {filtered.map(({ category, children, matchedByChild }) => {
                const isSelected = selected?.category.id === category.id
                return (
                  <li key={category.id}>
                    <button
                      type="button"
                      className={`categories-list__item${isSelected ? ' categories-list__item--selected' : ''}${category.isActive ? '' : ' categories-list__item--inactive'}`}
                      aria-current={isSelected ? 'true' : undefined}
                      onClick={() => choose(category.id)}
                    >
                      <CategoryBadge name={category.name} solid={isSelected} />
                      <span className="categories-list__text">
                        <span className="categories-list__name">{category.name}</span>
                        <span className="categories-list__meta">
                          {matchedByChild ? `${plural(children.length, 'coincidencia', 'coincidencias')}` : plural(category.children.length, 'subcategoría', 'subcategorías')} ·{' '}
                          {plural(totalProducts(category), 'producto', 'productos')}
                        </span>
                      </span>
                      {!category.isActive && <Badge tone="neutral">Inactiva</Badge>}
                      <ChevronRight className="categories-list__chevron" aria-hidden="true" />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </nav>

        {/* ---------- Detalle de la categoría elegida ---------- */}
        <section className="category-detail" ref={detailRef} aria-live="polite">
          {selected && (
            <>
              <header className="category-detail__header" data-tone={categoryVisual(selected.category.name).tone}>
                <CategoryBadge name={selected.category.name} size="lg" solid />
                <div className="category-detail__title">
                  <h2 className="category-detail__name">{selected.category.name}</h2>
                  <div className="category-detail__badges">
                    <Badge tone="info">{taxRateLabel(selected.category.defaultTaxRate)}</Badge>
                    <Badge tone={POLICY_TONE[selected.category.expiredSalePolicy]}>Vencidos: {policyShort(selected.category.expiredSalePolicy)}</Badge>
                    {!selected.category.isActive && <Badge tone="neutral">Inactiva</Badge>}
                  </div>
                </div>
                <div className="category-detail__actions">
                  {selected.category.isActive && (
                    <Button size="sm" icon={Plus} onClick={() => setEditing({ parent: selected.category })} aria-label={`Agregar subcategoría a ${selected.category.name}`}>
                      Subcategoría
                    </Button>
                  )}
                  <IconButton icon={Pencil} label={`Editar ${selected.category.name}`} onClick={() => setEditing({ category: selected.category })} />
                  <IconButton
                    icon={Power}
                    tone={selected.category.isActive ? 'danger' : 'success'}
                    label={selected.category.isActive ? `Desactivar ${selected.category.name}` : `Activar ${selected.category.name}`}
                    onClick={() => setToToggle(selected.category)}
                  />
                </div>
              </header>

              <div className="category-detail__stats">
                <span>
                  <Tags aria-hidden="true" /> {plural(selected.category.children.length, 'subcategoría', 'subcategorías')}
                </span>
                <span>
                  <Package aria-hidden="true" /> {plural(selected.category.productCount, 'producto', 'productos')} directamente en la categoría
                </span>
              </div>

              {selected.children.length === 0 ? (
                <div className="category-detail__empty">
                  <p>Sin subcategorías{term ? ' que coincidan con la búsqueda' : ''}.</p>
                  {!term && selected.category.isActive && (
                    <Button variant="secondary" size="sm" icon={Plus} onClick={() => setEditing({ parent: selected.category })}>
                      Agregar la primera
                    </Button>
                  )}
                </div>
              ) : (
                <ul className="subcategory-grid" aria-label={`Subcategorías de ${selected.category.name}`}>
                  {selected.children.map((child) => (
                    <li
                      key={child.id}
                      className={`subcategory-card${child.isActive ? '' : ' subcategory-card--inactive'}`}
                      data-tone={categoryVisual(selected.category.name).tone}
                    >
                      {/* Arriba: ícono y nombre con todo el ancho. Abajo: datos y acciones */}
                      <div className="subcategory-card__head">
                        <CategoryBadge name={child.name} parentName={selected.category.name} size="sm" />
                        <span className="subcategory-card__name" title={child.name}>
                          {child.name}
                        </span>
                      </div>
                      <div className="subcategory-card__foot">
                        <span className="subcategory-card__meta">
                          <Badge tone={POLICY_TONE[child.expiredSalePolicy]}>{policyShort(child.expiredSalePolicy)}</Badge>
                          <span>{plural(child.productCount, 'producto', 'productos')}</span>
                          {!child.isActive && <Badge tone="neutral">Inactiva</Badge>}
                        </span>
                        <div className="subcategory-card__actions">
                        <IconButton icon={Pencil} label={`Editar ${child.name}`} onClick={() => setEditing({ category: child, parent: selected.category })} />
                        <IconButton
                          icon={Power}
                          tone={child.isActive ? 'danger' : 'success'}
                          label={child.isActive ? `Desactivar ${child.name}` : `Activar ${child.name}`}
                          onClick={() => setToToggle(child)}
                        />
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      </div>
    )
  }

  return (
    <>
      <PageHeader
        description="Organiza los productos en categorías y subcategorías. Cada una define la tarifa de IVA y la regla de vencidos que heredan sus productos nuevos."
        actions={
          <Button icon={FolderPlus} onClick={() => setEditing({})}>
            Nueva categoría
          </Button>
        }
      />

      <div className="categories-toolbar">
        <TextField label="Buscar" icon={Search} type="search" placeholder="Categoría o subcategoría" value={search} onChange={(event) => setSearch(event.target.value)} />
        <div className="categories-toolbar__switch">
          <Switch label="Mostrar inactivas" checked={showInactive} onChange={setShowInactive} />
        </div>
      </div>

      {content}

      {editing && (
        <CategoryFormModal
          category={editing.category}
          parent={editing.parent}
          onClose={() => setEditing(null)}
          onSaved={(saved, isEdit) => {
            setEditing(null)
            if (!isEdit && !saved.parentId) setSelectedId(saved.id)
            toast.success(isEdit ? `${saved.name} actualizada` : `${saved.name} creada`)
          }}
        />
      )}

      <ConfirmDialog
        isOpen={Boolean(toToggle)}
        tone={toToggle?.isActive ? 'danger' : 'primary'}
        title={toToggle?.isActive ? 'Desactivar categoría' : 'Activar categoría'}
        message={
          toToggle?.isActive
            ? `${toToggle.name} dejará de ofrecerse para productos nuevos. No se puede desactivar si tiene productos o subcategorías activas.`
            : `${toToggle?.name} volverá a estar disponible.`
        }
        confirmLabel={toToggle?.isActive ? 'Desactivar' : 'Activar'}
        isLoading={toggleState.isLoading}
        onConfirm={handleToggle}
        onCancel={() => setToToggle(null)}
      />
    </>
  )
}
