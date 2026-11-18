import { RotateCcw, Save } from 'lucide-react'
import { Button } from '../Button/Button'
import './SaveBar.css'

/**
 * Barra fija abajo que aparece cuando hay cambios sin guardar en una pantalla de ajustes.
 * El botón de guardar envía el formulario indicado en `formId`.
 */
export function SaveBar({ changesCount, isSaving, formId, onDiscard }) {
  if (changesCount === 0) return null

  return (
    <div className="save-bar" role="region" aria-label="Cambios sin guardar">
      <p className="save-bar__text">
        <span className="save-bar__dot" aria-hidden="true" />
        {changesCount === 1 ? 'Tienes 1 cambio sin guardar' : `Tienes ${changesCount} cambios sin guardar`}
      </p>
      <div className="save-bar__actions">
        <Button variant="ghost" icon={RotateCcw} onClick={onDiscard} disabled={isSaving} className="save-bar__discard">
          Descartar
        </Button>
        <Button type="submit" form={formId} variant="accent" icon={Save} isLoading={isSaving}>
          Guardar cambios
        </Button>
      </div>
    </div>
  )
}
