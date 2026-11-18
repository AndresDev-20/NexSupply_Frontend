import { LIFECYCLE, lifecycleIndex } from './cashOptions'
import './cash.css'

/** Línea de vida del turno (D-CAJA-10): Abierto → Cerrado → Contado → Recibido. */
export function Lifecycle({ status, compact = false }) {
  const current = lifecycleIndex(status)
  // Un turno recibido terminó: todos los pasos quedan hechos
  const finished = status === 'received'
  return (
    <ol className={`lifecycle${compact ? ' lifecycle--compact' : ''}`} aria-label="Avance del turno">
      {LIFECYCLE.map((step, index) => {
        const done = index < current || finished
        const isCurrent = index === current && !finished
        return (
          <li key={step.status} className={`lifecycle__step${done ? ' lifecycle__step--done' : ''}${isCurrent ? ' lifecycle__step--current' : ''}`} aria-current={isCurrent ? 'step' : undefined}>
            <span className="lifecycle__dot" aria-hidden="true" />
            <span className="lifecycle__label">{step.label}</span>
          </li>
        )
      })}
    </ol>
  )
}
