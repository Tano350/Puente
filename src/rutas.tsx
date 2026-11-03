import { createBrowserRouter, Navigate } from 'react-router'
import { Marco } from './componentes/Marco.tsx'
import { Puerta } from './componentes/Puerta.tsx'
import { TuPerfil } from './pantallas/perfil/TuPerfil.tsx'
import { Privacidad } from './pantallas/Privacidad.tsx'
import { SeccionVacia } from './pantallas/SeccionVacia.tsx'

export const rutas = createBrowserRouter([
  { path: 'privacidad', element: <Privacidad /> },
  {
    element: <Puerta />,
    children: [
      {
        element: <Marco />,
        children: [
          { index: true, element: <Navigate to="/hoy" replace /> },
          { path: 'hoy', element: <SeccionVacia clave="hoy" /> },
          { path: 'agenda', element: <SeccionVacia clave="agenda" /> },
          { path: 'contactos', element: <SeccionVacia clave="contactos" /> },
          { path: 'gastos', element: <SeccionVacia clave="gastos" /> },
          { path: 'grupo', element: <SeccionVacia clave="grupo" /> },
          { path: 'perfil', element: <TuPerfil /> },
          { path: '*', element: <Navigate to="/hoy" replace /> },
        ],
      },
    ],
  },
])
