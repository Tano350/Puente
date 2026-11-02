import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import '@fontsource/barlow/latin-400.css'
import '@fontsource/barlow/latin-ext-400.css'
import '@fontsource/barlow/latin-500.css'
import '@fontsource/barlow/latin-ext-500.css'
import '@fontsource/barlow-semi-condensed/latin-600.css'
import '@fontsource/barlow-semi-condensed/latin-ext-600.css'
import '@fontsource/barlow-semi-condensed/latin-700.css'
import '@fontsource/barlow-semi-condensed/latin-ext-700.css'
import './estilos/base.css'
import { rutas } from './rutas.tsx'

createRoot(document.getElementById('raiz')!).render(
  <StrictMode>
    <RouterProvider router={rutas} />
  </StrictMode>,
)
