// Atajos de teclado globales (Fase 15, D-UX-5).
//
// Secuencias de dos teclas: "g" y luego una letra ("ir a…"). No usan Alt ni teclas F para no
// chocar con el navegador (Alt+D, F5, F11…). Solo funcionan si la persona puede entrar a esa
// pantalla: se revisa con el mismo permiso y plan del menú (app/navigation.js).
import { NAVIGATION } from './navigation'
import { ROUTES } from '../routes/paths'

export const GO_KEY = 'g'
// Tiempo para la segunda tecla después de "g"
export const SEQUENCE_MS = 1500

export const GO_SHORTCUTS = [
  { key: 'i', to: ROUTES.home, label: 'Inicio' },
  { key: 'v', to: ROUTES.pos, label: 'Punto de venta' },
  { key: 's', to: ROUTES.sales, label: 'Ventas' },
  { key: 'a', to: ROUTES.layaways, label: 'Apartados' },
  { key: 'p', to: ROUTES.products, label: 'Productos' },
  { key: 'o', to: ROUTES.purchases, label: 'Compras' },
  { key: 'c', to: ROUTES.cash, label: 'Caja' },
  { key: 'k', to: ROUTES.customers, label: 'Clientes' },
  { key: 'e', to: ROUTES.expenses, label: 'Gastos' },
  { key: 'n', to: ROUTES.reports, label: 'Informes' },
]

// Atajos propios de una pantalla (se muestran en la ayuda; cada pantalla los maneja)
export const SCREEN_SHORTCUTS = [
  { screen: 'Punto de venta', keys: ['F2'], label: 'Cobrar la venta' },
  { screen: 'Punto de venta', keys: ['/'], label: 'Ir al buscador de productos' },
]

/** Permiso y plan de una ruta, tomados del menú. Inicio no exige nada. */
export function navigationItemFor(to) {
  if (to === ROUTES.home) return {}
  for (const group of NAVIGATION) {
    const item = group.items.find((entry) => entry.to === to)
    if (item) return item
  }
  return null
}

/** ¿El foco está en un campo donde se escribe? (ahí los atajos no hacen nada) */
export function isTyping(target) {
  if (!target) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable === true
}
