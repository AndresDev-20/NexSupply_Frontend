import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, BadgePercent, Pencil, RotateCw, Search, Tag, TriangleAlert, X } from 'lucide-react'
import { useGetPriceListProductsQuery, useGetPriceListQuery, useRemovePriceListItemMutation, useSetPriceListItemMutation } from './priceListsApi'
import { PriceListFormModal } from './PriceListFormModal'
import { priceListLabel } from './priceListOptions'
import { useDebouncedValue } from '../../../hooks/useDebouncedValue'
import { useToast } from '../../../components/feedback/Toast/toastContext'
import { StatusMessage } from '../../../components/feedback/StatusMessage/StatusMessage'
import { FilterBar } from '../../../components/layout/FilterBar/FilterBar'
import { Modal } from '../../../components/ui/Modal/Modal'
import { Button } from '../../../components/ui/Button/Button'
import { IconButton } from '../../../components/ui/IconButton/IconButton'
import { Badge } from '../../../components/ui/Badge/Badge'
import { TextField } from '../../../components/ui/TextField/TextField'
import { DataTable } from '../../../components/ui/DataTable/DataTable'
import { Pagination } from '../../../components/ui/Pagination/Pagination'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog/ConfirmDialog'
import { Spinner } from '../../../components/ui/Spinner/Spinner'
import { Alert } from '../../../components/feedback/Alert/Alert'
import { splitApiError } from '../../../utils/formErrors'
import { formatCurrency } from '../../../utils/format'
import { MONEY_PATTERN, toApiNumber, toInputNumber } from '../../../utils/numberInput'
import { ROUTES } from '../../../routes/paths'
import '../../admin/admin.css'
import '../../cash/cash.css'
import '../../settings/settings.css'
import './priceLists.css'

/** Una fila por producto (en su unidad) y otra por cada presentación que se vende completa. */
function toRows(products) {
  return products.flatMap((product) => [
    { key: `${product.id}:0`, productId: product.id, presentationId: null, name: product.name, code: product.code, unit: product.unitSymbol, regularPrice: product.regularPrice, price: product.price, special: product.special },
    ...product.presentations.map((presentation) => ({
      key: `${product.id}:${presentation.id}`,
      productId: product.id,
      presentationId: presentation.id,
      name: product.name,
      code: product.code,
      unit: presentation.name,
      regularPrice: presentation.regularPrice,
      price: presentation.price,
      special: presentation.special,
    })),
  ])
}

/** Poner o cambiar el precio especial de un producto o presentación. */
function SpecialPriceModal({ listId, row, onClose, onSaved }) {
  const [price, setPrice] = useState(row.special ? toInputNumber(row.price) : '')
  const [localError, setLocalError] = useState(null)
  const [save, state] = useSetPriceListItemMutation()
  const { fieldErrors, formError } = splitApiError(state.error)

  const handleSubmit = async (event) => {
    event.preventDefault()
    const value = toApiNumber(price)
    if (!MONEY_PATTERN.test(value) || Number(value) <= 0) {
      setLocalError('Escribe el precio especial (ej. 85.000)')
      return
    }
    try {
      await save({ id: listId, productId: row.productId, presentationId: row.presentationId, price: value }).unwrap()
      onSaved()
    } catch {
      // Se muestra desde state.error
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      isBusy={state.isLoading}
      icon={Tag}
      title="Precio especial"
      description={`${row.name} · ${row.unit}. Precio normal: ${formatCurrency(row.regularPrice)}.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={state.isLoading}>
            Cancelar
          </Button>
          <Button type="submit" form="special-price-form" isLoading={state.isLoading}>
            Guardar precio
          </Button>
        </>
      }
    >
      <form id="special-price-form" onSubmit={handleSubmit} noValidate>
        {formError && (
          <div className="admin-form__alert">
            <Alert tone="danger">{formError}</Alert>
          </div>
        )}
        <TextField
          label="Precio especial"
          icon={Tag}
          inputMode="decimal"
          placeholder="Ej.: 85.000"
          hint="Este precio fijo reemplaza el % de la lista para este producto."
          data-autofocus
          value={price}
          onChange={(event) => {
            setPrice(event.target.value)
            setLocalError(null)
          }}
          error={localError ?? fieldErrors.price}
          required
        />
      </form>
    </Modal>
  )
}

/** /clientes/listas-de-precios/:id — Los precios de una lista y sus precios especiales (D-PRE-1). */
export default function PriceListPage() {
  const { id } = useParams()
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const debounced = useDebouncedValue(search.trim(), 300)
  const { data: list, error, isLoading, refetch } = useGetPriceListQuery(id)
  const { data: products, isFetching, error: productsError, refetch: refetchProducts } = useGetPriceListProductsQuery({ id, search: debounced || undefined, page, pageSize: 20 }, { skip: !list })
  const [removeItem, removeState] = useRemovePriceListItemMutation()
  const [editingList, setEditingList] = useState(false)
  const [editingRow, setEditingRow] = useState(null)
  const [toRemove, setToRemove] = useState(null)

  if (isLoading) return <Spinner label="Cargando la lista…" />
  if (error || !list) {
    return (
      <StatusMessage icon={TriangleAlert} tone="danger" title={error?.status === 404 ? 'La lista no existe' : 'No se pudo cargar la lista'} description={error?.message}>
        <Link className="button button--secondary button--md" to={ROUTES.priceLists}>
          <ArrowLeft className="button__icon" aria-hidden="true" />
          <span className="button__label">Volver a las listas</span>
        </Link>
        {error?.status !== 404 && (
          <Button icon={RotateCw} onClick={refetch}>
            Reintentar
          </Button>
        )}
      </StatusMessage>
    )
  }

  const itemFor = (row) => list.items.find((item) => item.productId === row.productId && (item.presentationId ?? null) === row.presentationId)

  const handleRemove = async () => {
    const item = itemFor(toRemove)
    try {
      if (item) await removeItem({ id: list.id, itemId: item.id }).unwrap()
      toast.success('Precio especial quitado')
    } catch (removeError) {
      toast.error(removeError.message)
    }
    setToRemove(null)
  }

  const columns = [
    {
      key: 'product',
      header: 'Producto',
      primary: true,
      render: (row) => (
        <span className="price-list-product">
          <strong>{row.name}</strong>
          <small>
            {row.code} · {row.unit}
          </small>
        </span>
      ),
    },
    { key: 'regular', header: 'Precio normal', align: 'end', render: (row) => <span className="numeric">{formatCurrency(row.regularPrice)}</span> },
    {
      key: 'price',
      header: `Precio ${list.name}`,
      align: 'end',
      render: (row) => (
        <span className="price-list-price">
          {row.special && <Badge tone="accent">Especial</Badge>}
          <strong className="numeric">{formatCurrency(row.price)}</strong>
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Acciones',
      align: 'end',
      render: (row) => (
        <div className="row-actions">
          <IconButton icon={Tag} label={row.special ? `Cambiar el precio especial de ${row.name} (${row.unit})` : `Poner precio especial a ${row.name} (${row.unit})`} onClick={() => setEditingRow(row)} />
          {row.special && <IconButton icon={X} tone="danger" label={`Quitar el precio especial de ${row.name} (${row.unit})`} onClick={() => setToRemove(row)} />}
        </div>
      ),
    },
  ]

  return (
    <div className="purchase-detail">
      <Link className="cash-session__back" to={ROUTES.priceLists}>
        <ArrowLeft aria-hidden="true" /> Listas de precios
      </Link>

      <header className={`cash-session__header cash-session__header--${list.isActive ? 'info' : 'warning'}`}>
        <span className="cash-session__icon" aria-hidden="true">
          <BadgePercent />
        </span>
        <div className="cash-session__title">
          <h2>{list.name}</h2>
          <p>
            {priceListLabel(list).split(' · ')[1]} · {list.customersCount} {list.customersCount === 1 ? 'cliente' : 'clientes'} · {list.itemsCount} {list.itemsCount === 1 ? 'precio especial' : 'precios especiales'}
          </p>
        </div>
        {!list.isActive && <span className="status-pill status-pill--neutral">Inactiva</span>}
        <Button variant="secondary" icon={Pencil} onClick={() => setEditingList(true)}>
          Editar
        </Button>
      </header>

      {!list.isActive && <Alert tone="warning">Esta lista está desactivada: sus clientes pagan el precio normal.</Alert>}

      <FilterBar>
        <TextField
          label="Buscar"
          icon={Search}
          type="search"
          placeholder="Nombre o código del producto"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setPage(1)
          }}
        />
      </FilterBar>

      <DataTable
        caption={`Precios de ${list.name}`}
        columns={columns}
        rows={toRows(products?.rows ?? [])}
        getRowId={(row) => row.key}
        isLoading={isFetching}
        error={productsError}
        onRetry={refetchProducts}
        emptyTitle={debounced ? 'Ningún producto coincide' : 'Aún no hay productos'}
        emptyDescription="Los animales no aparecen: su precio es el del día de su lote."
      />
      <Pagination meta={products?.pagination} onPageChange={setPage} itemLabel="productos" />

      {editingList && (
        <PriceListFormModal
          priceList={list}
          onClose={() => setEditingList(false)}
          onSaved={(saved) => {
            setEditingList(false)
            toast.success(`${saved.name} actualizada`)
          }}
        />
      )}
      {editingRow && (
        <SpecialPriceModal
          listId={list.id}
          row={editingRow}
          onClose={() => setEditingRow(null)}
          onSaved={() => {
            setEditingRow(null)
            toast.success('Precio especial guardado')
          }}
        />
      )}
      <ConfirmDialog
        isOpen={Boolean(toRemove)}
        tone="danger"
        title="Quitar precio especial"
        message={toRemove ? `${toRemove.name} (${toRemove.unit}) vuelve al precio normal con el % de la lista.` : ''}
        confirmLabel="Quitar"
        isLoading={removeState.isLoading}
        onConfirm={handleRemove}
        onCancel={() => setToRemove(null)}
      />
    </div>
  )
}
