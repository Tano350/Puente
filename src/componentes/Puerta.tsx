import { Outlet } from 'react-router'
import { useSesion } from '../datos/sesion.tsx'
import { Entrar } from '../pantallas/Entrar.tsx'
import { PrimeraVez } from '../pantallas/PrimeraVez.tsx'

// Solo deja pasar a quien entró con una cuenta invitada; la primera vez, pasa por su lista de tareas
export function Puerta() {
  const sesion = useSesion()
  if (sesion.tipo === 'cargando') return null
  if (sesion.tipo !== 'dentro') return <Entrar />
  if (!sesion.persona.bienvenida_en) return <PrimeraVez />
  return <Outlet />
}
