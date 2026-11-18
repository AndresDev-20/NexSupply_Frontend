import { FileWarning, Stethoscope } from 'lucide-react'
import { StatusMessage } from '../../../components/feedback/StatusMessage/StatusMessage'
import { Badge } from '../../../components/ui/Badge/Badge'
import { formatQuantity } from '../../../utils/format'

const days = (value) => (value === null || value === undefined ? null :`${formatQuantity(value)} ${Number(value) === 1 ? 'día' : 'días'}`)

/** Ficha veterinaria del producto (D-INV-17). Solo informativa: no diagnostica ni formula. */
export function VeterinaryTab({ product, canEdit }) {
  const info = product.veterinaryInfo
  if (!info) {
    return <StatusMessage icon={Stethoscope} title="Sin ficha veterinaria" description={canEdit ? 'Complétala desde "Editar".' : undefined} />
  }
  const rows = [
    ['Principio activo', info.activeIngredient],
    ['Concentración', info.concentration],
    ['Registro ICA', info.icaRegistration],
    ['Laboratorio', info.manufacturer],
    ['Vía de aplicación', info.administrationRoute],
    ['Especies', info.species],
    ['Retiro en carne', days(info.withdrawalMeatDays)],
    ['Retiro en leche', days(info.withdrawalMilkDays)],
  ]
  return (
    <div className="vet-sheet">
      {info.requiresPrescription && (
        <p className="vet-sheet__prescription">
          <FileWarning aria-hidden="true" />
          <span>
            <strong>Requiere fórmula veterinaria.</strong> Pídela antes de venderlo.
          </span>
        </p>
      )}
      <dl className="vet-sheet__grid">
        {rows.map(([label, value]) => (
          <div key={label} className="vet-sheet__item">
            <dt>{label}</dt>
            <dd>{value || <span className="vet-sheet__empty">Sin dato</span>}</dd>
          </div>
        ))}
      </dl>
      {!info.requiresPrescription && <Badge tone="success">Venta libre</Badge>}
    </div>
  )
}
