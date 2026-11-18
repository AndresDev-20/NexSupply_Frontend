import { Provider } from 'react-redux'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { render } from '@testing-library/react'
import { makeStore } from '../app/store'
import { routes } from '../app/router'
import { ToastProvider } from '../components/feedback/Toast/ToastProvider'

/**
 * Dibuja la aplicación real (rutas, layout y store) en una ruta dada.
 * Cada prueba recibe un store nuevo para que el caché no se comparta.
 */
export function renderApp(initialPath = '/') {
  const store = makeStore()
  const router = createMemoryRouter(routes, { initialEntries: [initialPath] })
  const utils = render(
    <Provider store={store}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </Provider>,
  )
  return { ...utils, store, router }
}
