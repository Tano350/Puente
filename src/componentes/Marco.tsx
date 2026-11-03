import { useEffect, useRef } from 'react'
import { Outlet, useLocation } from 'react-router'
import { BarraLateral } from './BarraLateral.tsx'
import { BarraSecciones } from './BarraSecciones.tsx'
import estilos from './Marco.module.css'

// En el celular las secciones van abajo; en el computador, en la barra lateral.
export function Marco() {
  const { pathname } = useLocation()
  const contenido = useRef<HTMLElement>(null)
  // Cada pantalla nueva parte desde arriba
  useEffect(() => {
    contenido.current?.scrollTo(0, 0)
  }, [pathname])
  return (
    <div className={estilos.marco}>
      <BarraLateral />
      <main ref={contenido} className={estilos.contenido}>
        <Outlet />
      </main>
      <BarraSecciones />
    </div>
  )
}
