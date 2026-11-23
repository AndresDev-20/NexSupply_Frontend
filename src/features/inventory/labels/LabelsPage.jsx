import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Printer, Search, Tag, Trash2 } from 'lucide-react'
import { useGetProductsQuery, usePrepareLabelsMutation } from '../inventoryApi'
import { Barcode } from './Barcode'
import { useDebouncedValue } from '../../../hooks/useDebouncedValue'
import { useToast } from '../../../components/feedback/Toast/toastContext'
import { PageHeader } from '../../../components/layout/PageHeader/PageHeader'
import { FormSection } from '../../../components/ui/FormSection/FormSection'
import { TextField } from '../../../components/ui/TextField/TextField'
import { Button } from '../../../components/ui/Button/Button'
import { IconButton } from '../../../components/ui/IconButton/IconButton'
import { Badge } from '../../../components/ui/Badge/Badge'
import { formatCurrency } from '../../../utils/format'
import '../../admin/admin.css'
import '../../sales/sales.css'
import './labels.css'

// Hoja carta de stickers: 3 columnas × 10 filas (tamaño tipo 66,7 × 25,4 mm)
const PER_SHEET = 30

/** Una etiqueta: nombre, presentación, precio y código de barras. */
function Label({ label }) {
  return (
    <div className="label">
      <span className="label__name">{label.name}</span>
      {label.presentationName && <span className="label__pack">{label.presentationName}</span>}
      <span className="label__price">{formatCurrency(label.price)}</span>
      <Barcode value={label.barcode} height={28} width={1.3} fontSize={10} />
    </div>
  )
}

const OFFSET_KEY = 'nexsupply.labels.offset'
const DEFAULT_OFFSET = { top: '0', left: '0' }

/** Ajuste de márgenes guardado en este equipo (cada impresora corre la hoja distinto). */
function readOffset() {
  try {
    return { ...DEFAULT_OFFSET, ...JSON.parse(window.localStorage.getItem(OFFSET_KEY) ?? '{}') }
  } catch {
    return DEFAULT_OFFSET
  }
}

/** "-2,5" → -2.5, entre -15 y 15 mm. */
const mm = (value) => Math.max(-15, Math.min(15, Number(String(value).replace(',', '.')) || 0))

/** Hojas de etiquetas: deja vacías las primeras (startAt) para reusar una hoja empezada. */
function Sheets({ labels, startAt, offset = DEFAULT_OFFSET }) {
  const cells = [...Array(Math.max(0, startAt - 1)).fill(null), ...labels.flatMap((label) => Array(label.copies).fill(label))]
  const pages = []
  for (let index = 0; index < cells.length; index += PER_SHEET) pages.push(cells.slice(index, index + PER_SHEET))
  return pages.map((page, pageIndex) => (
    <div className="label-sheet" key={pageIndex} style={{ paddingTop: `${12.7 + mm(offset.top)}mm`, paddingLeft: `${4.8 + mm(offset.left)}mm` }}>
      {page.map((cell, cellIndex) => (cell ? <Label key={cellIndex} label={cell} /> : <div key={cellIndex} className="label label--empty" />))}
    </div>
  ))
}

/**
 * /inventario/etiquetas — Imprimir etiquetas con código de barras en hoja carta (D-INV-21).
 * A lo que no tenga código, el sistema le crea uno interno al preparar las etiquetas.
 */
export default function LabelsPage() {
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState([]) // { key, product, presentationId, copies }
  const rowCounter = useRef(0)
  const [startAt, setStartAt] = useState('1')
  const [offset, setOffset] = useState(readOffset)
  const changeOffset = (name, value) => {
    const next = { ...offset, [name]: value.replace(/[^\d,.-]/g, '') }
    setOffset(next)
    try {
      window.localStorage.setItem(OFFSET_KEY, JSON.stringify(next))
    } catch {
      // Sin almacenamiento del navegador: el ajuste vale solo mientras la página esté abierta
    }
  }
  const [prepared, setPrepared] = useState(null)
  const debounced = useDebouncedValue(search.trim(), 250)
  const { data: found } = useGetProductsQuery({ search: debounced, isActive: 'true', pageSize: 8 }, { skip: debounced.length < 2 })
  const [prepareLabels, prepareState] = usePrepareLabelsMutation()

  const options = (found?.rows ?? []).filter((product) => product.productKind !== 'animal')
  const add = (product, presentationId = null) => {
    rowCounter.current += 1
    const key = `r${rowCounter.current}`
    setRows((current) => [...current, { key, product, presentationId, copies: '1' }])
    setPrepared(null)
    setSearch('')
  }
  const change = (key, changes) => {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...changes } : row)))
    setPrepared(null)
  }

  const handlePrepare = async () => {
    try {
      const result = await prepareLabels({ items: rows.map((row) => ({ productId: row.product.id, presentationId: row.presentationId, copies: Math.min(300, Math.max(1, Number(row.copies) || 1)) })) }).unwrap()
      setPrepared(result.labels)
      toast.success(result.message ?? 'Etiquetas listas')
    } catch (prepareError) {
      toast.error(prepareError.details?.[0]?.message ?? prepareError.message)
    }
  }

  const handlePrint = () => {
    const style = document.createElement('style')
    style.textContent = '@media print { @page { size: letter; margin: 0; } }'
    document.head.appendChild(style)
    const cleanup = () => {
      style.remove()
      window.removeEventListener('afterprint', cleanup)
    }
    window.addEventListener('afterprint', cleanup)
    window.print()
  }

  const start = Math.min(PER_SHEET, Math.max(1, Number(startAt) || 1))
  const total = rows.reduce((sum, row) => sum + Math.max(1, Number(row.copies) || 1), 0)

  return (
    <>
      <PageHeader description="Etiquetas con nombre, precio y código de barras para pegar en los productos o la góndola, en hoja carta de stickers (3 × 10). A lo que no tenga código, el sistema le crea uno interno que el lector del punto de venta reconoce." />

      <FormSection icon={Search} title="Productos" description="Busca y agrega; escoge la unidad o el bulto y cuántas etiquetas.">
        <div className="labels-search form-section__full">
          <TextField label="Buscar producto" icon={Search} type="search" placeholder="Nombre o código" value={search} onChange={(event) => setSearch(event.target.value)} />
          {options.length > 0 && (
            <ul className="labels-results" aria-label="Productos encontrados">
              {options.map((product) => (
                <li key={product.id}>
                  <span>
                    <strong>{product.name}</strong> <small>{product.code}</small>
                  </span>
                  <span className="labels-results__actions">
                    <Button size="sm" variant="secondary" icon={Plus} onClick={() => add(product)}>
                      {product.unit?.symbol}
                    </Button>
                    {product.presentations
                      .filter((presentation) => presentation.isActive && presentation.isSoldWhole)
                      .map((presentation) => (
                        <Button key={presentation.id} size="sm" variant="secondary" icon={Plus} onClick={() => add(product, presentation.id)}>
                          {presentation.name}
                        </Button>
                      ))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </FormSection>

      {rows.length > 0 && (
        <section className="labels-list" aria-label="Etiquetas a imprimir">
          {rows.map((row) => {
            const presentation = row.product.presentations.find((item) => item.id === row.presentationId)
            const barcode = presentation ? presentation.barcode : row.product.barcode
            return (
              <div key={row.key} className="labels-row">
                <span className="labels-row__name">
                  <strong>{row.product.name}</strong>
                  <small>
                    {presentation?.name ?? row.product.unit?.symbol} · {formatCurrency(presentation?.salePrice ?? row.product.salePrice)}
                  </small>
                  {!barcode && <Badge tone="info">Se le creará un código interno</Badge>}
                </span>
                <label className="labels-row__copies">
                  <span>Etiquetas</span>
                  <input inputMode="numeric" value={row.copies} aria-label={`Etiquetas de ${row.product.name}`} onChange={(event) => change(row.key, { copies: event.target.value.replace(/\D/g, '') })} />
                </label>
                <IconButton icon={Trash2} tone="danger" label={`Quitar ${row.product.name}`} onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))} />
              </div>
            )
          })}
          <div className="labels-actions">
            <TextField label="Empezar en la etiqueta" inputMode="numeric" value={startAt} hint="Para usar una hoja ya empezada (1 a 30)." onChange={(event) => setStartAt(event.target.value.replace(/\D/g, ''))} />
            <TextField label="Bajar (mm)" inputMode="decimal" value={offset.top} hint="Negativo sube. Si sale corrido." onChange={(event) => changeOffset('top', event.target.value)} />
            <TextField label="Correr a la derecha (mm)" inputMode="decimal" value={offset.left} hint="Negativo, a la izquierda." onChange={(event) => changeOffset('left', event.target.value)} />
            <Button icon={Tag} isLoading={prepareState.isLoading} onClick={handlePrepare}>
              Preparar {total} {total === 1 ? 'etiqueta' : 'etiquetas'}
            </Button>
            {prepared && (
              <Button icon={Printer} onClick={handlePrint}>
                Imprimir
              </Button>
            )}
          </div>
        </section>
      )}

      {prepared && (
        <section className="labels-preview" aria-label="Vista previa de la hoja">
          <Sheets labels={prepared} startAt={start} offset={offset} />
        </section>
      )}
      {prepared &&
        createPortal(
          <div className="sale-print-root labels-print-root" aria-hidden="true">
            <Sheets labels={prepared} startAt={start} offset={offset} />
          </div>,
          document.body,
        )}
    </>
  )
}
