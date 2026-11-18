import './FarmScene.css'

/**
 * Escena de granja animada para el panel de marca de las pantallas de acceso.
 * Ilustración original en SVG; todas las animaciones son CSS (ver FarmScene.css).
 * Es decorativa: aria-hidden para que los lectores de pantalla la ignoren.
 *
 * Coordenadas: viewBox de 600 x 800. Las colinas ocupan la franja inferior;
 * el texto del panel queda en el centro, sin taparse con la escena.
 */
export function FarmScene() {
  return (
    <svg
      className="farm-scene"
      viewBox="0 0 600 800"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
      focusable="false"
    >
      {/* ---------- Cielo: nubes y pájaros ---------- */}
      <g className="farm-scene__cloud farm-scene__cloud--1" transform="translate(0 110)">
        <Cloud />
      </g>
      <g className="farm-scene__cloud farm-scene__cloud--2" transform="translate(0 190) scale(0.7)">
        <Cloud />
      </g>
      <g className="farm-scene__cloud farm-scene__cloud--3" transform="translate(0 70) scale(0.55)">
        <Cloud />
      </g>

      <g className="farm-scene__flock" transform="translate(0 130)">
        <Bird x={0} y={0} variant={1} />
        <Bird x={34} y={-14} variant={2} />
        <Bird x={22} y={18} variant={3} />
      </g>

      {/* ---------- Polen dorado que sube ---------- */}
      {[60, 150, 240, 330, 420, 510].map((x, index) => (
        <circle
          key={x}
          className={`farm-scene__pollen farm-scene__pollen--${index + 1}`}
          cx={x}
          cy={760}
          r={index % 2 ? 2 : 3}
        />
      ))}

      {/* ---------- Colina lejana con molino (a la izquierda, lejos del texto) ---------- */}
      <path className="farm-scene__hill farm-scene__hill--far" d="M0 642 Q140 590 300 622 T600 598 V800 H0 Z" />
      <g transform="translate(130 632) scale(0.72)">
        <Windmill />
      </g>

      {/* ---------- Colina media ---------- */}
      <path className="farm-scene__hill farm-scene__hill--mid" d="M0 690 Q130 652 270 676 T600 664 V800 H0 Z" />

      {/* Gallina picoteando sobre la colina media, al centro */}
      <g transform="translate(285 676) scale(1.15)">
        <Hen />
      </g>

      {/* ---------- Colina del frente ---------- */}
      <path className="farm-scene__hill farm-scene__hill--near" d="M0 734 Q150 712 300 726 T600 716 V800 H0 Z" />

      {/* Vaca: recorre la mitad izquierda, se detiene a pastar y regresa */}
      <g transform="translate(55 730) scale(1.25)">
        <g className="farm-scene__walker farm-scene__walker--cow">
          <Cow />
        </g>
      </g>

      {/* Cerdito: trota en la mitad derecha, sin cruzarse con la vaca */}
      <g transform="translate(500 734) scale(1.25)">
        <g className="farm-scene__walker farm-scene__walker--pig">
          <Pig />
        </g>
      </g>

      {/* Pasto que se mece con el viento */}
      {[20, 120, 205, 290, 395, 470, 560].map((x, index) => (
        <g key={x} transform={`translate(${x} ${index % 2 ? 744 : 752})`}>
          <path
            className={`farm-scene__grass farm-scene__grass--${index + 1}`}
            d="M0 0 Q-3 -12 -6 -20 M4 0 Q4 -14 6 -24 M8 0 Q10 -10 15 -17"
          />
        </g>
      ))}
    </svg>
  )
}

function Cloud() {
  return (
    <g className="farm-scene__cloud-shape">
      <ellipse cx="60" cy="20" rx="60" ry="18" />
      <circle cx="40" cy="8" r="20" />
      <circle cx="72" cy="2" r="26" />
      <circle cx="100" cy="12" r="16" />
    </g>
  )
}

function Bird({ x, y, variant }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path className={`farm-scene__bird farm-scene__bird--${variant}`} d="M0 0 Q6 -7 12 0 Q18 -7 24 0" />
    </g>
  )
}

function Windmill() {
  return (
    <g className="farm-scene__windmill">
      <path className="farm-scene__windmill-tower" d="M-7 0 L-3 -54 L3 -54 L7 0 Z" />
      <g transform="translate(0 -56)">
        <g className="farm-scene__windmill-blades">
          <rect x="-2" y="-30" width="4" height="30" rx="2" />
          <rect x="-2" y="-30" width="4" height="30" rx="2" transform="rotate(90)" />
          <rect x="-2" y="-30" width="4" height="30" rx="2" transform="rotate(180)" />
          <rect x="-2" y="-30" width="4" height="30" rx="2" transform="rotate(270)" />
        </g>
        <circle className="farm-scene__windmill-hub" r="4" />
      </g>
    </g>
  )
}

function Cow() {
  // Vaca mirando a la derecha; (0,0) = suelo bajo las patas traseras
  return (
    <g className="farm-scene__cow">
      <path className="farm-scene__cow-tail" d="M2 -38 Q-10 -30 -8 -14" />
      <circle className="farm-scene__cow-tail-tip" cx="-8" cy="-13" r="3" />
      <rect className="farm-scene__leg farm-scene__leg--a" x="8" y="-18" width="6" height="18" rx="2" />
      <rect className="farm-scene__leg farm-scene__leg--b" x="18" y="-18" width="6" height="18" rx="2" />
      <rect className="farm-scene__leg farm-scene__leg--b" x="46" y="-18" width="6" height="18" rx="2" />
      <rect className="farm-scene__leg farm-scene__leg--a" x="56" y="-18" width="6" height="18" rx="2" />
      <rect className="farm-scene__cow-body" x="0" y="-46" width="68" height="32" rx="14" />
      <ellipse className="farm-scene__cow-spot" cx="20" cy="-34" rx="9" ry="7" />
      <ellipse className="farm-scene__cow-spot" cx="46" cy="-24" rx="7" ry="5" />
      <ellipse className="farm-scene__cow-udder" cx="34" cy="-14" rx="6" ry="3" />
      <g className="farm-scene__cow-head">
        <path className="farm-scene__cow-horn" d="M64 -62 q-2 -7 3 -9 M80 -62 q2 -7 -3 -9" />
        <ellipse className="farm-scene__cow-ear" cx="61" cy="-56" rx="6" ry="3" />
        <ellipse className="farm-scene__cow-ear" cx="84" cy="-56" rx="6" ry="3" />
        <ellipse className="farm-scene__cow-face" cx="72" cy="-50" rx="12" ry="13" />
        <ellipse className="farm-scene__cow-muzzle" cx="72" cy="-41" rx="10" ry="6" />
        <circle className="farm-scene__eye" cx="67" cy="-53" r="1.8" />
        <circle className="farm-scene__eye" cx="77" cy="-53" r="1.8" />
      </g>
    </g>
  )
}

function Pig() {
  // Cerdo mirando a la derecha; (0,0) = suelo
  return (
    <g className="farm-scene__pig">
      <path className="farm-scene__pig-tail" d="M-24 -26 q-8 -2 -6 -8 q2 -5 6 -1 q2 4 -4 5" />
      <rect className="farm-scene__leg farm-scene__leg--pig farm-scene__leg--a" x="-16" y="-12" width="6" height="12" rx="2" />
      <rect className="farm-scene__leg farm-scene__leg--pig farm-scene__leg--b" x="-6" y="-12" width="6" height="12" rx="2" />
      <rect className="farm-scene__leg farm-scene__leg--pig farm-scene__leg--b" x="8" y="-12" width="6" height="12" rx="2" />
      <rect className="farm-scene__leg farm-scene__leg--pig farm-scene__leg--a" x="16" y="-12" width="6" height="12" rx="2" />
      <ellipse className="farm-scene__pig-body" cx="0" cy="-24" rx="27" ry="17" />
      <path className="farm-scene__pig-ear" d="M20 -40 l6 -9 l4 10 Z" />
      <circle className="farm-scene__pig-body" cx="26" cy="-27" r="12" />
      <ellipse className="farm-scene__pig-snout" cx="37" cy="-25" rx="5" ry="6" />
      <circle className="farm-scene__nostril" cx="37" cy="-27" r="1" />
      <circle className="farm-scene__nostril" cx="37" cy="-23" r="1" />
      <circle className="farm-scene__eye" cx="28" cy="-31" r="1.8" />
    </g>
  )
}

function Hen() {
  // Gallina mirando a la izquierda; (0,0) = suelo
  return (
    <g className="farm-scene__hen">
      <path className="farm-scene__hen-legs" d="M-3 0 L-1 -8 M4 0 L3 -8" />
      <g className="farm-scene__hen-body">
        <path className="farm-scene__hen-tail" d="M10 -18 q10 -12 6 -2 q8 -6 2 4 Z" />
        <ellipse className="farm-scene__hen-feathers" cx="2" cy="-15" rx="12" ry="9" />
        <g className="farm-scene__hen-head">
          <circle className="farm-scene__hen-feathers" cx="-10" cy="-24" r="6" />
          <path className="farm-scene__hen-comb" d="M-14 -29 q1 -5 3 -1 q1 -5 3 -1 q2 -3 2 1 Z" />
          <path className="farm-scene__hen-beak" d="M-16 -24 l-5 2 l5 2 Z" />
          <circle className="farm-scene__eye" cx="-11" cy="-25" r="1.3" />
        </g>
      </g>
    </g>
  )
}
