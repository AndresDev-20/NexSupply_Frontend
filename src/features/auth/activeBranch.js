// Sede escogida en el selector (Fase 17). Se guarda por pestaña (sessionStorage): así una
// pestaña puede trabajar en una sede y otra pestaña en otra, y al recargar no se pierde.
// Es solo una preferencia: el backend verifica en cada petición que el usuario entre a esa sede.
const KEY = 'nexsupply.activeBranch'

export function readStoredBranch() {
  try {
    const value = Number(window.sessionStorage.getItem(KEY))
    return Number.isInteger(value) && value > 0 ? value : null
  } catch {
    return null
  }
}

export function writeStoredBranch(branchId) {
  try {
    window.sessionStorage.setItem(KEY, String(branchId))
  } catch {
    // Sin almacenamiento: al recargar se vuelve a la sede principal
  }
}
