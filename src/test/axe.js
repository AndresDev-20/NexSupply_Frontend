// Revisión automática de accesibilidad con axe-core (Fase 15, D-UX-5).
//
//   await expectAccessible(document.body)
//
// Revisa reglas WCAG 2.1 A y AA: etiquetas de campos, nombres de botones y enlaces, roles,
// atributos ARIA, encabezados, listas, ids repetidos… Si algo falla, la prueba muestra qué
// regla, en qué elemento y cómo corregirlo.
//
// El contraste de colores NO se revisa aquí: jsdom no calcula estilos reales. Se revisa en el
// navegador (docs/DECISIONES.md, D-UX-F1).
import axe from 'axe-core'
import { expect } from 'vitest'

const OPTIONS = {
  runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
  rules: {
    'color-contrast': { enabled: false },
    // La región principal la da el layout; en pantallas probadas sueltas no aplica
    region: { enabled: false },
  },
}

// axe no permite dos revisiones a la vez
let running = Promise.resolve()

export async function axeViolations(node = document.body) {
  const run = running.then(() => axe.run(node, OPTIONS))
  running = run.catch(() => {})
  const result = await run
  return result.violations
}

const describeViolation = (violation) =>
  `• ${violation.id} (${violation.impact}): ${violation.help}\n${violation.nodes
    .slice(0, 3)
    .map((node) => `    ${node.target.join(' ')}\n      ${node.failureSummary?.split('\n').slice(1).join(' ').trim()}`)
    .join('\n')}`

/** Falla la prueba si axe encuentra problemas de accesibilidad. */
export async function expectAccessible(node = document.body) {
  const violations = await axeViolations(node)
  expect(violations.map(describeViolation).join('\n\n'), 'Problemas de accesibilidad').toBe('')
}
