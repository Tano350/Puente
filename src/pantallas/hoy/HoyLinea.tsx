import { Fragment } from 'react'
import { Icono } from '../../componentes/Icono.tsx'
import type { Persona } from '../../datos/consultas.ts'
import type { Contacto } from '../../datos/contactos.ts'
import { enlaceMapa, type Asistente, type NotaReunion } from '../../datos/eventos.ts'
import { CHILE, conMayuscula, diaEn, diaLargo, hora, sumarDias } from '../../datos/fechas.ts'
import { primerNombre } from '../../datos/nombres.ts'
import { useTextos, type Textos } from '../../textos.ts'
import { dondeCorto, minutosHasta, otrosQueVan, tieneNota, type EstadoParada, type Parada } from './HoyDatos.ts'
import estilos from './HoyLinea.module.css'

// Una parada de la línea, lista para mostrar
export type Estacion = {
  id: string
  estado: EstadoParada
  hora: string
  horaChile: string | null
  titulo: string
  donde: string
  // "Lunes 11 de enero" en Lo próximo, solo en la primera parada de cada día
  dia: string | null
  // Solo la próxima parada de tu día
  empieza: string | null
  con: string | null
  van: string | null
  mapa: string | null
  // "Escribir nota" en las reuniones de hoy que ya pasaron
  nota: boolean
}

// Dónde va la marca de "ahora": antes de la estación número "en"
export type MarcaAhora = { en: number; hora: string }

type Contexto = {
  textos: Textos
  durante: boolean
  chile: boolean
  ahora: number
  hoyCalifornia: string
  yo: string
  asistentes: Asistente[]
  personas: Persona[]
  contactos: Contacto[]
  notas: NotaReunion[]
}

function falta(minutos: number, t: Textos['hoy']['viaje']): string {
  return minutos < 60 ? t.minutos(minutos) : t.horas(Math.floor(minutos / 60), minutos % 60)
}

export function armarEstaciones(paradas: Parada[], c: Contexto): Estacion[] {
  const t = c.textos.hoy.viaje
  const nombre = (id: string) => {
    const persona = c.personas.find((p) => p.id === id)
    return persona ? primerNombre(persona) : null
  }
  return paradas.map(({ evento: e, estado }, i) => {
    const dia = diaEn(e.inicio)
    const diaAntes = i > 0 ? diaEn(paradas[i - 1].evento.inicio) : null
    const etiqueta = c.durante || dia === diaAntes ? null : dia === c.hoyCalifornia ? t.hoy : dia === sumarDias(c.hoyCalifornia, 1) ? t.manana : conMayuscula(diaLargo(dia))
    const proxima = c.durante && estado === 'proxima'
    const nombres = proxima ? otrosQueVan(e.id, c.asistentes, c.yo).flatMap((id) => nombre(id) ?? []) : []
    const lista = nombres.length <= 4 ? [...nombres, t.tu] : [...nombres.slice(0, 3), t.tu, t.mas(nombres.length - 3)]
    const contacto = proxima && e.contacto ? c.contactos.find((x) => x.id === e.contacto) : undefined
    const destino = e.direccion ?? e.lugar
    return {
      id: e.id,
      estado,
      hora: hora(e.inicio),
      horaChile: c.chile ? hora(e.inicio, CHILE) : null,
      titulo: e.titulo,
      donde: dondeCorto(e),
      dia: etiqueta,
      empieza: proxima ? t.empiezaEn(falta(minutosHasta(e.inicio, c.ahora), t)) : null,
      con: contacto ? t.con(contacto.nombre, contacto.organizacion) : null,
      van: nombres.length > 0 ? t.van(c.textos.y(lista)) : null,
      mapa: proxima && destino ? enlaceMapa(destino) : null,
      nota: c.durante && estado === 'pasada' && e.tipo === 'reunion' && !tieneNota(e.id, c.notas, c.yo),
    }
  })
}

type Tramo = 'apagado' | 'tinta' | null

// Lo de antes de "ahora" va apagado; sin marca (antes del viaje), todo en tinta
function tramos(i: number, total: number, ahora: MarcaAhora | null): { arriba: Tramo; abajo: Tramo } {
  const color = ahora && i < ahora.en ? 'apagado' : 'tinta'
  return {
    arriba: i === 0 && ahora?.en !== 0 ? null : color,
    abajo: i === total - 1 && ahora?.en !== total ? null : color,
  }
}

function Riel({ arriba, abajo, estado }: { arriba: Tramo; abajo: Tramo; estado: EstadoParada }) {
  return (
    <span className={estilos.riel} aria-hidden="true">
      {arriba && <span className={estilos.tramoArriba} data-color={arriba} />}
      {abajo && <span className={estilos.tramoAbajo} data-color={abajo} />}
      <span className={estilos.tuerca} data-estado={estado}>
        <span className={estilos.agujero} />
      </span>
    </span>
  )
}

function FilaAhora({ marca, total, compacta = false }: { marca: MarcaAhora; total: number; compacta?: boolean }) {
  const textos = useTextos()
  return (
    <li className={compacta ? `${estilos.ahora} ${estilos.ahoraCompacta}` : estilos.ahora}>
      <span className={estilos.ahoraHora}>{marca.hora}</span>
      <span className={estilos.riel} aria-hidden="true">
        {marca.en > 0 && <span className={estilos.mitadArriba} />}
        {marca.en < total && <span className={estilos.mitadAbajo} />}
        <span className={estilos.raya} />
      </span>
      <span className={estilos.ahoraTexto}>{textos.hoy.viaje.ahora}</span>
    </li>
  )
}

// En el celular: tu día (o lo próximo) como línea con estaciones. Tocar una abre su boleto.
export function Linea({ estaciones, ahora, grande, onAbrir, onNota }: { estaciones: Estacion[]; ahora: MarcaAhora | null; grande: boolean; onAbrir: (id: string) => void; onNota: (id: string) => void }) {
  const t = useTextos().hoy.viaje
  const total = estaciones.length
  return (
    <ol className={estilos.linea} data-grande={grande}>
      {estaciones.map((e, i) => (
        <Fragment key={e.id}>
          {ahora?.en === i && <FilaAhora marca={ahora} total={total} />}
          <li className={estilos.parada} data-estado={e.estado} data-grande={grande && e.estado === 'proxima'}>
            <span className={estilos.horas}>
              <span className={estilos.hora}>{e.hora}</span>
              {e.horaChile && <span className={estilos.chile}>{e.horaChile}</span>}
            </span>
            <Riel {...tramos(i, total, ahora)} estado={e.estado} />
            <span className={estilos.datos}>
              {e.dia && <span className={estilos.dia}>{e.dia}</span>}
              <button type="button" className={estilos.titulo} onClick={() => onAbrir(e.id)}>
                {e.titulo}
              </button>
              {e.empieza && <span className={estilos.empieza}>{e.empieza}</span>}
              {e.donde && <span className={estilos.donde}>{e.donde}</span>}
              {e.con && <span className={estilos.quienes}>{e.con}</span>}
              {e.van && <span className={estilos.quienes}>{e.van}</span>}
              {e.mapa && (
                <a className={estilos.mapa} href={e.mapa} target="_blank" rel="noopener noreferrer">
                  {t.comoLlegar}
                </a>
              )}
              {e.nota && (
                <button type="button" className={estilos.nota} onClick={() => onNota(e.id)}>
                  <Icono nombre="lapiz" medida={18} />
                  {t.escribirNota}
                </button>
              )}
            </span>
          </li>
        </Fragment>
      ))}
      {ahora?.en === total && total > 0 && <FilaAhora marca={ahora} total={total} />}
    </ol>
  )
}

// En el computador: las mismas paradas en una lista corta; la elegida muestra su boleto al lado
export function Paradas({ estaciones, ahora, elegida, onElegir }: { estaciones: Estacion[]; ahora: MarcaAhora | null; elegida: string | null; onElegir: (id: string) => void }) {
  const total = estaciones.length
  return (
    <ol className={estilos.linea}>
      {estaciones.map((e, i) => (
        <Fragment key={e.id}>
          {ahora?.en === i && <FilaAhora marca={ahora} total={total} compacta />}
          <li>
            <button type="button" className={estilos.fila} data-estado={e.estado} aria-pressed={elegida === e.id} onClick={() => onElegir(e.id)}>
              <span className={estilos.horas}>
                <span className={estilos.hora}>{e.hora}</span>
                {e.horaChile && <span className={estilos.chile}>{e.horaChile}</span>}
              </span>
              <Riel {...tramos(i, total, ahora)} estado={e.estado} />
              <span className={estilos.datos}>
                {e.dia && <span className={estilos.dia}>{e.dia}</span>}
                <span className={estilos.nombre}>{e.titulo}</span>
                {e.donde && <span className={estilos.donde}>{e.donde}</span>}
              </span>
            </button>
          </li>
        </Fragment>
      ))}
      {ahora?.en === total && total > 0 && <FilaAhora marca={ahora} total={total} compacta />}
    </ol>
  )
}
