import { useEffect, useLayoutEffect, useRef } from 'react'
import { Outlet, useLocation, useNavigationType } from 'react-router'
import { sincronizarSuscripcion } from '../datos/dispositivo.ts'
import { modoMaqueta } from '../datos/maqueta.ts'
import { useSesion } from '../datos/sesion.tsx'
import { AvisoRechazos } from './AvisoRechazos.tsx'
import { BarraLateral } from './BarraLateral.tsx'
import { BarraSecciones } from './BarraSecciones.tsx'
import estilos from './Marco.module.css'

// En el celular las secciones van abajo; en el computador, en la barra lateral.
export function Marco() {
  const { key } = useLocation()
  const tipo = useNavigationType()
  const contenido = useRef<HTMLElement>(null)
  const posiciones = useRef(new Map<string, number>())
  // Lo que se abre parte desde arriba; al volver atrás, la pantalla aparece donde la dejaste
  useLayoutEffect(() => {
    contenido.current?.scrollTo(0, tipo === 'POP' ? (posiciones.current.get(key) ?? 0) : 0)
  }, [key, tipo])
  // Una vez al abrir la app con sesión: deja guardada la suscripción de avisos de este dispositivo
  const sesion = useSesion()
  const personaId = sesion.tipo === 'dentro' ? sesion.persona.id : null
  useEffect(() => {
    if (!personaId || (import.meta.env.DEV && modoMaqueta)) return
    sincronizarSuscripcion(personaId).catch(() => {
      // Sin señal o sin permiso: se intenta de nuevo la próxima vez que se abra
    })
  }, [personaId])
  return (
    <div className={estilos.marco}>
      <BarraLateral />
      <main ref={contenido} className={estilos.contenido} onScroll={(e) => posiciones.current.set(key, e.currentTarget.scrollTop)}>
        <Outlet />
      </main>
      <BarraSecciones />
      {personaId && <AvisoRechazos />}
    </div>
  )
}
