import { useGetBrandingQuery } from './settingsApi'

/** Nombre del negocio del cliente (para el menú lateral). null mientras carga o si falla. */
export function useBusinessName() {
  const { data } = useGetBrandingQuery()
  return data?.name ?? null
}
