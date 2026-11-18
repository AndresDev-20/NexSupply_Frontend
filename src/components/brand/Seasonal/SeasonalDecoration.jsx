import './Seasonal.css'

// Adornos de temporada (Fase 15, D-UX-1, D-UX-2). Solo decoran: nunca tapan botones ni datos
// (pointer-events: none), los lectores de pantalla los ignoran (aria-hidden) y sin animación
// si el sistema pide menos movimiento.

const WIDTH = 800
const SCALLOP = 200
const STEP = 40

/** Altura de la cuerda en x: cada tramo cuelga como una curva (Bézier cuadrática). */
const sag = (x, depth) => {
  const t = (x % SCALLOP) / SCALLOP
  return 4 + 2 * depth * t * (1 - t)
}

const COLORS = {
  christmas: ['#e03131', '#f2b100', '#2f9e44', '#1c7ed6'],
  new_year: ['#f2b100', '#ffd43b', '#fab005', '#ffe066'],
  love_friendship: ['#e03131', '#f06595', '#c2255c', '#ff8787'],
  patriotic: ['#fcd116', '#003893', '#ce1126'],
  mothers_day: ['#f06595', '#cc5de8', '#ff8787', '#e599f7'],
  fathers_day: ['#1c7ed6', '#0c8599', '#f2b100', '#4dabf7'],
}

function Figure({ season, x, y, color, index }) {
  const delay = { animationDelay: `${(index % 5) * 0.35}s` }
  switch (season) {
    case 'christmas':
      return (
        <g className="seasonal__item seasonal__item--twinkle" style={delay}>
          <rect x={x - 2} y={y} width="4" height="4" rx="1" fill="#6b705c" />
          <ellipse cx={x} cy={y + 10} rx="5" ry="7.5" fill={color} />
          <ellipse cx={x - 1.6} cy={y + 7.5} rx="1.4" ry="2.4" fill="#fff" opacity="0.55" />
        </g>
      )
    case 'new_year':
      return <path className="seasonal__item seasonal__item--twinkle" style={delay} d={star(x, y + 10, 7, 3)} fill={color} />
    case 'love_friendship':
      return <path className="seasonal__item seasonal__item--sway" style={delay} d={heart(x, y + 3, 7)} fill={color} />
    case 'patriotic':
      return <path className="seasonal__item seasonal__item--sway" style={delay} d={`M${x - 9} ${y} L${x + 9} ${y} L${x} ${y + 18} Z`} fill={color} />
    case 'mothers_day':
      return (
        <g className="seasonal__item seasonal__item--sway" style={delay}>
          {[0, 72, 144, 216, 288].map((angle) => (
            <circle key={angle} cx={x + 5 * Math.cos((angle * Math.PI) / 180)} cy={y + 10 + 5 * Math.sin((angle * Math.PI) / 180)} r="4" fill={color} />
          ))}
          <circle cx={x} cy={y + 10} r="2.6" fill="#ffd43b" />
        </g>
      )
    case 'fathers_day':
      return <path className="seasonal__item seasonal__item--twinkle" style={delay} d={star(x, y + 10, 7, 3.2)} fill={color} />
    default:
      return null
  }
}

function star(cx, cy, outer, inner) {
  const points = Array.from({ length: 10 }, (_, i) => {
    const radius = i % 2 === 0 ? outer : inner
    const angle = (Math.PI / 5) * i - Math.PI / 2
    return `${(cx + radius * Math.cos(angle)).toFixed(1)} ${(cy + radius * Math.sin(angle)).toFixed(1)}`
  })
  return `M${points.join(' L')} Z`
}

function heart(x, y, size) {
  const s = size
  return `M${x} ${y + s * 1.6} C${x - s * 1.6} ${y + s * 0.6} ${x - s} ${y - s * 0.4} ${x} ${y + s * 0.3} C${x + s} ${y - s * 0.4} ${x + s * 1.6} ${y + s * 0.6} ${x} ${y + s * 1.6} Z`
}

/** Guirnalda con las figuras de la temporada. variant: "banner" (bienvenida) o "compact" (menú). */
export function SeasonalGarland({ season, variant = 'banner' }) {
  if (!season || !COLORS[season.key]) return null
  const depth = variant === 'compact' ? 7 : 11
  const colors = COLORS[season.key]
  const items = []
  for (let x = STEP / 2, index = 0; x < WIDTH; x += STEP, index += 1) {
    items.push(<Figure key={x} season={season.key} x={x} y={sag(x, depth)} color={colors[index % colors.length]} index={index} />)
  }
  const string = Array.from({ length: WIDTH / SCALLOP }, (_, i) => `Q${i * SCALLOP + SCALLOP / 2} ${4 + depth} ${(i + 1) * SCALLOP} 4`).join(' ')
  return (
    <svg className={`seasonal seasonal--${variant}`} viewBox={`0 0 ${WIDTH} ${depth + 30}`} preserveAspectRatio="xMidYMin slice" aria-hidden="true" focusable="false">
      <path d={`M0 4 ${string}`} fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
      {items}
    </svg>
  )
}

/** Mensaje de la temporada ("¡Feliz Navidad!") en una etiqueta. */
export function SeasonMessage({ season, className = '' }) {
  if (!season) return null
  return <span className={`seasonal-message ${className}`.trim()}>{season.message}</span>
}
