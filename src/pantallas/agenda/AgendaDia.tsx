import { useState } from 'react'
import { Icono } from '../../componentes/Icono.tsx'
import type { Evento, Ocupado } from '../../datos/eventos.ts'
import { CHILE, conMayuscula, hora } from '../../datos/fechas.ts'
import { useTextos } from '../../textos.ts'
import { ciudad, lugarYCiudad, type Pieza, type PiezaEvento } from './AgendaDatos.ts'
import { AgendaRato } from './AgendaRato.tsx'
import estilos from './AgendaDia.module.css'

type Props = {
  dia: string
  piezas: Pieza[]
  computador: boolean
  chile: boolean
  hoy: string
  ahora: string
  soloVoy: boolean
  nombres: Map<string, string>
  elegido?: string
  pendiente?: string | null
  onAbrir: (evento: Evento) => void
  onIr?: (pieza: PiezaEvento) => void
}

// Asientos chicos: los tomados llenos y los libres huecos (solo si caben)
function Asientos({ tomados, total }: { tomados: number; total: number }) {
  if (total > 12) return null
  return (
    <span aria-hidden="true" className={estilos.asientos}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={estilos.asiento} data-libre={i >= tomados} />
      ))}
    </span>
  )
}

// El día como línea de estaciones, igual que Hoy: lo que pasó en gris, "ahora" y lo que sigue.
// Un evento se abre en su boleto; un rato ocupado, en su hoja.
export function AgendaDia({ dia, piezas, computador, chile, hoy, ahora, soloVoy, nombres, elegido, pendiente, onAbrir, onIr }: Props) {
  const textos = useTextos()
  const tv = textos.agenda.vista
  const [rato, setRato] = useState<Ocupado | null>(null)
  // La hoja va también con el día vacío: así queda el aviso al borrar lo último del día
  const hoja = <AgendaRato rato={rato} computador={computador} onCerrar={() => setRato(null)} />
  if (piezas.length === 0)
    return (
      <>
        <p className={computador ? estilos.vacioPc : estilos.vacio}>{soloVoy ? tv.noVasNada : tv.libre}</p>
        {hoja}
      </>
    )

  const ahoraMs = Date.parse(ahora)
  // "ahora" va después de lo que ya empezó; solo hoy
  const corte = piezas.filter((p) => Date.parse(p.inicio) <= ahoraMs).length
  const conAhora = dia === hoy
  const tramo = (k: number, arriba: boolean) => {
    const hayAlgo = arriba ? k > 0 || (conAhora && corte === 0) : k < piezas.length - 1 || (conAhora && corte === piezas.length)
    if (!hayAlgo) return 'no'
    return k < corte ? 'gris' : 'tinta'
  }
  const quienes = (ids: string[]) => {
    const van = ids.map((id) => nombres.get(id)).filter((n): n is string => Boolean(n))
    return textos.y(van.length > 3 ? [...van.slice(0, 2), tv.yMas(van.length - 2)] : van)
  }

  const lugar = (p: Pieza) => {
    const hasta = tv.hasta(hora(p.fin))
    if (computador) return (p.tipo === 'evento' && lugarYCiudad(p.evento)) || conMayuscula(hasta)
    const donde = p.tipo === 'evento' ? (ciudad(p.evento.direccion) ?? p.evento.lugar) : null
    return donde ? `${donde}, ${hasta}` : conMayuscula(hasta)
  }

  // Celular: el estado a la derecha; "Tomar cupo" y "Voy" se hacen ahí mismo
  const derecha = (p: Pieza) => {
    if (p.tipo === 'ocupado') return <span className={estilos.estado}>{tv.ocupado}</span>
    if (p.pasada || p.estado === 'cerrada') return null
    if (p.estado === 'vas')
      return (
        <span className={estilos.vas}>
          <Icono nombre="check" medida={16} trazo={2.5} />
          {tv.estados.vas}
        </span>
      )
    if (p.estado === 'tomar' || p.estado === 'voy') {
      const texto = tv.estados[p.estado]
      return (
        <button
          type="button"
          className={estilos.accion}
          aria-label={`${texto}: ${p.titulo}`}
          aria-disabled={Boolean(pendiente)}
          onClick={() => {
            if (!pendiente) onIr?.(p)
          }}
        >
          {texto}
        </button>
      )
    }
    return <span className={estilos.estado}>{tv.estados[p.estado]}</span>
  }
  const extra = (p: Pieza) => {
    if (p.tipo === 'ocupado' || p.pasada) return null
    if (p.estado === 'cerrada')
      return (
        <>
          <Icono nombre="candado" medida={15} trazo={2} />
          {p.van.length > 0 ? tv.cerrada(quienes(p.van), p.van.length > 1) : tv.estados.cerrada}
        </>
      )
    if (p.estado === 'tomar' && p.evento.cupos !== null)
      return (
        <>
          <Asientos tomados={p.van.length} total={p.evento.cupos} />
          {tv.cupos(p.van.length, p.evento.cupos)}
        </>
      )
    if (p.estado === 'voy')
      return (
        <>
          <Icono nombre="grupo" medida={15} trazo={2} />
          {tv.paraTodos(p.van.length)}
        </>
      )
    return null
  }

  // Computador: toda la fila elige el evento (o abre el rato) y el estado va como texto
  const chip = (p: Pieza) => {
    const texto = p.tipo === 'ocupado' ? tv.ocupado : tv.estados[p.estado]
    const tipo = p.tipo === 'evento' && p.estado === 'vas' ? 'vas' : p.tipo === 'evento' && (p.estado === 'tomar' || p.estado === 'voy') ? 'accion' : 'apagado'
    return (
      <span className={estilos.chip} data-tipo={tipo}>
        {tipo === 'vas' && <Icono nombre="check" medida={16} trazo={2.5} />}
        {texto}
      </span>
    )
  }

  const tuerca = (p: Pieza) => (p.tipo === 'evento' && p.proxima ? 'proxima' : p.pasada ? 'pasada' : p.tipo === 'ocupado' || p.mio ? 'mia' : 'ajena')
  const abrir = (p: Pieza) => (p.tipo === 'evento' ? onAbrir(p.evento) : setRato(p.ocupado))
  const aria = (p: Pieza) => (p.tipo === 'ocupado' ? { 'aria-label': textos.agenda.rato.ocupadoDe(p.titulo, hora(p.inicio), hora(p.fin)), 'aria-haspopup': 'dialog' as const } : {})

  const filas = piezas.map((p, k) => {
    const via = (
      <span className={estilos.via} aria-hidden="true">
        <span className={estilos.arriba} data-tramo={tramo(k, true)} />
        <span className={estilos.abajo} data-tramo={tramo(k, false)} />
        <span className={estilos.tuerca}>
          <span className={estilos.hueco} />
        </span>
      </span>
    )
    const horas = (
      <span className={estilos.hora}>
        <span className={estilos.horaGrande}>{hora(p.inicio)}</span>
        {chile && <span className={estilos.horaChile}>{hora(p.inicio, CHILE)}</span>}
      </span>
    )
    const comun = { 'data-tuerca': tuerca(p), 'data-pasada': p.pasada }

    if (computador) {
      const contenido = (
        <>
          {horas}
          {via}
          <span className={estilos.texto}>
            <span className={estilos.nombre}>{p.titulo}</span>
            <span className={estilos.lugar}>{lugar(p)}</span>
          </span>
          {chip(p)}
        </>
      )
      return (
        <li key={p.id}>
          <button type="button" className={estilos.filaPc} aria-pressed={p.tipo === 'evento' ? elegido === p.id : undefined} onClick={() => abrir(p)} {...aria(p)} {...comun}>
            {contenido}
          </button>
        </li>
      )
    }

    const debajo = extra(p)
    return (
      <li key={p.id} className={estilos.fila} {...comun}>
        {horas}
        {via}
        <div className={estilos.texto}>
          <div className={estilos.renglon}>
            <button type="button" className={estilos.nombre} onClick={() => abrir(p)} {...aria(p)}>
              {p.titulo}
            </button>
            {derecha(p)}
          </div>
          {!p.pasada && <div className={estilos.lugar}>{lugar(p)}</div>}
          {debajo && <div className={estilos.extra}>{debajo}</div>}
        </div>
      </li>
    )
  })

  if (conAhora)
    filas.splice(
      corte,
      0,
      <li key="ahora" className={estilos.ahora}>
        <span className={estilos.ahoraHora}>{hora(ahora)}</span>
        <span className={estilos.ahoraVia} aria-hidden="true">
          {corte > 0 && <span className={estilos.mitadArriba} />}
          {corte < piezas.length && <span className={estilos.mitadAbajo} />}
          <span className={estilos.raya} />
        </span>
        <span className={estilos.ahoraTexto}>{tv.ahora}</span>
      </li>,
    )

  return (
    <>
      <ol className={computador ? estilos.listaPc : estilos.lista}>{filas}</ol>
      {hoja}
    </>
  )
}
