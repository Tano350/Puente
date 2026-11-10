import type { Persona } from '../../datos/consultas.ts'
import { conMayuscula, diaLargo, hora } from '../../datos/fechas.ts'
import { useTextos } from '../../textos.ts'
import { diasDelMes, type Pieza } from './AgendaDatos.ts'
import estilos from './AgendaMes.module.css'

type Props = {
  dia: string
  piezas: Map<string, Pieza[]>
  computador: boolean
  hoy: string
  yo: Pick<Persona, 'llega' | 'vuelve'>
  soloVoy: boolean
  onDia: (dia: string) => void
}

// El mes: tu estadía como línea bajo los días y hoy en una tuerca. Tocar un día lo abre en la vista Día.
// En el celular, un punto por evento (lleno si vas); en el computador, fichas con hora y nombre.
export function AgendaMes({ dia, piezas, computador, hoy, yo, soloVoy, onDia }: Props) {
  const tv = useTextos().agenda.vista
  const mes = dia.slice(0, 7)
  const enEstadia = (d: string) => Boolean(yo.llega && yo.vuelve && yo.llega <= d && d <= yo.vuelve)

  const celdas = diasDelMes(dia).map((d) => {
    const delMes = d.slice(0, 7) === mes
    const lista = delMes ? (piezas.get(d) ?? []) : []
    const eventos = lista.filter((p) => p.tipo === 'evento')
    const esHoy = d === hoy
    const etiqueta = [esHoy ? tv.hoyEs(diaLargo(d)) : conMayuscula(diaLargo(d)), eventos.length > 0 ? tv.eventos(eventos.length) : null].filter(Boolean).join(', ')

    let contenido
    if (computador) {
      // Hasta 3 fichas; si hay más, 2 y "+N más"
      const muestra = lista.length > 3 ? lista.slice(0, 2) : lista
      contenido = (
        <>
          {muestra.map((p) => (
            <span key={p.id} className={estilos.ficha} data-tipo={p.tipo === 'ocupado' ? 'ocupado' : p.proxima ? 'proxima' : p.mio ? 'mio' : 'ajeno'}>
              {hora(p.inicio)} {p.titulo}
            </span>
          ))}
          {lista.length > 3 && <span className={estilos.mas}>{tv.masEventos(lista.length - 2)}</span>}
        </>
      )
    } else {
      // Primero los tuyos (llenos), después los demás (huecos); con más de 4, tres y "+N"
      const puntos = [...eventos.filter((p) => p.mio), ...eventos.filter((p) => !p.mio)]
      const muestra = puntos.length > 4 ? puntos.slice(0, 3) : puntos
      contenido = (
        <span className={estilos.puntos} aria-hidden="true">
          {muestra.map((p) => (
            <span key={p.id} className={estilos.punto} data-mio={p.mio} />
          ))}
          {puntos.length > 4 && <span className={estilos.masPuntos}>{tv.masPuntos(puntos.length - 3)}</span>}
        </span>
      )
    }

    return (
      <button
        key={d}
        type="button"
        className={estilos.celda}
        aria-label={etiqueta}
        aria-current={esHoy ? 'date' : undefined}
        data-estadia={delMes && enEstadia(d)}
        disabled={!delMes}
        onClick={() => onDia(d)}
      >
        <span className={estilos.numero} aria-hidden="true">
          {Number(d.slice(8))}
        </span>
        {computador && <span className={estilos.estadia} />}
        {contenido}
        {!computador && <span className={estilos.estadia} />}
      </button>
    )
  })

  return (
    <>
      <div className={computador ? estilos.mesPc : estilos.mes}>
        <div className={estilos.semana} aria-hidden="true">
          {tv.diasCortos.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className={estilos.dias}>{celdas}</div>
      </div>
      <div className={computador ? estilos.leyendaPc : estilos.leyenda} aria-hidden="true">
        <span>
          <span className={estilos.marcaEstadia} />
          {tv.tuEstadia}
        </span>
        <span>
          <span className={estilos.marcaVas} />
          {tv.estados.vas}
        </span>
        {!soloVoy && (
          <span>
            <span className={estilos.marcaNoVas} />
            {tv.noVas}
          </span>
        )}
      </div>
    </>
  )
}
