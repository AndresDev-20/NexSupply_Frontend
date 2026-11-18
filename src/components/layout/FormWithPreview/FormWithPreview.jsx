import './FormWithPreview.css'

/**
 * Formulario a la izquierda y vista previa en vivo a la derecha (desde 1024px).
 * En pantallas pequeñas la vista previa se oculta para dejar espacio al formulario.
 */
export function FormWithPreview({ children, preview, previewLabel = 'Vista previa' }) {
  return (
    <div className="form-with-preview">
      <div className="form-with-preview__main">{children}</div>
      <aside className="form-with-preview__aside" aria-label={previewLabel}>
        <p className="form-with-preview__label">{previewLabel}</p>
        {preview}
      </aside>
    </div>
  )
}
