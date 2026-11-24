import { Icono } from '../../componentes/Icono.tsx'
import type { Persona } from '../../datos/consultas.ts'
import { interesadosDe, leInteresa, type Interesado, type Tema } from '../../datos/intereses.ts'
import { primerNombre } from '../../datos/nombres.ts'
import { useTextos } from '../../textos.ts'
import estilos from './ListaTemas.module.css'

type Props = {
  temas: readonly Tema[]
  interesados: readonly Interesado[]
  // Los integrantes de Puente, contigo primero (quien salió o nunca entró no se nombra)
  gente: readonly Persona[]
  yo: string
  // El tema elegido en el computador
  elegido?: string
  sinRed: boolean
  onAbrir: (tema: Tema) => void
  onSumar: (tema: Tema) => void
}

// Los temas como tarjetas, por nombre: de qué trata, a quiénes les interesa y «Me interesa» o «✓ Te interesa».
// Toda la tarjeta abre el tema; «Me interesa» queda aparte.
export function ListaTemas({ temas, interesados, gente, yo, elegido, sinRed, onAbrir, onSumar }: Props) {
  const textos = useTextos()
  const c = textos.intereses.comun
  const g = textos.intereses.grupo
  return (
    <ul className={estilos.lista}>
      {temas.map((tema) => {
        const dentro = new Set(interesadosDe(tema.id, [...interesados]))
        const nombres = gente.filter((p) => dentro.has(p.id)).map((p) => (p.id === yo ? textos.grupo.tu : primerNombre(p)))
        const mio = leInteresa(tema.id, yo, [...interesados])
        return (
          <li key={tema.id} className={estilos.tarjeta} data-elegida={elegido === tema.id}>
            <button type="button" className={estilos.abrir} data-mio={mio} onClick={() => onAbrir(tema)}>
              <span className={estilos.nombre}>{tema.nombre}</span>
              {tema.de_que_trata && <span className={estilos.trata}>{tema.de_que_trata}</span>}
              <span className={estilos.raya} aria-hidden="true" />
              <span className={estilos.gente} data-nadie={nombres.length === 0}>
                {nombres.length > 0 ? textos.y(nombres) : g.nadie}
              </span>
            </button>
            {mio ? (
              <span className={estilos.teInteresa}>
                <Icono nombre="check" medida={16} trazo={2.25} />
                {c.teInteresa}
              </span>
            ) : (
              <button type="button" className={estilos.meInteresa} aria-disabled={sinRed} onClick={() => onSumar(tema)}>
                {c.meInteresa}
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}
