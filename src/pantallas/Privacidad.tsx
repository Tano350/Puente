import { Tuerca } from '../componentes/Tuerca.tsx'
import { useTextos } from '../textos.ts'
import estilos from './Privacidad.module.css'

// Página pública: Google la pide para que cualquiera pueda entrar con su cuenta.
export function Privacidad() {
  const { privacidad } = useTextos()
  return (
    <main className={estilos.pagina}>
      <div className={estilos.marca}>
        <Tuerca ancho={26} />
        <span className={estilos.nombre}>Puente</span>
      </div>
      <h1 className={estilos.titulo}>{privacidad.titulo}</h1>
      {privacidad.parrafos.map((parrafo) => (
        <p key={parrafo} className={estilos.parrafo}>
          {parrafo}
        </p>
      ))}
      <p className={estilos.fecha}>{privacidad.actualizada}</p>
    </main>
  )
}
