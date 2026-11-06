import { createBrowserRouter, Navigate } from 'react-router'
import { Marco } from './componentes/Marco.tsx'
import { Puerta } from './componentes/Puerta.tsx'

// Mientras se carga la primera sección al abrir la app (un instante: ya está guardada en el dispositivo) no se muestra nada
function Nada() {
  return null
}

// Acerca y Privacidad no están aquí: son páginas fijas (public/acerca.html y public/privacidad.html)
export const rutas = createBrowserRouter([
  {
    element: <Puerta />,
    HydrateFallback: Nada,
    children: [
      {
        element: <Marco />,
        children: [
          { index: true, element: <Navigate to="/hoy" replace /> },
          { path: 'hoy', lazy: () => import('./pantallas/hoy/Hoy.tsx').then((m) => ({ Component: m.Hoy })) },
          // /agenda, /agenda/nuevo, /agenda/:id y /agenda/:id/editar: una sola ruta, para no perder la vista ni la semana
          { path: 'agenda/:id?/:accion?', lazy: () => import('./pantallas/agenda/Agenda.tsx').then((m) => ({ Component: m.Agenda })) },
          // /contactos, /contactos/nuevo, /contactos/:id y /contactos/:id/editar: una sola ruta, para no perder la búsqueda
          { path: 'contactos/:id?/:accion?', lazy: () => import('./pantallas/contactos/Contactos.tsx').then((m) => ({ Component: m.Contactos })) },
          { path: 'gastos/:id?/:accion?', lazy: () => import('./pantallas/gastos/Gastos.tsx').then((m) => ({ Component: m.Gastos })) },
          // Una sola ruta, para que elegir a alguien no reinicie la búsqueda
          { path: 'grupo/:id?', lazy: () => import('./pantallas/grupo/Grupo.tsx').then((m) => ({ Component: m.Grupo })) },
          { path: 'perfil', lazy: () => import('./pantallas/perfil/TuPerfil.tsx').then((m) => ({ Component: m.TuPerfil })) },
          { path: 'perfil/invitados', lazy: () => import('./pantallas/perfil/Invitados.tsx').then((m) => ({ Component: m.Invitados })) },
          { path: '*', element: <Navigate to="/hoy" replace /> },
        ],
      },
    ],
  },
])
