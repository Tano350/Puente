import { NavLink, useLocation } from 'react-router'
import { useTextos } from '../textos.ts'
import { Icono } from './Icono.tsx'
import { secciones } from './secciones.ts'
import estilos from './BarraSecciones.module.css'

export function BarraSecciones() {
  const textos = useTextos()
  const { pathname } = useLocation()
  // En el celular, Tu perfil se abre desde Grupo: mientras estás ahí, Grupo queda marcado
  const enPerfil = pathname.startsWith('/perfil')
  return (
    <nav aria-label={textos.navegacion} className={estilos.barra}>
      {secciones.map(({ clave, ruta }) => (
        <NavLink
          key={clave}
          to={ruta}
          className={({ isActive }) => (isActive || (enPerfil && clave === 'grupo') ? `${estilos.enlace} ${estilos.activo}` : estilos.enlace)}
        >
          <Icono nombre={clave} />
          {textos.secciones[clave]}
        </NavLink>
      ))}
    </nav>
  )
}
