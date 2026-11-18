import { Suspense } from 'react'
import { Provider } from 'react-redux'
import { RouterProvider } from 'react-router-dom'
import { store } from './app/store'
import { router } from './app/router'
import { LoadingScreen } from './components/feedback/LoadingScreen/LoadingScreen'
import { ToastProvider } from './components/feedback/Toast/ToastProvider'

export default function App() {
  return (
    <Provider store={store}>
      {/* Mientras se descarga la estructura principal se muestra la pantalla de carga */}
      <ToastProvider>
        <Suspense fallback={<LoadingScreen />}>
          <RouterProvider router={router} />
        </Suspense>
      </ToastProvider>
    </Provider>
  )
}
