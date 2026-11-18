import { useEffect, useState } from 'react'

/** Devuelve `value` solo cuando deja de cambiar por `delayMs` (ej. buscar mientras se escribe). */
export function useDebouncedValue(value, delayMs = 350) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
