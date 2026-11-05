import { useState, type CSSProperties } from 'react'
import type { Evento, Ocupado } from '../../datos/eventos.ts'
import { CHILE, conMayuscula, diaLargo, hora, momento, type Ventana } from '../../datos/fechas.ts'
import { useTextos } from '../../textos.ts'
import { acomodar, enElViaje, horasDe, lugarYCiudad, type Pieza } from './AgendaDatos.ts'
import { AgendaRato } from './AgendaRato.tsx'
import estilos from './AgendaSemana.module.css'

type Props = {
  dias: string[]
  piezas: Map<string, Pieza[]>
  computador: boolean
  chile: boolean
  hoy: string
  ahora: string
  viaje: Ventana
  elegido?: string
  onAbrir: (evento: Evento) => void
  onDia: (dia: string) => void
}

// Las 7 columnas con horas. Lo tuyo va lleno, lo de los demás con borde y lo siguiente a lo que vas en acento.
// Tocar un día lo abre en la vista Día; tocar un rato ocupado abre su hoja.
export function AgendaSemana({ dias, piezas, computador, chile, hoy, ahora, viaje, elegido, onAbrir, onDia }: Props) {
  const textos = useTextos()
  const tv = textos.agenda.vista
  const [rato, setRato] = useState<Ocupado | null>(null)
  // Px por hora: en el celular la semana entera cabe en la pantalla
  const alto = computador ? 42 : 30
  const [primera, ultima] = horasDe(dias.flatMap((d) => piezas.get(d) ?? []))
  const horas = Array.from({ length: ultima - primera }, (_, i) => primera + i)
  const [ahoraH, ahoraM] = hora(ahora).split(':').map(Number)
  const ahoraMin = ahoraH * 60 + ahoraM
  const y = (minutos: number) => (minutos / 60 - primera) * alto
  // La hora de Chile de cada hora de California, esa semana
  const enChile = (h: number) => Number(hora(momento(dias[0], `${String(h).padStart(2, '0')}:00`), CHILE).slice(0, 2))

  const bloque = (p: Pieza, columna: number, columnas: number) => {
    const largo = Math.max(y(Math.min(p.hasta, 1440)) - y(p.desde), alto / 2) - (computador ? 3 : 2)
    // El margen a los lados lo pone el CSS (se angosta si la columna es angosta)
    const lugar: CSSProperties = {
      top: y(p.desde) + 1,
      height: largo,
      left: `calc(${(columna / columnas) * 100}% + var(--margen))`,
      width: `calc(${100 / columnas}% - 2 * var(--margen))`,
    }
    const desde = hora(p.inicio)
    if (p.tipo === 'ocupado')
      return (
        <button
          key={p.id}
          type="button"
          className={estilos.ocupado}
          style={lugar}
          aria-label={textos.agenda.rato.ocupadoDe(p.titulo, desde, hora(p.fin))}
          aria-haspopup="dialog"
          data-pasada={p.pasada}
          onClick={() => setRato(p.ocupado)}
        >
          {computador && (
            <>
              <span className={estilos.bloqueHora}>{desde}</span>
              <span className={estilos.bloqueTitulo}>{p.titulo}</span>
            </>
          )}
        </button>
      )
    const sitio = computador && largo >= 80 ? lugarYCiudad(p.evento) : ''
    // En el celular el nombre va solo si cabe bajo la hora
    const lineas = !computador && largo >= 50 ? Math.floor((largo - 17) / 13) : 0
    return (
      <button
        key={p.id}
        type="button"
        className={estilos.bloque}
        style={lugar}
        aria-pressed={computador ? elegido === p.id : undefined}
        aria-label={`${desde}, ${p.titulo}, ${tv.estados[p.estado]}`}
        data-mio={p.mio}
        data-proxima={p.proxima}
        data-pasada={p.pasada}
        onClick={() => onAbrir(p.evento)}
      >
        <span className={estilos.bloqueHora}>{desde}</span>
        {(computador || lineas > 0) && (
          <span className={estilos.bloqueTitulo} style={computador ? undefined : { WebkitLineClamp: lineas }}>
            {p.titulo}
          </span>
        )}
        {sitio && <span className={estilos.bloqueLugar}>{sitio}</span>}
      </button>
    )
  }

  return (
    <>
      <div className={computador ? estilos.semanaPc : estilos.semana} style={{ '--hora': `${alto}px` } as CSSProperties}>
        <div className={estilos.esquina} />
        {dias.map((dia, i) => {
          const esHoy = dia === hoy
          return (
            <button
              key={dia}
              type="button"
              className={estilos.cabeza}
              aria-label={esHoy ? tv.hoyEs(diaLargo(dia)) : conMayuscula(diaLargo(dia))}
              aria-current={esHoy ? 'date' : undefined}
              data-pasado={dia < hoy}
              disabled={!enElViaje(dia, viaje)}
              onClick={() => onDia(dia)}
            >
              <span className={estilos.cabezaDia}>{esHoy ? tv.hoy : tv.diasCortos[i]}</span>
              <span className={estilos.cabezaNumero}>{Number(dia.slice(8))}</span>
            </button>
          )
        })}
        <div className={estilos.horas} aria-hidden="true" style={{ height: horas.length * alto }}>
          {horas
            .filter((h) => computador || (h - primera) % 2 === 0)
            .map((h) => (
              <span key={h} className={estilos.hora} style={{ top: y(h * 60) + 2 }}>
                {h}
                {computador && chile && <span className={estilos.horaChile}>{enChile(h)}</span>}
              </span>
            ))}
        </div>
        {dias.map((dia) => (
          <div key={dia} className={estilos.columna} data-hoy={dia === hoy}>
            {acomodar(piezas.get(dia) ?? []).map(({ pieza, columna, columnas }) => bloque(pieza, columna, columnas))}
            {dia === hoy && ahoraMin >= primera * 60 && ahoraMin <= ultima * 60 && <span aria-hidden="true" className={estilos.ahora} style={{ top: y(ahoraMin) }} />}
          </div>
        ))}
      </div>
      <AgendaRato rato={rato} computador={computador} onCerrar={() => setRato(null)} />
    </>
  )
}
