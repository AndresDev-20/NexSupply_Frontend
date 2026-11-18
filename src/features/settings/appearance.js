// Apariencia del negocio (Fase 15, D-UX-3, D-UX-4): paleta y temporada.
// La paleta la define el negocio en Configuración > Apariencia y llega en /branding (pública).
// Como el tema claro/oscuro, una copia queda en este navegador para aplicarla antes de dibujar
// la primera pantalla y evitar un parpadeo de colores.
import { useEffect } from 'react'
import { useGetBrandingQuery } from './settingsApi'

// Los colores viven en styles/palettes.css; aquí solo nombres y muestras para escoger
export const PALETTES = [
  { key: 'campo', name: 'Campo', description: 'El verde y amarillo de la marca', swatches: ['#0b3d1c', '#2e8b3e', '#f2b100'] },
  { key: 'bosque', name: 'Bosque', description: 'Verde profundo y dorado', swatches: ['#0a3320', '#23804f', '#d4a017'] },
  { key: 'cosecha', name: 'Cosecha', description: 'Verde oliva y naranja', swatches: ['#333d12', '#788a2e', '#f08a24'] },
  { key: 'rio', name: 'Río', description: 'Azul petróleo y amarillo', swatches: ['#0a3442', '#1f7f98', '#f2b100'] },
  { key: 'tierra', name: 'Tierra', description: 'Café y verde hoja', swatches: ['#3d2615', '#8e5e36', '#7cb342'] },
]

const PALETTE_KEYS = PALETTES.map((palette) => palette.key)
const STORAGE_KEY = 'nexsupply.palette'

export function applyPalette(palette) {
  const root = document.documentElement
  // "campo" es la identidad original: los valores de tokens.css, sin atributo
  if (PALETTE_KEYS.includes(palette) && palette !== 'campo') root.dataset.palette = palette
  else delete root.dataset.palette
}

export function readCachedPalette() {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    return PALETTE_KEYS.includes(value) ? value : 'campo'
  } catch {
    // Navegación privada o almacenamiento bloqueado: la identidad original
    return 'campo'
  }
}

function cachePalette(palette) {
  try {
    window.localStorage.setItem(STORAGE_KEY, palette)
  } catch {
    // Sin almacenamiento: se aplica igual cuando llegue /branding
  }
}

/**
 * Aplica la paleta del negocio y devuelve la temporada de hoy ({ key, label, message } o null).
 * Se usa en los dos layouts (con sesión y de inicio de sesión), que ya consultan /branding.
 */
export function useBusinessAppearance() {
  const { data } = useGetBrandingQuery()
  const palette = data?.palette

  useEffect(() => {
    if (!palette) return
    applyPalette(palette)
    cachePalette(palette)
  }, [palette])

  return { season: data?.season ?? null }
}

/** Temporada de hoy (o null). /branding ya viene en caché porque la piden los layouts. */
export function useSeason() {
  const { data } = useGetBrandingQuery()
  return data?.season ?? null
}
