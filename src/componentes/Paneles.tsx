import type { ReactNode } from 'react'
import { useTextos } from '../textos.ts'
import { Pie } from './Controles.tsx'
import { Icono } from './Icono.tsx'
import estilos from './Paneles.module.css'

// En el computador: panel de 430 px encima del lado derecho, con su cabecera y el botón fijo abajo.
// Va dentro de un contenedor con position: relative (el cuerpo de la pantalla).
export function PanelEncima({ etiqueta, cabecera, pie, children, onCerrar }: { etiqueta: string; cabecera?: ReactNode; pie?: ReactNode; children: ReactNode; onCerrar: () => void }) {
  const textos = useTextos()
  return (
    <aside aria-label={etiqueta} className={estilos.panel}>
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
    <div className={encima ? estilos.encima : estilos.pantalla}>
      <div className={estilos.desplazable}>{children}</div>
      {pie && <Pie>{pie}</Pie>}
    </div>
  )
}
