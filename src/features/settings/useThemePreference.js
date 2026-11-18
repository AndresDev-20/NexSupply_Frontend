import { useEffect } from 'react'
import { useGetPreferencesQuery, useUpdatePreferencesMutation } from './settingsApi'
import { applyTheme, cacheTheme, readCachedTheme } from './theme'

/**
 * Tema del usuario con sesión: lo lee de sus preferencias, lo aplica a la página
 * y permite cambiarlo. Se usa en el layout interno (AppShell) y en el menú del usuario.
 */
export function useThemePreference() {
  const { data } = useGetPreferencesQuery()
  const [updatePreferences] = useUpdatePreferencesMutation()
  const theme = data?.theme ?? readCachedTheme()

  useEffect(() => {
    applyTheme(theme)
    cacheTheme(theme)
  }, [theme])

  const setTheme = (next) => {
    // El caché se actualiza al instante (ver settingsApi); si el servidor falla, vuelve atrás
    updatePreferences({ theme: next }).catch(() => {})
  }

  return { theme, setTheme }
}
