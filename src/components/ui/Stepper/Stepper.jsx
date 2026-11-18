import { Check } from 'lucide-react'
import './Stepper.css'

/**
 * Indicador de pasos de un formulario largo.
 * steps: [{ id, label }]; current: índice del paso actual.
 * Se puede volver a un paso anterior haciendo clic (los siguientes se alcanzan con "Siguiente",
 * que valida el paso actual).
 */
export function Stepper({ steps, current, onStepClick }) {
  return (
    <ol className="stepper" aria-label="Pasos del formulario">
      {steps.map((step, index) => {
        const state = index < current ? 'done' : index === current ? 'active' : 'pending'
        const clickable = onStepClick && index < current
        return (
          <li key={step.id} className={`stepper__step stepper__step--${state}`} aria-current={state === 'active' ? 'step' : undefined}>
            <button
              type="button"
              className="stepper__button"
              onClick={() => clickable && onStepClick(index)}
              disabled={!clickable}
              aria-label={`Paso ${index + 1}: ${step.label}${state === 'done' ? ' (completado)' : ''}`}
            >
              <span className="stepper__circle" aria-hidden="true">
                {state === 'done' ? <Check className="stepper__check" /> : index + 1}
              </span>
              <span className="stepper__label">{step.label}</span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
