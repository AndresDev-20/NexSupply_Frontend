import { forwardRef, useState } from 'react'
import { Eye, EyeOff, LockKeyhole } from 'lucide-react'
import { TextField } from '../TextField/TextField'
import './PasswordField.css'

/** Campo de contraseña con botón para mostrarla u ocultarla. */
export const PasswordField = forwardRef(function PasswordField({ label = 'Contraseña', ...props }, ref) {
  const [visible, setVisible] = useState(false)

  return (
    <TextField
      ref={ref}
      label={label}
      type={visible ? 'text' : 'password'}
      icon={LockKeyhole}
      // Evita que el navegador corrija o ponga mayúscula a la contraseña en celular
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      endAdornment={
        <button
          type="button"
          className="password-field__toggle"
          onClick={() => setVisible((value) => !value)}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={visible}
        >
          {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </button>
      }
      {...props}
    />
  )
})
