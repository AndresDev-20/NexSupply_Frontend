import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { selectPermissions, selectPlan } from '../features/auth/authSlice'
import { canAccess } from './usePermissions'
import { GO_KEY, GO_SHORTCUTS, SEQUENCE_MS, isTyping, navigationItemFor } from '../app/shortcuts'

/**
 * Escucha los atajos globales (Fase 15): "g" + letra para ir a una pantalla y "?" para la ayuda.
 * Devuelve { pending, helpOpen, setHelpOpen }: pending es true mientras espera la segunda tecla.
 */
export function useGlobalShortcuts() {
  const navigate = useNavigate()
  const permissions = useSelector(selectPermissions)
  const plan = useSelector(selectPlan)
  const [pending, setPending] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const timer = useRef(null)
  const access = useRef({ permissions, plan })

  useEffect(() => {
    access.current = { permissions, plan }
  })

  useEffect(() => {
    const stop = () => {
      clearTimeout(timer.current)
      setPending(false)
    }
    const handleKey = (event) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target)) return
      // Con una ventana abierta los atajos de navegación no aplican (la ventana manda)
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return

      if (event.key === '?') {
        event.preventDefault()
        setHelpOpen(true)
        return
      }
      const key = event.key.toLowerCase()
      if (pending) {
        stop()
        const shortcut = GO_SHORTCUTS.find((item) => item.key === key)
        const item = shortcut && navigationItemFor(shortcut.to)
        if (item && canAccess(item, access.current)) {
          event.preventDefault()
          navigate(shortcut.to)
        }
        return
      }
      if (key === GO_KEY) {
        setPending(true)
        clearTimeout(timer.current)
        timer.current = setTimeout(stop, SEQUENCE_MS)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('keydown', handleKey)
      clearTimeout(timer.current)
    }
  }, [navigate, pending])

  return { pending, helpOpen, setHelpOpen }
}
