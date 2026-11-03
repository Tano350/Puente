import { useState } from 'react'
import { ElegirPersona } from '../../componentes/ElegirPersona.tsx'
import { Icono } from '../../componentes/Icono.tsx'
import { usePersonas, type Persona } from '../../datos/consultas.ts'
import { estaAllaEse, type ModoEvento } from '../../datos/eventos.ts'
import { momento } from '../../datos/fechas.ts'
import { integrantes } from '../../datos/grupo.ts'
import { primerNombre } from '../../datos/nombres.ts'
import { useSesion } from '../../datos/sesion.tsx'
import { useTextos } from '../../textos.ts'
import estilos from './CrearQuienes.module.css'

const MODOS = ['para_todos', 'con_cupo', 'cerrado'] as const satisfies readonly ModoEvento[]
// Fichas a mano en uno cerrado (de los que están allá ese día, si ya se eligió); el resto, en "Ver los 13"
const FICHAS = 6

type Props = { computador: boolean; dia: string | null; modo: ModoEvento; elegidos: string[]; editando?: boolean; onModo: (modo: ModoEvento) => void; onElegidos: (elegidos: string[]) => void }

// Quiénes pueden ir: para todos, con cupo o cerrado (con las personas que van).
// Al editar no hay fichas: en uno cerrado, la gente se suma y se saca en el evento.
export function CrearQuienes({ computador, dia, modo, elegidos, editando = false, onModo, onElegidos }: Props) {
  const textos = useTextos()
  const sesion = useSesion()
  const { data: personas } = usePersonas()
  const [eligiendo, setEligiendo] = useState(false)
  // Los que se agregaron desde la lista siguen a la vista aunque se desmarquen
  const [agregados, setAgregados] = useState<string[]>([])
  if (sesion.tipo !== 'dentro') return null
  const yo = sesion.persona
  const t = textos.agenda.crear

  // Quien crea el evento siempre va: se elige entre los demás
  const otros = integrantes(personas ?? [], yo.id).filter((p) => p.id !== yo.id)
  const alla = dia ? otros.filter((p) => estaAllaEse(p, momento(dia, '12:00'))) : otros
  const fichas = otros.filter((p) => alla.slice(0, FICHAS).includes(p) || elegidos.includes(p.id) || agregados.includes(p.id))
  // Con dos del mismo nombre, va también la inicial del apellido
  const nombres = otros.map((p) => primerNombre(p))
  const nombreDe = (p: Persona) => {
    const nombre = primerNombre(p)
    const apellido = p.nombre?.trim().split(/\s+/).slice(1).pop()
    return apellido && nombres.indexOf(nombre) !== nombres.lastIndexOf(nombre) ? `${nombre} ${apellido[0]}.` : nombre
  }
  const cambiar = (id: string) => onElegidos(elegidos.includes(id) ? elegidos.filter((x) => x !== id) : [...elegidos, id])

  return (
    <div data-computador={computador}>
      <div id="crear-quienes" className={estilos.etiqueta}>
        {t.quienes}
      </div>
      <div role="radiogroup" aria-labelledby="crear-quienes" aria-describedby="crear-quienes-explica" className={estilos.modos}>
        {MODOS.map((m) => (
          <label key={m} className={estilos.modo}>
            <input type="radio" name="crear-modo" value={m} checked={modo === m} className={estilos.radio} onChange={() => onModo(m)} />
            {t.modos[m]}
          </label>
        ))}
      </div>
      <div id="crear-quienes-explica" className={estilos.explica}>
        {editando && modo === 'cerrado' ? textos.agenda.editar.cerrado : t.explicaModo[modo]}
      </div>

      {modo === 'cerrado' && !editando && (
        <div role="group" aria-labelledby="crear-quienes-explica" className={estilos.fichas}>
          {fichas.map((p) => {
            const va = elegidos.includes(p.id)
            return (
              <button key={p.id} type="button" className={estilos.ficha} aria-pressed={va} onClick={() => cambiar(p.id)}>
                {va && <Icono nombre="check" medida={14} trazo={2.5} />}
                {nombreDe(p)}
              </button>
            )
          })}
          {otros.length > 0 && (
            <button type="button" className={estilos.verTodos} onClick={() => setEligiendo(true)}>
              {t.verLos(otros.length)}
            </button>
          )}
        </div>
      )}

      <ElegirPersona
        abierta={eligiendo}
        titulo={t.agregarPersona}
        onElegir={(persona) => {
          if (persona.id !== yo.id) {
            if (!elegidos.includes(persona.id)) onElegidos([...elegidos, persona.id])
            setAgregados((lista) => (lista.includes(persona.id) ? lista : [...lista, persona.id]))
          }
          setEligiendo(false)
        }}
        onCerrar={() => setEligiendo(false)}
      />
    </div>
  )
}
