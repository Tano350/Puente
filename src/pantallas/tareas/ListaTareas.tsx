import { useEffect, useRef, useState, type PointerEvent as EventoPuntero } from 'react'
import { Icono } from '../../componentes/Icono.tsx'
import { useConectado } from '../../datos/conexion.ts'
import { usePersonas } from '../../datos/consultas.ts'
import { atrasada, type EstadoTarea } from '../../datos/estadoTareas.ts'
import { hoyEnCalifornia } from '../../datos/fechas.ts'
import { primerNombre } from '../../datos/nombres.ts'
import { ErrorDeTarea, marcarTarea, soltarTarea, tomarTarea, useAsignados, useTareas, useTareasSinSubir, type Tarea } from '../../datos/tareas.ts'
import { chispasDesde, deslizoLoSuficiente, empujon, Numero, sacudir, seguir, sonar, useFlip, Valor, vibrar } from '../../movimiento/index.ts'
import { useTextos } from '../../textos.ts'
import { nombresDe, partesDeFecha, quien } from './comun.ts'
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
  // Las filas que cambian de lugar (a Hechas, por ejemplo) se deslizan hasta el nuevo
  const raiz = useRef<HTMLDivElement>(null)
  useFlip(raiz)

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
    // Por qué una tarea que no es tuya no se marca al deslizarla
    const porQue = () => {
      if (estado.modo === 'sin') return tl.primeroTomala
      if (estado.modo !== 'uno' || estado.personas.length === 0) return t.motivos.no_asignado
      return tl.soloPuedeMarcar(textos.o(nombresDe(estado.personas, personas, yo, textos)))
    }
    return (
      <FilaTarea
        key={tarea.id}
        tarea={tarea}
        estado={estado}
        hecha={hecha}
        elegida={elegida === tarea.id}
        quedando={quedan.has(tarea.id)}
        atrasada={atrasada(tarea, estado, hoy)}
        hoy={hoy}
        quien={quien(estado, personas, yo, textos)}
        sinSubir={sinSubir.has(tarea.id)}
        conectado={conectado}
        porQue={porQue}
        onAbrir={onAbrir}
        marcar={marcar}
        tomar={tomar}
        avisar={avisar}
      />
    )
  }

  return (
    <div ref={raiz} className={estilos.lista}>
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
            <Numero valor={orden.hechas.length} formato={(n) => t.hechas(Math.round(n))} />
          </button>
          {abiertas && <ul className={estilos.filas}>{orden.hechas.map((tarea) => fila(tarea, true))}</ul>}
        </section>
      )}
    </div>
  )
}

type PropsFila = {
  tarea: Tarea
  estado: EstadoTarea
  hecha: boolean
  elegida: boolean
  quedando: boolean
  atrasada: boolean
  hoy: string
  quien: string
  sinSubir: boolean
  conectado: boolean
  // El aviso de por qué no se puede marcar
  porQue: () => string
  onAbrir: (tarea: Tarea) => void
  marcar: (tarea: Tarea, estado: EstadoTarea, hecha: boolean) => Promise<void>
  tomar: (tarea: Tarea) => Promise<void>
  avisar: (texto: string) => void
}

// El festejo de marcar: salto, tuercas, sonido y vibración
function festejar(casilla: HTMLElement | null) {
  empujon(casilla, { s: 1.4 })
  chispasDesde(casilla, { cantidad: 0.6 })
  sonar('exito')
  vibrar([10, 30, 16])
}

// Una fila de la lista. Deslizarla a la derecha la marca (si es tuya) o explica por qué no se puede.
function FilaTarea({ tarea, estado, hecha, elegida, quedando, atrasada: tarde, hoy, quien: quienTexto, sinSubir, conectado, porQue, onAbrir, marcar, tomar, avisar }: PropsFila) {
  const textos = useTextos()
  const t = textos.tareas.comun
  const tl = textos.tareas.lista
  const fecha = tarea.para ? partesDeFecha(tarea.para) : null
  const marcada = estado.mia && estado.miParteHecha
  const li = useRef<HTMLLIElement>(null)
  const frente = useRef<HTMLDivElement>(null)
  const banda = useRef<HTMLSpanElement>(null)
  const bandaCheck = useRef<HTMLSpanElement>(null)
  const casilla = useRef<HTMLButtonElement>(null)
  const tomarBoton = useRef<HTMLButtonElement>(null)
  const meta = useRef<HTMLSpanElement>(null)
  // Si la fila no se puede marcar, se resiste y la banda no aparece
  const resiste = useRef(false)
  const x = useRef<Valor | null>(null)
  if (!x.current) {
    x.current = new Valor(0, (v) => {
      if (frente.current) frente.current.style.translate = Math.abs(v) < 0.01 ? '' : `${v.toFixed(2)}px`
      const b = banda.current
      if (!b) return
      b.style.setProperty('--dx', `${Math.max(0, v).toFixed(2)}px`)
      b.style.opacity = resiste.current ? '0' : String(Math.min(1, Math.max(0, v / 70)))
    })
  }

  // Al tomarla (o soltarla), lo que aparece o cambia salta
  const eraMia = useRef(estado.mia)
  useEffect(() => {
    if (eraMia.current === estado.mia) return
    eraMia.current = estado.mia
    empujon(casilla.current ?? tomarBoton.current, { s: 1.2 })
    empujon(meta.current, { s: 0.6 })
  }, [estado.mia])

  const deslizar = (e: EventoPuntero<HTMLLIElement>) => {
    const valor = x.current
    if (!valor || !(e.target instanceof Element) || e.target.closest(`.${estilos.casilla}, .${estilos.tomar}`)) return
    // Lo que ya está hecho no tiene qué marcar ni qué explicar
    if (marcada || (hecha && !estado.mia)) return
    resiste.current = !estado.mia
    let paso = false
    seguir(e, {
      eje: 'x',
      sentido: 1,
      alMover: (p) => {
        const dx = Math.max(0, p.dx)
        valor.fijar(resiste.current ? dx * 0.16 : dx)
        const pasa = !resiste.current && deslizoLoSuficiente(dx, li.current?.offsetWidth ?? 300, 0)
        if (pasa && !paso) {
          empujon(bandaCheck.current, { s: 1.4 })
          sonar('tick')
          vibrar(6)
        }
        paso = pasa
      },
      alSoltar: (p, cancelado) => {
        const ancho = li.current?.offsetWidth ?? 300
        valor.ir(0)
        if (cancelado) return
        if (resiste.current) {
          if (p.dx < 24) return
          sacudir(li.current)
          avisar(porQue())
        } else if (deslizoLoSuficiente(p.dx, ancho, p.vx)) {
          festejar(casilla.current)
          void marcar(tarea, estado, true)
        }
      },
    })
  }

  return (
    <li ref={li} className={estilos.fila} data-flip={tarea.id} data-elegida={elegida} data-hecha={hecha} data-arrastrable onPointerDown={deslizar}>
      <span ref={banda} className={estilos.banda} aria-hidden="true">
        <span ref={bandaCheck} className={estilos.bandaCheck}>
          <Icono nombre="check" medida={22} trazo={3} />
        </span>
        {tl.hecha}
      </span>
      <div ref={frente} className={estilos.frente}>
        <button type="button" className={estilos.abrir} onClick={() => onAbrir(tarea)}>
          <span className={estilos.fecha} data-atrasada={tarde}>
            {fecha && (
              <>
                <small>{fecha.semana}</small>
                <b>{fecha.dia}</b>
                {tarea.para!.slice(0, 7) !== hoy.slice(0, 7) && <em>{fecha.mes}</em>}
              </>
            )}
          </span>
          <span className={estilos.texto}>
            <span className={estilos.titulo} data-tachada={hecha || (marcada && quedando)}>
              {tarea.titulo}
            </span>
            <span ref={meta} className={estilos.meta}>
              {estado.modo === 'personal' && <Icono nombre="candado" medida={14} trazo={2} />}
              {quienTexto}
              {sinSubir && (
                <span className={estilos.sinSubir}>
                  <Icono nombre="sinSubir" medida={14} trazo={2} />
                  {t.sinSubir}
                </span>
              )}
            </span>
          </span>
        </button>
        {estado.mia ? (
          <button
            ref={casilla}
            type="button"
            role="checkbox"
            aria-checked={marcada}
            aria-label={tarea.titulo}
            className={estilos.casilla}
            onClick={(e) => {
              if (marcada) empujon(e.currentTarget, { s: 0.6 })
              else festejar(e.currentTarget)
              void marcar(tarea, estado, !marcada)
            }}
          >
            <Icono nombre="check" medida={18} trazo={3} />
          </button>
        ) : estado.modo === 'sin' ? (
          <button ref={tomarBoton} type="button" className={estilos.tomar} aria-disabled={!conectado} onClick={() => void tomar(tarea)}>
            {tl.meLaTomo}
          </button>
        ) : null}
      </div>
    </li>
  )
}
