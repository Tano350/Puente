import { useState } from 'react'
import { ElegirPersona } from '../../componentes/ElegirPersona.tsx'
import { Icono } from '../../componentes/Icono.tsx'
import { usePersonas, type Persona } from '../../datos/consultas.ts'
import { estaAllaEse, soloParaTema, type Evento, type ModoEvento } from '../../datos/eventos.ts'
import { momento } from '../../datos/fechas.ts'
import { integrantes } from '../../datos/grupo.ts'
import { interesadosDe, useInteresados, useTemas } from '../../datos/intereses.ts'
import { primerNombre } from '../../datos/nombres.ts'
import { useSesion } from '../../datos/sesion.tsx'
import { useTextos } from '../../textos.ts'
import estilos from './CrearQuienes.module.css'

const MODOS = ['para_todos', 'con_cupo', 'cerrado'] as const satisfies readonly ModoEvento[]
// Fichas a mano en uno cerrado (de los que están allá ese día, si ya se eligió); el resto, en "Ver los 13"
const FICHAS = 6

type Props = {
  computador: boolean
  dia: string | null
  modo: ModoEvento
  tema: string | null
  elegidos: string[]
  // El evento que se edita: «Primero para» solo va mientras sigue siendo solo para su tema
  editando?: Evento
  onModo: (modo: ModoEvento) => void
  onTema: (tema: string | null) => void
  onElegidos: (elegidos: string[]) => void
}

// Quiénes pueden ir: para todos, con cupo o cerrado (con las personas que van).
// Para todos o con cupo pueden ir primero a los de un tema; en uno cerrado se suma a los de un tema de una vez.
// Al editar no hay fichas: en uno cerrado, la gente se suma y se saca en el evento.
export function CrearQuienes({ computador, dia, modo, tema, elegidos, editando, onModo, onTema, onElegidos }: Props) {
  const textos = useTextos()
  const sesion = useSesion()
  const { data: personas } = usePersonas()
  const { data: temas } = useTemas()
  const { data: interesados } = useInteresados()
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

  // Los de un tema que se pueden agregar: integrantes de ahora, sin ti. Un tema sin nadie así no se muestra.
  const deTema = (id: string) => otros.filter((p) => interesadosDe(id, interesados ?? []).includes(p.id)).map((p) => p.id)
  const temasConGente = (temas ?? []).filter((x) => deTema(x.id).length > 0)
  const todosLosDe = (id: string) => deTema(id).every((p) => elegidos.includes(p))
  const cambiarTema = (id: string) => {
    const suyos = deTema(id)
    onElegidos(todosLosDe(id) ? elegidos.filter((x) => !suyos.includes(x)) : [...elegidos, ...suyos.filter((x) => !elegidos.includes(x))])
  }
  const primero = temas?.find((x) => x.id === tema)
  const verPrimero = modo !== 'cerrado' && (temas?.length ?? 0) > 0 && (!editando || soloParaTema(editando))

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

      {verPrimero && (
        <>
          <div id="crear-primero" className={estilos.etiqueta}>
            {t.primeroPara}
          </div>
          <div role="radiogroup" aria-labelledby="crear-primero" aria-describedby={primero ? 'crear-primero-explica' : undefined} className={estilos.fichas}>
            <button type="button" role="radio" aria-checked={tema === null} className={estilos.ficha} onClick={() => onTema(null)}>
              {t.todos}
            </button>
            {(temas ?? []).map((x) => (
              <button key={x.id} type="button" role="radio" aria-checked={tema === x.id} className={estilos.ficha} onClick={() => onTema(x.id)}>
                {x.nombre}
              </button>
            ))}
          </div>
          {primero && (
            <div id="crear-primero-explica" className={estilos.explica}>
              {t.explicaTema(primero.nombre)}
            </div>
          )}
        </>
      )}

      {modo === 'cerrado' && !editando && temasConGente.length > 0 && (
        <>
          <div id="crear-temas" className={estilos.etiqueta}>
            {t.agregarALosDe}
          </div>
          <div role="group" aria-labelledby="crear-temas" className={estilos.fichas}>
            {temasConGente.map((x) => {
              const van = todosLosDe(x.id)
              return (
                <button key={x.id} type="button" className={estilos.ficha} aria-pressed={van} onClick={() => cambiarTema(x.id)}>
                  {van && <Icono nombre="check" medida={14} trazo={2.5} />}
                  {x.nombre}
                </button>
              )
            })}
          </div>
          <div id="crear-personas" className={estilos.etiqueta}>
            {t.personasEtiqueta}
          </div>
        </>
      )}

      {modo === 'cerrado' && !editando && (
        <div role="group" aria-labelledby={temasConGente.length > 0 ? 'crear-personas' : 'crear-quienes-explica'} className={estilos.fichas}>
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
