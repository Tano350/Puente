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
import { QueryClientProvider } from '@tanstack/react-query'
import './estilos/base.css'
import { consultas } from './datos/consultas.ts'
import { SesionProvider } from './datos/sesion.tsx'
import { rutas } from './rutas.tsx'

createRoot(document.getElementById('raiz')!).render(
  <StrictMode>
    <QueryClientProvider client={consultas}>
      <SesionProvider>
        <RouterProvider router={rutas} />
      </SesionProvider>
    </QueryClientProvider>
  </StrictMode>,
)
