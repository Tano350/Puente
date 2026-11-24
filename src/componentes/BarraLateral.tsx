import { useRef } from 'react'
import { NavLink } from 'react-router'
import { usePastilla } from '../movimiento/index.ts'
import { useTextos } from '../textos.ts'
import { Icono, type NombreIcono } from './Icono.tsx'
import { secciones } from './secciones.ts'
import { Tuerca } from './Tuerca.tsx'
import estilos from './BarraLateral.module.css'

function Enlace({ ruta, icono, nombre }: { ruta: string; icono: NombreIcono; nombre: string }) {
  return (
    <NavLink to={ruta} className={({ isActive }) => (isActive ? `${estilos.enlace} ${estilos.activo}` : estilos.enlace)}>
      <Icono nombre={icono} medida={22} />
      {nombre}
    </NavLink>
  )
}

export function BarraLateral() {
  const textos = useTextos()
  // El fondo de la sección elegida se desliza hasta la nueva
  const barra = useRef<HTMLElement>(null)
  usePastilla(barra, 'y')
  return (
    <nav ref={barra} aria-label={textos.navegacion} className={estilos.barra}>
      <span className={estilos.elegida} data-pastilla aria-hidden="true" />
      <div className={estilos.marca}>
        <Tuerca ancho={26} />
        <span className={estilos.nombre}>Puente</span>
      </div>
      <div className={estilos.lista}>
        {secciones.map(({ clave, ruta }) => (
          <Enlace key={clave} ruta={ruta} icono={clave} nombre={textos.secciones[clave]} />
        ))}
      </div>
      <div className={estilos.relleno} />
      <Enlace ruta="/perfil" icono="perfil" nombre={textos.secciones.perfil} />
    </nav>
  )
}
