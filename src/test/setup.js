// Configuración común de las pruebas (Vitest + Testing Library)
import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach } from 'vitest'

// Las pantallas se cargan por partes (lazy): con la máquina ocupada la primera puede tardar
// más de 1 segundo. 3 segundos evita fallos por tiempo sin ocultar errores reales.
configure({ asyncUtilTimeout: 3000 })

// jsdom no trae ResizeObserver y las gráficas (Recharts) lo usan para medir su tamaño.
// En las pruebas basta con uno que no haga nada: se prueban los textos, no el dibujo.
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

afterEach(() => {
  cleanup()
})
