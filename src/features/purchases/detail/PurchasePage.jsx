import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { ArrowLeft, RotateCw, TriangleAlert } from 'lucide-react'
import { useGetPurchaseQuery } from '../purchasesApi'
import { PurchaseEditor } from './PurchaseEditor'
import { PurchaseDetail } from './PurchaseDetail'
import { useCan } from '../../../hooks/usePermissions'
import { useToast } from '../../../components/feedback/Toast/toastContext'
import { StatusMessage } from '../../../components/feedback/StatusMessage/StatusMessage'
import { Button } from '../../../components/ui/Button/Button'
import { Spinner } from '../../../components/ui/Spinner/Spinner'
import { ROUTES } from '../../../routes/paths'
import '../../cash/cash.css'

/**
 * /compras/nueva y /compras/:id. Un borrador se abre en el editor (si hay permiso de
 * registrar compras); una compra confirmada o anulada, en su detalle.
 */
export default function PurchasePage() {
  const { id } = useParams()
  const location = useLocation()
  const toast = useToast()
  const canEdit = useCan('purchases.create')
  const [warnings, setWarnings] = useState([])
  const { data: purchase, isLoading, error, refetch } = useGetPurchaseQuery(id, { skip: !id })

  if (!id) return <PurchaseEditor purchase={null} onConfirmed={() => {}} />

  if (isLoading) {
    return (
      <div className="cash-page__state">
        <Spinner size="lg" label="Cargando la compra…" />
      </div>
    )
  }
  if (error || !purchase) {
    return (
      <StatusMessage icon={TriangleAlert} tone="danger" title={error?.status === 404 ? 'La compra no existe' : 'No se pudo cargar la compra'} description={error?.message}>
        <Link className="button button--secondary button--md" to={ROUTES.purchases}>
          <ArrowLeft className="button__icon" aria-hidden="true" />
          <span className="button__label">Volver a compras</span>
        </Link>
        {error?.status !== 404 && (
          <Button icon={RotateCw} onClick={refetch}>
            Reintentar
          </Button>
        )}
      </StatusMessage>
    )
  }

  if (purchase.status === 'draft' && canEdit) {
    return (
      <PurchaseEditor
        key={purchase.id}
        purchase={purchase}
        autoConfirm={Boolean(location.state?.confirm)}
        onConfirmed={(result) => {
          setWarnings(result.priceWarnings ?? [])
          toast.success(`Compra ${result.number} confirmada: los productos entraron al inventario`)
        }}
      />
    )
  }
  return <PurchaseDetail purchase={purchase} priceWarnings={warnings} />
}
