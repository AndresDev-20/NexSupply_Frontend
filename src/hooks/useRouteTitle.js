import { useEffect } from 'react'
import { useMatches } from 'react-router-dom'

/** Título de la ruta activa (handle.title). También actualiza el título de la pestaña. */
export function useRouteTitle(fallback = 'NexSupply') {
  const matches = useMatches()
  const title = [...matches].reverse().find((match) => match.handle?.title)?.handle.title ?? fallback

  useEffect(() => {
    document.title = title === 'NexSupply' ? 'NexSupply' : `${title} · NexSupply`
  }, [title])

  return title
}
