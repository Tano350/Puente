import { useSyncExternalStore } from 'react'
import { hoyEnCalifornia } from '../datos/fechas.ts'
import { useSesion } from '../datos/sesion.tsx'
import { useTextos } from '../textos.ts'
import estilos from './HoraDeChile.module.css'

const GUARDADA = 'puente.horaDeChile'

// Lo elegido es uno solo para toda la app: al cambiarlo en una cabecera, cambia también en el boleto de al lado
function leerGuardada(): boolean | null {
  try {
    const guardada = localStorage.getItem(GUARDADA)
    return guardada === null ? null : guardada === '1'
  } catch {
    return null
  }
}
let elegida = leerGuardada()
const avisar = new Set<() => void>()
const suscribir = (cambio: () => void) => {
  avisar.add(cambio)
  return () => void avisar.delete(cambio)
}

// Mostrar también la hora de Chile. Mientras no estés allá se muestra sin pedirlo; si la cambias, queda como la dejaste.
export function useHoraDeChile(): [boolean, (mostrar: boolean) => void] {
  const sesion = useSesion()
  const actual = useSyncExternalStore(suscribir, () => elegida)
  const persona = sesion.tipo === 'dentro' ? sesion.persona : null
  const hoy = hoyEnCalifornia()
  const alla = Boolean(persona?.llega && persona.vuelve && persona.llega <= hoy && hoy <= persona.vuelve)
  const cambiar = (mostrar: boolean) => {
    elegida = mostrar
    try {
      localStorage.setItem(GUARDADA, mostrar ? '1' : '0')
    } catch {
      // Sin almacenamiento se recuerda solo mientras la app está abierta
    }
    avisar.forEach((cambio) => cambio())
  }
  return [actual ?? !alla, cambiar]
}

// "Hora de Chile" con su interruptor, como en la cabecera de Hoy y de la Agenda
export function InterruptorHoraDeChile({ activo, onCambio }: { activo: boolean; onCambio: (activo: boolean) => void }) {
  const textos = useTextos()
  return (
    <span className={estilos.hora}>
      <span aria-hidden="true">{textos.agenda.horaDeChile}</span>
      <button type="button" role="switch" aria-checked={activo} aria-label={textos.agenda.horaDeChile} className={estilos.interruptor} onClick={() => onCambio(!activo)}>
        <span className={estilos.pista} data-activo={activo}>
          <span className={estilos.perilla} />
        </span>
      </button>
    </span>
  )
}
