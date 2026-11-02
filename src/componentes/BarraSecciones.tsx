import { NavLink } from 'react-router'
import { useTextos } from '../textos.ts'
import { Icono } from './Icono.tsx'
import { secciones } from './secciones.ts'
import estilos from './BarraSecciones.module.css'

export function BarraSecciones() {
  const textos = useTextos()
  return (
    <nav aria-label={textos.navegacion} className={estilos.barra}>
      {secciones.map(({ clave, ruta }) => (
        <NavLink
          key={clave}
          to={ruta}
          className={({ isActive }) => (isActive ? `${estilos.enlace} ${estilos.activo}` : estilos.enlace)}
        >
          <Icono nombre={clave} />
          {textos.secciones[clave]}
        </NavLink>
      ))}
    </nav>
  )
}
