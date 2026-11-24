import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { cuerpo } from '../movimiento/index.ts'
import { useTextos } from '../textos.ts'
import { Pie } from './Controles.tsx'
import { Icono } from './Icono.tsx'
import estilos from './Paneles.module.css'

// En el computador: panel de 430 px encima del lado derecho, con su cabecera y el botón fijo abajo.
// Va dentro de un contenedor con position: relative (el cuerpo de la pantalla).
export function PanelEncima({ etiqueta, cabecera, pie, children, onCerrar }: { etiqueta: string; cabecera?: ReactNode; pie?: ReactNode; children: ReactNode; onCerrar: () => void }) {
  const textos = useTextos()
  // Al abrirse entra desde la derecha (cambiar lo que muestra no lo vuelve a mover)
  const panel = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    if (panel.current) cuerpo(panel.current).pos({ x: 48 }).meta({ x: 0 })
  }, [])
  return (
    <aside ref={panel} aria-label={etiqueta} className={estilos.panel}>
      <div className={estilos.cabeza}>
        <div className={estilos.izquierda}>{cabecera}</div>
        <button type="button" aria-label={textos.cerrar} className={estilos.cerrar} onClick={onCerrar}>
          <Icono nombre="cerrar" medida={20} trazo={2} />
        </button>
      </div>
      {children}
      {pie ? <div className={estilos.pie}>{pie}</div> : <div className={estilos.final} />}
    </aside>
  )
}

// En el celular: el contenido se desplaza y el botón queda fijo abajo.
// Con "encima" tapa todo, también la barra de secciones (para lo que se termina o se cancela).
export function PantallaConPie({ pie, children, encima = false }: { pie?: ReactNode; children: ReactNode; encima?: boolean }) {
  return (
    <div className={encima ? estilos.encima : estilos.pantalla} data-encima={encima || undefined}>
      <div className={estilos.desplazable}>{children}</div>
      {pie && <Pie>{pie}</Pie>}
    </div>
  )
}
