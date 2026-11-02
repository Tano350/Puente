import { useTextos, type Textos } from '../textos.ts'
import estilos from './SeccionVacia.module.css'

// Lugar de cada sección mientras se construye.
export function SeccionVacia({ clave }: { clave: keyof Textos['secciones'] }) {
  const textos = useTextos()
  return (
    <div className={estilos.seccion}>
      <h1 className={estilos.titulo}>{textos.secciones[clave]}</h1>
    </div>
  )
}
