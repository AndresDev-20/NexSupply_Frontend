import { Check, Circle } from 'lucide-react'
import { PASSWORD_RULES } from '../../passwordRules'
import './PasswordRequirements.css'

/** Lista de requisitos que se van marcando mientras el usuario escribe. */
export function PasswordRequirements({ value, id }) {
  return (
    <ul className="password-requirements" id={id} aria-label="Requisitos de la contraseña">
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(value)
        return (
          <li key={rule.id} className={`password-requirements__item${met ? ' password-requirements__item--met' : ''}`}>
            {met ? (
              <Check className="password-requirements__icon" aria-hidden="true" />
            ) : (
              <Circle className="password-requirements__icon" aria-hidden="true" />
            )}
            <span>{rule.label}</span>
            <span className="u-visually-hidden">{met ? ' (cumplido)' : ' (pendiente)'}</span>
          </li>
        )
      })}
    </ul>
  )
}
