// Ícono y color de cada categoría, para reconocerlas de un vistazo.
// Se deducen del nombre (las categorías las crea el negocio y pueden cambiar), con
// palabras clave sin mayúsculas ni tildes. Lo que no coincide usa una carpeta neutra.
import {
  Beef,
  Bird,
  Cat,
  Dog,
  Droplets,
  Drumstick,
  Egg,
  Feather,
  Fish,
  FlaskConical,
  Flower2,
  FolderOpen,
  Footprints,
  Hammer,
  HardHat,
  Leaf,
  Milk,
  Package,
  PawPrint,
  PiggyBank,
  Pill,
  Rabbit,
  Sparkles,
  SprayCan,
  Sprout,
  Squirrel,
  Syringe,
  Tractor,
  Wheat,
  Wrench,
} from 'lucide-react'

const normalize = (text) =>
  String(text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

// tone: nombre del color (ver CategoryTone en CategoriesPage.css / CategoryPicker.css)
const CATEGORY_RULES = [
  { words: ['alimento', 'concentrado'], icon: Wheat, tone: 'amber' },
  { words: ['materia', 'forraje'], icon: Package, tone: 'brown' },
  { words: ['sal', 'suplement'], icon: Sparkles, tone: 'teal' },
  { words: ['mascota'], icon: PawPrint, tone: 'purple' },
  { words: ['vacuna', 'biologic'], icon: Syringe, tone: 'blue' },
  { words: ['medicamento', 'veterinari'], icon: Pill, tone: 'red' },
  { words: ['agroquimic', 'plaguicid'], icon: FlaskConical, tone: 'orange' },
  { words: ['fertiliz', 'abono'], icon: Leaf, tone: 'green' },
  { words: ['semilla'], icon: Sprout, tone: 'lime' },
  { words: ['herramienta'], icon: Wrench, tone: 'slate' },
  { words: ['equipo', 'implemento'], icon: Tractor, tone: 'brown' },
  { words: ['riego', 'cerca', 'agua'], icon: Droplets, tone: 'blue' },
  { words: ['higiene', 'aseo', 'desinfec'], icon: SprayCan, tone: 'teal' },
  { words: ['proteccion', 'dotacion'], icon: HardHat, tone: 'amber' },
  { words: ['jardin', 'hogar'], icon: Flower2, tone: 'pink' },
  { words: ['ferreteria'], icon: Hammer, tone: 'slate' },
]

// Íconos de especie para las subcategorías de alimento
const SPECIES_RULES = [
  { words: ['perro'], icon: Dog },
  { words: ['gato'], icon: Cat },
  { words: ['peces', 'pez'], icon: Fish },
  { words: ['hamster', 'roedor'], icon: Squirrel },
  { words: ['conejo', 'cuy'], icon: Rabbit },
  { words: ['cerdo', 'porcin'], icon: PiggyBank },
  { words: ['leche'], icon: Milk },
  { words: ['bovino', 'ternero', 'bufalo'], icon: Beef },
  { words: ['pollo', 'engorde'], icon: Drumstick },
  { words: ['ponedora', 'codorni'], icon: Egg },
  { words: ['pavo', 'pato', 'ganso', 'campo', 'traspatio'], icon: Feather },
  { words: ['ave', 'pajaro'], icon: Bird },
  { words: ['equino', 'ovino', 'caprino'], icon: Footprints },
]

const matches = (name, rules) => {
  const text = normalize(name)
  return rules.find((rule) => rule.words.some((word) => text.includes(word))) ?? null
}

/** { icon, tone } de una categoría principal. */
export function categoryVisual(name) {
  return matches(name, CATEGORY_RULES) ?? { icon: FolderOpen, tone: 'neutral' }
}

/** Ícono de una subcategoría: la especie si se reconoce; si no, el de su categoría. */
export function subcategoryIcon(name, parentName) {
  return matches(name, SPECIES_RULES)?.icon ?? categoryVisual(parentName).icon
}
