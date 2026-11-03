import { createBrowserRouter, Navigate } from 'react-router'
import { Marco } from './componentes/Marco.tsx'
import { Contactos } from './pantallas/contactos/Contactos.tsx'
import { Puerta } from './componentes/Puerta.tsx'
import { Grupo } from './pantallas/grupo/Grupo.tsx'
import { Hoy } from './pantallas/hoy/Hoy.tsx'
import { Invitados } from './pantallas/perfil/Invitados.tsx'
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
          { path: 'hoy', element: <Hoy /> },
          { path: 'agenda', element: <SeccionVacia clave="agenda" /> },
          // /contactos, /contactos/nuevo, /contactos/:id y /contactos/:id/editar: una sola ruta, para no perder la búsqueda
          { path: 'contactos/:id?/:accion?', element: <Contactos /> },
          { path: 'gastos', element: <SeccionVacia clave="gastos" /> },
          // Una sola ruta, para que elegir a alguien no reinicie la búsqueda
          { path: 'grupo/:id?', element: <Grupo /> },
          { path: 'perfil', element: <TuPerfil /> },
          { path: 'perfil/invitados', element: <Invitados /> },
          { path: '*', element: <Navigate to="/hoy" replace /> },
        ],
      },
    ],
  },
])
