import { Link } from 'react-router'
import { Icono } from '../../componentes/Icono.tsx'
import type { Contacto } from '../../datos/contactos.ts'
import type { Asistente, Evento } from '../../datos/eventos.ts'
import { useTextos } from '../../textos.ts'
import estilos from './EventoQuienes.module.css'

// Los cupos como asientos de un vagón: primero los de los demás, después el tuyo (en acento) y los libres
function Vagon({ total, otros, tuyo }: { total: number; otros: number; tuyo: boolean }) {
  const columnas = Math.min(Math.ceil(total / 2), 7)
  return (
    <span className={estilos.vagon} aria-hidden="true">
      <span className={estilos.asientos} style={{ width: columnas * 28 }}>
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={estilos.asiento} data-asiento={i < otros ? 'ocupado' : i === otros && tuyo ? 'tuyo' : 'libre'} />
        ))}
      </span>
    </span>
  )
}

type Props = {
  evento: Evento
  pasado: boolean
  van: Asistente[]
  espera: Asistente[]
  yo: string
  nombreDe: (persona: string) => string
  contacto?: Contacto
  computador: boolean
  puedeCambiar: boolean
  cambiando: boolean
  ocupado: boolean
  onCambiando: (cambiando: boolean) => void
  onAgregar: () => void
  onSacar: (persona: string) => void
}

// Quiénes van: el contacto de la reunión, los cupos, quiénes van y quiénes esperan.
// Quien organiza (o administra) puede sumar o sacar gente.
export function EventoQuienes({ evento, pasado, van, espera, yo, nombreDe, contacto, computador, puedeCambiar, cambiando, ocupado, onCambiando, onAgregar, onSacar }: Props) {
  const textos = useTextos()
  const t = textos.agenda.evento
  // Hasta cuatro nombres; con más, tres y "N más"
  const lista = (personas: string[]) => {
    const nombres = personas.map(nombreDe).filter(Boolean)
    return textos.y(nombres.length > 4 ? [...nombres.slice(0, 3), t.mas(nombres.length - 3)] : nombres)
  }
  const ids = (asistentes: Asistente[]) => asistentes.map((a) => a.persona)
  const otros = van.filter((a) => a.persona !== yo).map((a) => a.persona)
  const voy = otros.length < van.length

  let quienes: string | null
  if (pasado) quienes = voy ? (otros.length ? t.fuisteCon(lista(otros)) : null) : van.length ? t.fueron(lista(ids(van)), van.length) : null
  else if (voy) quienes = otros.length ? t.vasCon(lista(otros)) : t.soloTu
  else quienes = van.length ? t.vanLista(lista(ids(van)), van.length) : t.nadie
  // Mientras no llegan los nombres, no se arma la frase a medias
  if (van.length && !lista(ids(van))) quienes = null
  const esperan = !pasado && espera.length && lista(ids(espera)) ? t.esperan(lista(ids(espera))) : null

  const cupos = evento.modo === 'con_cupo' && !pasado ? (evento.cupos ?? van.length) : null
  let cuposTexto = ''
  if (cupos !== null) cuposTexto = voy || van.length < cupos ? t.cupos(van.length, cupos) : t.llenoEspera(espera.length)
  const modo = pasado ? null : evento.modo === 'para_todos' ? 'todos' : evento.modo === 'cerrado' ? 'cerrada' : null
  const cambia = puedeCambiar && !pasado

  if (!contacto && cupos === null && !modo && !quienes && !esperan && !cambia) return null
  return (
    <div className={estilos.quienes} data-pc={computador}>
      {contacto && (
        <Link className={estilos.contacto} to={`/contactos/${contacto.id}`}>
          {t.con(contacto.nombre, contacto.organizacion)}
          <Icono nombre="derecha" medida={16} trazo={2} />
        </Link>
      )}
      {cupos !== null && (
        <div className={estilos.cupos}>
          <Vagon total={Math.max(cupos, van.length)} otros={otros.length} tuyo={voy} />
          <span className={estilos.cuposTexto}>{cuposTexto}</span>
        </div>
      )}
      {modo && (
        <div className={estilos.modo}>
          <Icono nombre={modo === 'todos' ? 'grupo' : 'candado'} medida={18} trazo={2} />
          {modo === 'todos' ? t.paraTodos : t.cerrada}
        </div>
      )}
      {cambiando && cambia ? (
        <div className={estilos.chips}>
          {van.map((a) =>
            a.persona === yo ? (
              <span key={a.persona} className={estilos.chip}>
                <span className={estilos.pastilla} data-tu="true">
                  {t.tu}
                </span>
              </span>
            ) : (
              <button key={a.persona} type="button" className={estilos.chip} aria-label={t.sacarA(nombreDe(a.persona))} aria-disabled={ocupado} onClick={() => !ocupado && onSacar(a.persona)}>
                <span className={estilos.pastilla}>
                  {nombreDe(a.persona)}
                  <Icono nombre="cerrar" medida={14} trazo={2.25} />
                </span>
              </button>
            ),
          )}
          <button type="button" className={estilos.chip} aria-haspopup="dialog" onClick={onAgregar}>
            <span className={estilos.pastilla} data-agregar="true">
              <Icono nombre="mas" medida={14} trazo={2.25} />
              {t.agregar}
            </span>
          </button>
        </div>
      ) : (
        quienes && <p className={estilos.linea}>{quienes}</p>
      )}
      {esperan && <p className={estilos.espera}>{esperan}</p>}
      {cambia && (
        <button type="button" className={estilos.cambiar} aria-expanded={cambiando} onClick={() => onCambiando(!cambiando)}>
          <Icono nombre={cambiando ? 'check' : 'lapiz'} medida={16} trazo={2} />
          {cambiando ? t.listo : t.cambiarQuienes}
        </button>
      )}
    </div>
  )
}
