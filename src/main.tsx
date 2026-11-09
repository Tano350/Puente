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
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import './estilos/base.css'
// El modo oscuro o claro de este dispositivo (index.html ya lo puso antes de dibujar)
import './datos/tema.ts'
import { consultas } from './datos/consultas.ts'
import { SesionProvider } from './datos/sesion.tsx'
import { alRestaurar, guardadoEnDispositivo } from './datos/sinSenal.ts'
// Lo que se escribe sin señal (notas, gastos, boletas, rendición y marcar tareas) se registra al cargar estos archivos: tiene que
// estar antes de restaurar lo que esperaba en el dispositivo, aunque las pantallas carguen después
import './datos/contactos.ts'
import './datos/eventos.ts'
import './datos/gastos.ts'
import './datos/tareas.ts'
import { rutas } from './rutas.tsx'

createRoot(document.getElementById('raiz')!).render(
  <StrictMode>
    <PersistQueryClientProvider client={consultas} persistOptions={guardadoEnDispositivo} onSuccess={alRestaurar}>
      <SesionProvider>
        <RouterProvider router={rutas} />
      </SesionProvider>
    </PersistQueryClientProvider>
  </StrictMode>,
)
