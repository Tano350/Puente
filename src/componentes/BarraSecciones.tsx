import { useEffect, useRef } from 'react'
import { NavLink, useLocation } from 'react-router'
import { empujon, usePastilla } from '../movimiento/index.ts'
import { useTextos } from '../textos.ts'
import { Icono } from './Icono.tsx'
import { secciones } from './secciones.ts'
import { recordarSeccion } from './seccionPrevia.ts'
import estilos from './BarraSecciones.module.css'

export function BarraSecciones() {
  const textos = useTextos()
  const { pathname } = useLocation()
  // Tu perfil no es una de las seis secciones: ahí no queda marcada ninguna, y "volver" regresa a la última que se vio
  useEffect(() => recordarSeccion(pathname), [pathname])
  // La raya azul de la sección se desliza hasta la nueva
  const barra = useRef<HTMLElement>(null)
  usePastilla(barra)
  // Al llegar a otra sección, su ícono da un salto chico
  const seccion = pathname.split('/')[1]
  useEffect(() => {
    empujon(barra.current?.querySelector('[aria-current="page"] svg'), { s: 2.2, r: 0.8 })
  }, [seccion])
  return (
    <nav ref={barra} aria-label={textos.navegacion} className={estilos.barra}>
      <span className={estilos.raya} data-pastilla aria-hidden="true" />
      {secciones.map(({ clave, ruta }) => (
        <NavLink key={clave} to={ruta} className={({ isActive }) => (isActive ? `${estilos.enlace} ${estilos.activo}` : estilos.enlace)}>
          <Icono nombre={clave} />
          {textos.secciones[clave]}
        </NavLink>
      ))}
    </nav>
  )
}
