import { Outlet } from 'react-router'
import { BarraLateral } from './BarraLateral.tsx'
import { BarraSecciones } from './BarraSecciones.tsx'
import estilos from './Marco.module.css'

// En el celular las secciones van abajo; en el computador, en la barra lateral.
export function Marco() {
  return (
    <div className={estilos.marco}>
      <BarraLateral />
      <main className={estilos.contenido}>
        <Outlet />
      </main>
      <BarraSecciones />
    </div>
  )
}
