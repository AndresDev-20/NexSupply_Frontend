import { useEffect, useRef, useState } from 'react'

const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * Número que "cuenta" hasta su nuevo valor (solo visual: el valor real es el del servidor).
 * Respeta prefers-reduced-motion: sin animación, salta directo.
 */
export function useAnimatedNumber(target, duration = 320) {
  const value = Number(target) || 0
  const [shown, setShown] = useState(value)
  const fromRef = useRef(value)
  const frameRef = useRef(null)

  useEffect(() => {
    const from = fromRef.current
    if (from === value || prefersReducedMotion() || typeof requestAnimationFrame === 'undefined') {
      fromRef.current = value
      const id = setTimeout(() => setShown(value), 0)
      return () => clearTimeout(id)
    }
    // El inicio se toma del primer cuadro: el reloj del cuadro y el de performance pueden diferir
    let start = null
    const tick = (now) => {
      if (start === null) start = now
      const progress = Math.max(0, Math.min((now - start) / duration, 1))
      const eased = 1 - (1 - progress) ** 3
      const current = from + (value - from) * eased
      setShown(current)
      fromRef.current = current
      if (progress < 1) frameRef.current = requestAnimationFrame(tick)
    }
    frameRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameRef.current)
  }, [value, duration])

  return Math.round(shown)
}
