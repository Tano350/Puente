import { useEffect } from 'react'
import { NavLink, useLocation } from 'react-router'
import { useTextos } from '../textos.ts'
import { Icono } from './Icono.tsx'
import { secciones } from './secciones.ts'
import { recordarSeccion } from './seccionPrevia.ts'
import estilos from './BarraSecciones.module.css'

export function BarraSecciones() {
  const textos = useTextos()
  const { pathname } = useLocation()
  // Tu perfil no es una de las cinco secciones: ahí no queda marcada ninguna, y "volver" regresa a la última que se vio
  useEffect(() => recordarSeccion(pathname), [pathname])
  return (
    <nav aria-label={textos.navegacion} className={estilos.barra}>
      {secciones.map(({ clave, ruta }) => (
        <NavLink key={clave} to={ruta} className={({ isActive }) => (isActive ? `${estilos.enlace} ${estilos.activo}` : estilos.enlace)}>
          <Icono nombre={clave} />
          {textos.secciones[clave]}
        </NavLink>
      ))}
    </nav>
  )
}
