import { NavLink } from 'react-router'
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
  return (
    <nav aria-label={textos.navegacion} className={estilos.barra}>
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
