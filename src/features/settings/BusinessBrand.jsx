import { logoUrl, useGetBrandingQuery } from './settingsApi'
import './BusinessBrand.css'

/**
 * Logo y nombre del negocio del cliente (CLAUDE.md §5: su marca es la protagonista).
 * Usa /branding, que es pública: se ve también antes de iniciar sesión.
 * Si aún no se configuró nada o la API no responde, no muestra nada.
 */
export function BusinessBrand() {
  const { data } = useGetBrandingQuery()
  if (!data?.name) return null

  return (
    <div className="business-brand">
      {data.logo && <img className="business-brand__logo" src={logoUrl(data.logo)} alt={`Logo de ${data.name}`} />}
      <p className="business-brand__name">{data.name}</p>
    </div>
  )
}

