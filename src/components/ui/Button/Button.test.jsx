import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from './Button'

describe('Button', () => {
  it('aplica las clases BEM de variante y tamaño', () => {
    render(
      <Button variant="accent" size="lg">
        Guardar
      </Button>,
    )
    expect(screen.getByRole('button', { name: 'Guardar' })).toHaveClass('button', 'button--accent', 'button--lg')
  })

  it('es type="button" por defecto para no enviar formularios sin querer', () => {
    render(<Button>Cancelar</Button>)
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
  })

  it('mientras carga queda deshabilitado y no ejecuta el clic (evita doble envío)', async () => {
    const onClick = vi.fn()
    render(
      <Button isLoading onClick={onClick}>
        Cobrar
      </Button>,
    )

    const button = screen.getByRole('button', { name: 'Cobrar' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    await userEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })
})
