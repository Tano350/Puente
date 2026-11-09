import { useState } from 'react'
import { Icono } from '../../componentes/Icono.tsx'
import { useConectado } from '../../datos/conexion.ts'
import { usePersonas } from '../../datos/consultas.ts'
import { atrasada, type EstadoTarea } from '../../datos/estadoTareas.ts'
import { hoyEnCalifornia } from '../../datos/fechas.ts'
import { primerNombre } from '../../datos/nombres.ts'
import { ErrorDeTarea, marcarTarea, soltarTarea, tomarTarea, useAsignados, useTareas, useTareasSinSubir, type Tarea } from '../../datos/tareas.ts'
import { useTextos } from '../../textos.ts'
import { partesDeFecha, quien } from './comun.ts'
import { ordenarLista } from './ordenLista.ts'
import estilos from './ListaTareas.module.css'

type Props = {
  tareas: readonly Tarea[]
  estados: ReadonlyMap<string, EstadoTarea>
  yo: string
  mias: boolean
  // La tarea elegida en el computador
  elegida?: string
  onAbrir: (tarea: Tarea) => void
  avisar: (texto: string, deshacer?: () => void) => void
  cerrarAviso: () => void
}

// La lista "Por fecha": grupos de fechas y, al final, las hechas plegadas. Sirve al celular y al computador.
export function ListaTareas({ tareas, estados, yo, mias, elegida, onAbrir, avisar, cerrarAviso }: Props) {
  const textos = useTextos()
  const t = textos.tareas.comun
  const tl = textos.tareas.lista
  const conectado = useConectado()
  const { data: personas } = usePersonas()
  const consultaTareas = useTareas()
  const consultaAsignados = useAsignados()
  const sinSubir = useTareasSinSubir()
  const hoy = hoyEnCalifornia()
  const [verHechas, setVerHechas] = useState(false)
  // Las que acabas de marcar siguen en su lugar y tachadas un momento antes de pasar a Hechas
  const [quedan, setQuedan] = useState<ReadonlySet<string>>(new Set())
  const orden = ordenarLista(tareas, estados, mias, hoy, quedan)
  const abiertas = orden.grupos.length === 0 || verHechas

  const dejarQuedar = (id: string, si: boolean) =>
    setQuedan((antes) => {
      const ahora = new Set(antes)
      if (si) ahora.add(id)
      else ahora.delete(id)
      return ahora
    })

  const error = (e: unknown) => {
    if (!(e instanceof ErrorDeTarea) || e.motivo === 'otro') return avisar(textos.noSeGuardo)
    avisar(e.motivo === 'tomada' ? t.motivos.tomada(null) : t.motivos[e.motivo])
  }

  // Marca o desmarca; "Deshacer" hace lo contrario
  const marcar = async (tarea: Tarea, estado: EstadoTarea, hecha: boolean, conAviso = true) => {
    if (hecha) {
      dejarQuedar(tarea.id, true)
      window.setTimeout(() => dejarQuedar(tarea.id, false), 2500)
    } else dejarQuedar(tarea.id, false)
    try {
      await marcarTarea(tarea.id, hecha)
    } catch (e) {
      dejarQuedar(tarea.id, false)
      error(e)
      return
    }
    if (!conAviso) {
      cerrarAviso()
      return
    }
    const texto = hecha ? (estado.modo === 'cada' ? tl.marcasteTuya : tl.marcaste(tarea.titulo)) : tl.desmarcaste(tarea.titulo)
    avisar(texto, () => void marcar(tarea, estado, !hecha, false))
  }

  const tomar = async (tarea: Tarea) => {
    if (!conectado) {
      avisar(tl.sinRedTomar)
      return
    }
    try {
      await tomarTarea(tarea.id)
      avisar(tl.tomaste(tarea.titulo), () => void soltarTarea(tarea.id).then(cerrarAviso, error))
    } catch (e) {
      if (e instanceof ErrorDeTarea && e.motivo === 'tomada') {
        const [, filas] = await Promise.all([consultaTareas.refetch(), consultaAsignados.refetch()])
        const otro = filas.data?.find((a) => a.tarea === tarea.id)
        const persona = otro && personas?.find((p) => p.id === otro.persona)
        avisar(t.motivos.tomada(persona ? primerNombre(persona) : null))
      } else error(e)
    }
  }

  const fila = (tarea: Tarea, hecha: boolean) => {
    const estado = estados.get(tarea.id)
    if (!estado) return null
    const fecha = tarea.para ? partesDeFecha(tarea.para) : null
    const marcada = estado.mia && estado.miParteHecha
    return (
      <li key={tarea.id} className={estilos.fila} data-elegida={elegida === tarea.id} data-hecha={hecha}>
        <button type="button" className={estilos.abrir} onClick={() => onAbrir(tarea)}>
          <span className={estilos.fecha} data-atrasada={atrasada(tarea, estado, hoy)}>
            {fecha && (
              <>
                <small>{fecha.semana}</small>
                <b>{fecha.dia}</b>
                {tarea.para!.slice(0, 7) !== hoy.slice(0, 7) && <em>{fecha.mes}</em>}
              </>
            )}
          </span>
          <span className={estilos.texto}>
            <span className={estilos.titulo} data-tachada={hecha || (marcada && quedan.has(tarea.id))}>
              {tarea.titulo}
            </span>
            <span className={estilos.meta}>
              {estado.modo === 'personal' && <Icono nombre="candado" medida={14} trazo={2} />}
              {quien(estado, personas, yo, textos)}
              {sinSubir.has(tarea.id) && (
                <span className={estilos.sinSubir}>
                  <Icono nombre="sinSubir" medida={14} trazo={2} />
                  {t.sinSubir}
                </span>
              )}
            </span>
          </span>
        </button>
        {estado.mia ? (
          <button type="button" role="checkbox" aria-checked={marcada} aria-label={tarea.titulo} className={estilos.casilla} onClick={() => void marcar(tarea, estado, !marcada)}>
            <Icono nombre="check" medida={18} trazo={3} />
          </button>
        ) : estado.modo === 'sin' ? (
          <button type="button" className={estilos.tomar} aria-disabled={!conectado} onClick={() => void tomar(tarea)}>
            {tl.meLaTomo}
          </button>
        ) : null}
      </li>
    )
  }

  return (
    <div className={estilos.lista}>
      {orden.grupos.map((g) => (
        <section key={g.grupo}>
          <h2 className={estilos.grupo}>{t.grupos[g.grupo]}</h2>
          <ul className={estilos.filas}>{g.lista.map((tarea) => fila(tarea, false))}</ul>
        </section>
      ))}
      {orden.hechas.length > 0 && (
        <section className={estilos.hechas}>
          <button type="button" className={estilos.plegar} aria-expanded={abiertas} onClick={() => setVerHechas(!abiertas)}>
            <span className={estilos.flecha} data-abierta={abiertas}>
              <Icono nombre="derecha" medida={18} trazo={2} />
            </span>
            {t.hechas(orden.hechas.length)}
          </button>
          {abiertas && <ul className={estilos.filas}>{orden.hechas.map((tarea) => fila(tarea, true))}</ul>}
        </section>
      )}
    </div>
  )
}
