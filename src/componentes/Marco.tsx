import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import { Outlet, useLocation, useNavigationType } from 'react-router'
import { sincronizarSuscripcion } from '../datos/dispositivo.ts'
import { modoMaqueta } from '../datos/maqueta.ts'
import { useSesion } from '../datos/sesion.tsx'
import { cuerpo, sinMovimiento } from '../movimiento/index.ts'
import { AvisoRechazos } from './AvisoRechazos.tsx'
import { BarraLateral } from './BarraLateral.tsx'
import { BarraSecciones } from './BarraSecciones.tsx'
import { secciones } from './secciones.ts'
import { useEsComputador } from './useEsComputador.ts'
import estilos from './Marco.module.css'

// Al cambiar de pantalla: de una sección a otra, un deslizamiento corto hacia el lado de la sección nueva; en el
// celular, lo que se abre dentro de una sección entra desde la derecha y al volver la pantalla llega desde la izquierda.
// En el computador lo que se abre va en un panel encima, que entra solo (Paneles.tsx).
function lugar(ruta: string): { seccion: number; hondo: number } {
  const partes = ruta.split('/').filter(Boolean)
  const i = secciones.findIndex((s) => s.ruta === `/${partes[0] ?? ''}`)
  return { seccion: i < 0 ? secciones.length : i, hondo: partes.length }
}

function useCambioDePantalla(contenido: RefObject<HTMLElement | null>, ruta: string, computador: boolean) {
  const anterior = useRef(ruta)
  useLayoutEffect(() => {
    const antes = anterior.current
    anterior.current = ruta
    const main = contenido.current
    if (antes === ruta || !main || sinMovimiento()) return
    const de = lugar(antes)
    const a = lugar(ruta)
    let desde = 0
    if (de.seccion !== a.seccion) desde = a.seccion > de.seccion ? 18 : -18
    else if (!computador && a.hondo !== de.hondo) desde = a.hondo > de.hondo ? 70 : -40
    if (!desde) return
    for (const hijo of Array.from(main.children)) {
      if (!(hijo instanceof HTMLElement)) continue
      // Una pantalla que tapa todo (crear, anotar) se mueve ella: es fija y no la arrastraría su contenedor
      const objetivo = hijo.querySelector<HTMLElement>('[data-encima]') ?? hijo
      cuerpo(objetivo).pos({ x: desde }).meta({ x: 0 })
      objetivo.animate([{ opacity: 0.35 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' })
    }
  }, [contenido, ruta, computador])
}

// En el celular las secciones van abajo; en el computador, en la barra lateral.
export function Marco() {
  const { key, pathname } = useLocation()
  const tipo = useNavigationType()
  const contenido = useRef<HTMLElement>(null)
  const posiciones = useRef(new Map<string, number>())
  const computador = useEsComputador()
  useCambioDePantalla(contenido, pathname, computador)
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
