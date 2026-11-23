import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardCheck, FilePlus2, MessageCircle, TriangleAlert } from 'lucide-react'
import { useCreatePurchaseMutation, useGetReorderSuggestionsQuery } from '../purchasesApi'
import { useGetSuppliersQuery } from '../../inventory/inventoryApi'
import { whatsappNumber } from '../../customers/customerOptions'
import { useToast } from '../../../components/feedback/Toast/toastContext'
import { Alert } from '../../../components/feedback/Alert/Alert'
import { PageHeader } from '../../../components/layout/PageHeader/PageHeader'
import { FilterBar } from '../../../components/layout/FilterBar/FilterBar'
import { SelectField } from '../../../components/ui/SelectField/SelectField'
import { TextField } from '../../../components/ui/TextField/TextField'
import { Checkbox } from '../../../components/ui/Checkbox/Checkbox'
import { Button } from '../../../components/ui/Button/Button'
import { Badge } from '../../../components/ui/Badge/Badge'
import { DataTable } from '../../../components/ui/DataTable/DataTable'
import { formatCurrency, formatQuantity } from '../../../utils/format'
import { previewMultiply, previewSum } from '../../../utils/moneyPreview'
import { QUANTITY_PATTERN, toApiNumber, toInputNumber } from '../../../utils/numberInput'
import { purchasePath } from '../../../routes/paths'
import '../../admin/admin.css'
import '../purchases.css'
import '../../settings/settings.css'

const unitOf = (row) => row.presentationName ?? row.unitSymbol

/**
 * /compras/pedido-sugerido — Qué pedirle a un proveedor según lo que se vende (D-COMP-10).
 * Se ajustan las cantidades, se desmarca lo que no, y se crea la compra en borrador o se le
 * manda la lista por WhatsApp.
 */
export default function ReorderPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [supplierId, setSupplierId] = useState('')
  const [coverDays, setCoverDays] = useState('15')
  const [edits, setEdits] = useState({}) // productId → { quantity, skip }
  const { data: suppliersData } = useGetSuppliersQuery({ isActive: 'true', pageSize: 100 })
  const days = Number(coverDays) >= 1 && Number(coverDays) <= 120 ? Number(coverDays) : 15
  const { data, error, isFetching, refetch } = useGetReorderSuggestionsQuery({ supplierId, coverDays: days }, { skip: !supplierId })
  const [createPurchase, createState] = useCreatePurchaseMutation()

  const suppliers = (suppliersData?.rows ?? []).map((row) => ({ value: String(row.id), label: row.tradeName || row.legalName }))
  const rows = data?.rows ?? []
  const quantityOf = (row) => edits[row.productId]?.quantity ?? toInputNumber(row.suggestedQuantity)
  const isChosen = (row) => !edits[row.productId]?.skip && Number(toApiNumber(quantityOf(row))) > 0
  const chosen = rows.filter(isChosen)
  const total = previewSum(chosen.map((row) => previewMultiply(row.unitCost, toApiNumber(quantityOf(row))) ?? '0'))
  const setEdit = (productId, changes) => setEdits((current) => ({ ...current, [productId]: { ...current[productId], ...changes } }))

  const handleCreate = async () => {
    const invalid = chosen.find((row) => !QUANTITY_PATTERN.test(toApiNumber(quantityOf(row))))
    if (invalid) return toast.error(`Revisa la cantidad de ${invalid.name}`)
    try {
      const purchase = await createPurchase({
        supplierId: Number(supplierId),
        notes: `Pedido sugerido para ${days} días`,
        items: chosen.map((row) => ({
          productId: row.productId,
          ...(row.presentationId && { presentationId: row.presentationId }),
          quantity: toApiNumber(quantityOf(row)),
          unitPrice: row.unitCost,
          taxRate: row.taxRate,
        })),
      }).unwrap()
      toast.success('Compra en borrador creada: ajústala y confírmala cuando llegue la mercancía')
      navigate(purchasePath(purchase.id))
    } catch (createError) {
      toast.error(createError.details?.[0]?.message ?? createError.message)
    }
    return undefined
  }

  const handleWhatsapp = () => {
    const lines = chosen.map((row) => `• ${formatQuantity(toApiNumber(quantityOf(row)))} ${unitOf(row)} de ${row.name}`)
    const text = `Hola, buenos días. Quisiera hacer este pedido:\n${lines.join('\n')}\n\nQuedo atento. Gracias.`
    const number = whatsappNumber(data?.supplier.phone)
    window.open(`https://wa.me/${number ?? ''}?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
  }

  const columns = [
    {
      key: 'check',
      header: <span className="u-visually-hidden">Pedir</span>,
      render: (row) => <Checkbox label={<span className="u-visually-hidden">{`Pedir ${row.name}`}</span>} checked={!edits[row.productId]?.skip} onChange={(checked) => setEdit(row.productId, { skip: !checked })} />,
    },
    {
      key: 'product',
      header: 'Producto',
      primary: true,
      render: (row) => (
        <span className="reorder-product">
          <strong>{row.name}</strong>
          <small>
            Hay {formatQuantity(row.available)} {row.unitSymbol}
            {row.reason === 'sales' ? ` · vende ${formatQuantity(row.dailyAverage)} ${row.unitSymbol} al día` : ` · mínimo ${formatQuantity(row.minStock)} ${row.unitSymbol}`}
          </small>
          {row.reason === 'min_stock' && <Badge tone="neutral">Sin ventas: hasta el mínimo</Badge>}
        </span>
      ),
    },
    {
      key: 'quantity',
      header: 'Pedir',
      render: (row) => (
        <span className="reorder-qty">
          <input aria-label={`Cantidad de ${row.name}`} inputMode="decimal" value={quantityOf(row)} onChange={(event) => setEdit(row.productId, { quantity: event.target.value })} />
          <span>{unitOf(row)}</span>
        </span>
      ),
    },
    { key: 'cost', header: 'Costo', align: 'end', render: (row) => <span className="numeric">{formatCurrency(row.unitCost)}</span> },
    { key: 'total', header: 'Total', align: 'end', render: (row) => <strong className="numeric">{formatCurrency(previewMultiply(row.unitCost, toApiNumber(quantityOf(row))) ?? '0')}</strong> },
  ]

  return (
    <>
      <PageHeader description={`Lo que conviene pedirle a un proveedor para cubrir los próximos días, según lo vendido en los últimos ${data?.historyDays ?? 30} días y la existencia mínima. Se propone como lo compraste la última vez (por ejemplo, en bultos).`} />
      <FilterBar>
        <SelectField
          label="Proveedor"
          placeholder="Escoge el proveedor"
          options={suppliers}
          value={supplierId}
          onChange={(event) => {
            setSupplierId(event.target.value)
            setEdits({})
          }}
        />
        <TextField label="Días a cubrir" inputMode="numeric" value={coverDays} onChange={(event) => setCoverDays(event.target.value.replace(/\D/g, ''))} hint="De 1 a 120. Por defecto 15." />
      </FilterBar>

      {!supplierId && <Alert tone="info">Escoge un proveedor para ver qué pedirle.</Alert>}
      {supplierId && (
        <DataTable
          caption="Pedido sugerido"
          columns={columns}
          rows={rows}
          getRowId={(row) => row.productId}
          isLoading={isFetching}
          error={error}
          onRetry={refetch}
          emptyTitle="No hace falta pedir nada"
          emptyDescription="Con lo que hay alcanza para esos días, o el proveedor no tiene productos asociados (se asocian en cada producto, paso Proveedores)."
        />
      )}

      {chosen.length > 0 && (
        <div className="reorder-footer">
          <span>
            {chosen.length} {chosen.length === 1 ? 'producto' : 'productos'} · total aproximado <strong>{formatCurrency(total)}</strong>
          </span>
          <span className="reorder-footer__actions">
            <Button variant="secondary" icon={MessageCircle} onClick={handleWhatsapp}>
              Mandar por WhatsApp
            </Button>
            <Button icon={FilePlus2} isLoading={createState.isLoading} onClick={handleCreate}>
              Crear compra en borrador
            </Button>
          </span>
        </div>
      )}
      {data && rows.length > 0 && !data.supplier.phone && (
        <p className="settings-note">
          <TriangleAlert aria-hidden="true" />
          <span>El proveedor no tiene celular registrado: WhatsApp se abrirá para que escojas el contacto.</span>
        </p>
      )}
      <p className="settings-note">
        <ClipboardCheck aria-hidden="true" />
        <span>Es una propuesta: la compra queda en borrador para ajustar cantidades y costos cuando llegue la factura.</span>
      </p>
    </>
  )
}
