import { Outlet } from 'react-router'
import { useSesion } from '../datos/sesion.tsx'
import { Entrar } from '../pantallas/Entrar.tsx'
import { PrimeraVez } from '../pantallas/PrimeraVez.tsx'
import { useTextos } from '../textos.ts'
import { Tuerca } from './Tuerca.tsx'
import estilos from './Puerta.module.css'

// Solo deja pasar a quien entró con una cuenta invitada; la primera vez, pasa por su lista de tareas
export function Puerta() {
  const sesion = useSesion()
  const textos = useTextos()
  // Mientras se revisa la sesión (un instante), la tuerca en vez de una pantalla en blanco
  if (sesion.tipo === 'cargando')
    return (
      <div className={estilos.cargando} role="status" aria-label={textos.cargando}>
        <Tuerca ancho={56} />
      </div>
    )
  if (sesion.tipo !== 'dentro') return <Entrar />
  if (!sesion.persona.bienvenida_en) return <PrimeraVez />
  return <Outlet />
}
