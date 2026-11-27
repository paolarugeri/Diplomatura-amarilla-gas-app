import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/montserrat/500.css'
import '@fontsource/montserrat/700.css'
import '@fontsource/montserrat/800.css'
import '@fontsource/open-sans/400.css'
import '@fontsource/open-sans/600.css'
import 'leaflet/dist/leaflet.css'
import './index.css'
import App from './App.tsx'

// Versión nueva publicada: el service worker de la PWA se actualiza y la página se recarga sola una vez,
// para que nadie quede usando la versión anterior guardada en el navegador.
if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
  let reloading = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return
    reloading = true
    window.location.reload()
  })
  // Además de al abrir la app, se busca una versión nueva cada vez que se vuelve a la pestaña.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') navigator.serviceWorker.getRegistration().then((r) => r?.update()).catch(() => {})
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
