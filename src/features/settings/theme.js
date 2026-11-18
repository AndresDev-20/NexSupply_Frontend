// Tema claro/oscuro (D-CFG-8). La preferencia se guarda en el servidor (por usuario)
// y una copia en este navegador, para aplicarla antes de dibujar la primera pantalla
// y evitar un "parpadeo" de colores al abrir la aplicación.
//
// 'system' sigue al sistema operativo (tokens.css usa prefers-color-scheme).

export const THEMES = ['system', 'light', 'dark']
const STORAGE_KEY = 'nexsupply.theme'

export function applyTheme(theme) {
  const root = document.documentElement
  if (theme === 'light' || theme === 'dark') root.dataset.theme = theme
  else delete root.dataset.theme
}

export function readCachedTheme() {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    return THEMES.includes(value) ? value : 'system'
  } catch {
    // Navegación privada o almacenamiento bloqueado: se sigue al sistema
    return 'system'
  }
}

export function cacheTheme(theme) {
  try {
    window.localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // Sin almacenamiento: la preferencia igual queda guardada en el servidor
  }
}
