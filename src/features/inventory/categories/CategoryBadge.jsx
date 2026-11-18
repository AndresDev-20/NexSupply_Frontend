import { createElement } from 'react'
import { categoryVisual, subcategoryIcon } from './categoryVisuals'
import './categoryTones.css'

/**
 * Ícono de una categoría con su color. Para una subcategoría se pasa `parentName`:
 * usa el ícono de la especie (alimentos) y el color de su categoría.
 * size: sm | md | lg. solid: fondo lleno (categoría elegida).
 */
export function CategoryBadge({ name, parentName, size = 'md', solid = false }) {
  const { tone } = categoryVisual(parentName ?? name)
  // Los íconos son componentes fijos de lucide: se crea el elemento, no un componente nuevo
  const icon = parentName ? subcategoryIcon(name, parentName) : categoryVisual(name).icon
  return (
    <span className={`cat-badge cat-badge--${size}${solid ? ' cat-badge--solid' : ''}`} data-tone={tone} aria-hidden="true">
      {createElement(icon)}
    </span>
  )
}
