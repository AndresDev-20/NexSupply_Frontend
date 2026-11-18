import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import App from './App.jsx'
import { applyTheme, readCachedTheme } from './features/settings/theme'
import { applyPalette, readCachedPalette } from './features/settings/appearance'

// Tema guardado en este navegador, antes de dibujar: evita un parpadeo de colores
applyTheme(readCachedTheme())
applyPalette(readCachedPalette())

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
