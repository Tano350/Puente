import { useRef, useState } from 'react'
import { Atras, Aviso, BotonBorde, BotonPrincipal } from '../../componentes/Controles.tsx'
import { Icono } from '../../componentes/Icono.tsx'
import { PantallaConPie } from '../../componentes/Paneles.tsx'
import { SinConexion } from '../../componentes/SinConexion.tsx'
import { useAviso } from '../../componentes/useAviso.ts'
import { useConectado } from '../../datos/conexion.ts'
import { usePersonas } from '../../datos/consultas.ts'
import { atrasada } from '../../datos/estadoTareas.ts'
import { diaEn, diaLargo, hoyEnCalifornia } from '../../datos/fechas.ts'
import { primerNombre } from '../../datos/nombres.ts'
import { useSesion } from '../../datos/sesion.tsx'
import { borrarTarea, ErrorDeTarea, marcarTarea, puedeCambiarTarea, soltarTarea, tomarTarea, useAsignados, useTareas, useTareasSinSubir, type Tarea } from '../../datos/tareas.ts'
import { useTextos } from '../../textos.ts'
import { diaDeTarea, nombreDe, nombresDe, partesDeFecha, useEstados } from './comun.ts'
import estilos from './DetalleTarea.module.css'

export type PropsDetalle = {
  tarea: Tarea
  // En el computador va en la columna de la derecha, sin "‹ Tareas"
  computador: boolean
  // Texto y destino de "‹": "Tareas" normalmente; "Hoy" si se abrió desde Hoy
  atras: { texto: string; ir: () => void }
  onEditar: () => void
  // Después de borrarla: el contenedor vuelve a la lista y muestra "Borraste «…»." con "Deshacer"
  onBorrada: (tarea: Tarea) => void
}

// El detalle de una tarea (forma "Fecha grande"): la fecha, el título y, en palabras, de quién es y en qué está;
// quiénes faltan, las notas, quién la creó y "Borrar tarea". Abajo, la acción que te toca: "Me la tomo",
// "Marcar como hecha" o "Desmarcar". En el celular ocupa la pantalla; en el computador es una tarjeta en la columna
// de la derecha. Cada acción avisa con "Deshacer".
export function DetalleTarea(props: PropsDetalle) {
  // Cada tarea parte de cero: sin aviso ni lista abierta
  return <Detalle key={props.tarea.id} {...props} />
}

type Linea = { texto: string; icono?: boolean; atrasada?: boolean }

function Detalle({ tarea, computador, atras, onEditar, onBorrada }: PropsDetalle) {
  const textos = useTextos()
  const sesion = useSesion()
  const { data: personas } = usePersonas()
  const { data: tareas } = useTareas()
  const { data: asignados } = useAsignados()
  const aviso = useAviso()
  const conectado = useConectado()
  const sinSubir = useTareasSinSubir().has(tarea.id)
  const [abierta, setAbierta] = useState(false)
  // Mientras una acción se guarda no se acepta otra
  const ocupado = useRef(false)
  const yoId = sesion.tipo === 'dentro' ? sesion.persona.id : ''
  const estados = useEstados(tareas, asignados, yoId)
  if (sesion.tipo !== 'dentro') return null
  const yo = sesion.persona
  const c = textos.tareas.comun
  const d = textos.tareas.detalle

  // Lo que dice la lista puede ir un momento detrás de lo que llega aquí: sin estado no hay nada que mostrar
  const estado = estados.get(tarea.id)
  if (!estado) return null

  const hoy = hoyEnCalifornia()
  const puede = puedeCambiarTarea(tarea, yo)
  const tarde = atrasada(tarea, estado, hoy)
  const nombre = (id: string) => nombreDe(id, personas, yo.id, textos)
  // "el lunes 9" o null si fue hoy (el texto dice "hoy")
  const diaDe = (momento: string) => {
    const dia = diaEn(momento)
    return dia === hoy ? null : diaDeTarea(dia, hoy)
  }
  const miFila = (asignados ?? []).find((a) => a.tarea === tarea.id && a.persona === yo.id)

  // ---------- Las líneas de estado, en palabras ----------
  const lineas: Linea[] = []
  switch (estado.modo) {
    case 'cada':
      lineas.push({ texto: d.cadaUno }, { texto: c.yaLaHicieron(estado.hechas, estado.total) })
      break
    case 'uno':
      if (estado.tomadaPorMi && estado.personas.length === 1) {
        const dia = miFila ? diaDe(miFila.asignado_en) : null
        lineas.push({ texto: dia ? d.tomasteEl(dia) : d.tomasteHoy })
      } else if (estado.personas.length > 1) lineas.push({ texto: textos.o(nombresDe(estado.personas, personas, yo.id, textos)) }, { texto: d.bastaUno })
      else lineas.push({ texto: estado.personas.length === 1 ? nombre(estado.personas[0]) : c.alguien })
      break
    case 'sin':
      lineas.push({ texto: d.sinAsignarCualquiera })
      break
    case 'personal':
      lineas.push({ texto: d.personalSoloTu, icono: true })
      break
  }
  if (estado.hechaPor) {
    const dia = diaDe(estado.hechaPor.en)
    lineas.push({ texto: estado.hechaPor.persona === yo.id ? d.laHiciste(dia) : d.hechaPor(nombre(estado.hechaPor.persona), dia) })
  }
  if (tarde && tarea.para) lineas.push({ texto: d.atrasada(diaDeTarea(tarea.para, hoy)), atrasada: true })

  // ---------- Quién la creó y quién puede cambiarla ----------
  const creadorEsta = tarea.creada_por === yo.id || Boolean(personas?.some((p) => p.id === tarea.creada_por))
  const creada = diaLargo(diaEn(tarea.creada_en))
  const creo = tarea.creada_por === yo.id ? d.laCreaste(creada) : d.laCreo(nombre(tarea.creada_por), creada)
  const creador = personas?.find((p) => p.id === tarea.creada_por)
  const soloPuede = !puede ? d.soloPuede(creador ? primerNombre(creador) : null) : null

  // Quiénes ya la hicieron (cada uno): los asignados que no faltan
  const hicieron = estado.personas.filter((p) => !estado.faltan.includes(p))

  // ---------- Acciones ----------
  const falla = (error: unknown) => {
    if (error instanceof ErrorDeTarea && error.motivo !== 'otro') {
      if (error.motivo === 'tomada') {
        const otro = (asignados ?? []).find((a) => a.tarea === tarea.id && a.persona !== yo.id)
        aviso.mostrar(c.motivos.tomada(otro ? nombre(otro.persona) : null))
      } else aviso.mostrar(c.motivos[error.motivo])
    } else aviso.mostrar(textos.noSeGuardo)
  }
  // Corre una acción de a una; "deshaciendo" es el propio Deshacer: no deja otro aviso
  const hacer = async (accion: () => Promise<void>, avisar: string, deshacer: () => Promise<void>, deshaciendo: boolean) => {
    if (ocupado.current) return
    ocupado.current = true
    try {
      await accion()
      if (deshaciendo) aviso.cerrar()
      else aviso.mostrar(avisar, () => void deshacer())
    } catch (error) {
      falla(error)
    }
    ocupado.current = false
  }
  const tomar = (deshaciendo = false): Promise<void> => hacer(() => tomarTarea(tarea.id), d.tomaste(tarea.titulo), () => soltar(true), deshaciendo)
  const soltar = (deshaciendo = false): Promise<void> => hacer(() => soltarTarea(tarea.id), d.soltaste(tarea.titulo), () => tomar(true), deshaciendo)
  const marcar = (hecha: boolean, deshaciendo = false): Promise<void> =>
    hacer(
      async () => {
        await marcarTarea(tarea.id, hecha)
      },
      hecha ? (estado.modo === 'cada' ? d.marcasteMia : d.marcaste(tarea.titulo)) : d.desmarcaste(tarea.titulo),
      () => marcar(!hecha, true),
      deshaciendo,
    )
  const borrar = async () => {
    if (ocupado.current) return
    ocupado.current = true
    try {
      await borrarTarea(tarea.id)
      onBorrada(tarea)
    } catch (error) {
      falla(error)
      ocupado.current = false
    }
  }
  // Cambiar, borrar, tomar y soltar necesitan conexión: sin señal se ven apagados y tocarlos avisa
  const conConexion = (accion: () => void, sinRed: string) => () => {
    if (conectado) accion()
    else aviso.mostrar(sinRed)
  }

  // ---------- Qué botones tiene abajo ----------
  const cada = estado.modo === 'cada'
  const puedoTomar = estado.modo === 'sin' && !estado.mia
  // Quien tiene la tarea la marca o la desmarca; en "basta con uno", aunque la haya hecho otro (como en la lista):
  // desmarcar la deja por hacer para todos
  const puedoMarcar = estado.mia
  const hayPie = puedoTomar || puedoMarcar

  const pie = hayPie && (
    <div className={estilos.pie}>
      {puedoTomar && (
        <div onClick={() => !conectado && aviso.mostrar(d.necesitasConexionTomar)}>
          <BotonPrincipal apagado={!conectado} onClick={() => void tomar()}>
            {d.meLaTomo}
          </BotonPrincipal>
        </div>
      )}
      {puedoMarcar &&
        (estado.miParteHecha ? (
          <BotonBorde onClick={() => void marcar(false)}>{cada ? d.desmarcarMia : d.desmarcar}</BotonBorde>
        ) : (
          <BotonPrincipal onClick={() => void marcar(true)}>{cada ? d.marcarMia : d.marcar}</BotonPrincipal>
        ))}
      {estado.tomadaPorMi && (
        <button type="button" className={estilos.enlace} aria-disabled={!conectado} onClick={conConexion(() => void soltar(), d.necesitasConexionSoltar)}>
          {d.soltarla}
        </button>
      )}
    </div>
  )

  // ---------- Partes ----------
  const Titulo = computador ? 'h2' : 'h1'
  const fecha = tarea.para ? partesDeFecha(tarea.para) : null
  const encabezado = (
    <div className={estilos.titular}>
      {fecha && (
        <div className={estilos.fecha} data-atrasada={tarde}>
          <small>{fecha.semana}</small>
          <b>{fecha.dia}</b>
          <em>{fecha.mes}</em>
        </div>
      )}
      <div className={estilos.nombres}>
        <Titulo className={estilos.titulo}>{tarea.titulo}</Titulo>
        {lineas.map((l) => (
          <div key={l.texto} className={estilos.estado} data-atrasada={l.atrasada}>
            {l.icono && <Icono nombre="candado" medida={15} trazo={2} />}
            {l.icono && ' '}
            {l.texto}
          </div>
        ))}
        {sinSubir && (
          <div className={estilos.sinSubir}>
            <Icono nombre="sinSubir" medida={15} trazo={2} />
            {c.sinSubir}
          </div>
        )}
      </div>
    </div>
  )

  const cuerpo = (
    <>
      {cada && estado.faltan.length > 0 && (
        <>
          <h3 className={estilos.seccion}>{d.faltan}</h3>
          <p className={estilos.texto}>{textos.y(nombresDe(estado.faltan, personas, yo.id, textos))}.</p>
        </>
      )}
      {cada && hicieron.length > 0 && (
        <>
          <button type="button" className={estilos.plegable} aria-expanded={abierta} onClick={() => setAbierta(!abierta)}>
            <Icono nombre={abierta ? 'abajo' : 'derecha'} medida={18} trazo={2} />
            {d.yaLaHicieron(hicieron.length)}
          </button>
          {abierta && <p className={estilos.texto}>{textos.y(nombresDe(hicieron, personas, yo.id, textos))}.</p>}
        </>
      )}
      {tarea.notas?.trim() && (
        <>
          <h3 className={estilos.seccion}>{d.notas}</h3>
          <p className={`${estilos.texto} ${estilos.notas}`}>{tarea.notas}</p>
        </>
      )}
      {(personas || tarea.creada_por === yo.id) && creadorEsta && <p className={estilos.creo}>{creo}</p>}
      {soloPuede && <p className={estilos.creo}>{soloPuede}</p>}
      {puede && (
        <button type="button" className={estilos.borrar} aria-disabled={!conectado} onClick={conConexion(() => void borrar(), c.sinRed)}>
          {d.borrar}
        </button>
      )}
    </>
  )

  const editar = puede && (
    <button type="button" className={estilos.editar} aria-disabled={!conectado} onClick={conConexion(onEditar, c.sinRed)}>
      <Icono nombre="lapiz" medida={18} trazo={2} />
      {d.editar}
    </button>
  )

  // ---------- Computador ----------
  if (computador) {
    return (
      <section aria-label={tarea.titulo} className={estilos.tarjeta}>
        <div className={estilos.franja}>
          <div className={estilos.cabecera}>
            <SinConexion sobrePanel />
            {editar}
          </div>
          {encabezado}
        </div>
        <div className={estilos.contenido}>{cuerpo}</div>
        {pie && <div className={estilos.pieTarjeta}>{pie}</div>}
        <Aviso texto={aviso.texto} onDeshacer={aviso.deshacer} conPanel />
      </section>
    )
  }

  // ---------- Celular ----------
  return (
    <PantallaConPie pie={pie}>
      <div className={`${estilos.franja} ${estilos.franjaCel}`}>
        <div className={estilos.cabecera}>
          <Atras texto={atras.texto} onClick={atras.ir} />
          <span className={estilos.derecha}>
            <SinConexion sobrePanel />
            {editar}
          </span>
        </div>
        {encabezado}
      </div>
      <div className={estilos.cuerpo}>{cuerpo}</div>
      <Aviso texto={aviso.texto} onDeshacer={aviso.deshacer} sobrePie={hayPie} />
    </PantallaConPie>
  )
}
