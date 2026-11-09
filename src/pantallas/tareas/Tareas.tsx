import { useState } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router'
import { Aviso } from '../../componentes/Controles.tsx'
import { Icono } from '../../componentes/Icono.tsx'
import { SinConexion } from '../../componentes/SinConexion.tsx'
import { useAviso } from '../../componentes/useAviso.ts'
import { useEsComputador } from '../../componentes/useEsComputador.ts'
import escritorio from '../../componentes/Escritorio.module.css'
import { useConectado } from '../../datos/conexion.ts'
import { hoyEnCalifornia } from '../../datos/fechas.ts'
import { useSesion } from '../../datos/sesion.tsx'
import { devolverTarea, puedeCambiarTarea, useAsignados, useTareas, type Tarea } from '../../datos/tareas.ts'
import { useTextos } from '../../textos.ts'
import { useEstados } from './comun.ts'
import { DetalleTarea } from './DetalleTarea.tsx'
import { ListaTareas } from './ListaTareas.tsx'
import { NuevaTarea, type AvisoDeTarea } from './NuevaTarea.tsx'
import { enOrden, ordenarLista } from './ordenLista.ts'
import estilos from './Tareas.module.css'

type EstadoDeRuta = { desdeAqui?: boolean; desde?: string; ver?: string } | null

// Tareas: la lista por fecha; en el celular la tarea ocupa la pantalla, en el computador queda a la derecha.
// Rutas: /tareas, /tareas/nueva, /tareas/:id y /tareas/:id/editar.
export function Tareas() {
  const textos = useTextos()
  const sesion = useSesion()
  const navigate = useNavigate()
  const location = useLocation()
  const { id, accion } = useParams()
  const esComputador = useEsComputador()
  const { data: tareas } = useTareas()
  const { data: asignados } = useAsignados()
  const aviso = useAviso()
  const sinRed = !useConectado()
  const estadoDeRuta = location.state as EstadoDeRuta
  // Desde Hoy, "N tareas más" abre la lista en "Mías"
  const [mias, setMias] = useState(estadoDeRuta?.ver === 'mias')
  const estados = useEstados(tareas, asignados, sesion.tipo === 'dentro' ? sesion.persona.id : '')
  if (sesion.tipo !== 'dentro') return null
  const yo = sesion.persona
  const t = textos.tareas
  const tl = t.lista

  // ---------- Navegación ----------
  // Abrir agrega una entrada al historial; cerrar vuelve atrás si se abrió desde aquí, así el "atrás" del teléfono hace lo mismo
  const desdeAqui = estadoDeRuta?.desdeAqui === true
  const desdeHoy = estadoDeRuta?.desde === 'hoy'
  const ir = (ruta: string, reemplazar = false) => navigate(ruta, { replace: reemplazar, state: { desdeAqui: reemplazar ? desdeAqui : true, desde: estadoDeRuta?.desde } })
  const volver = (ruta: string) => (desdeAqui ? navigate(-1) : navigate(ruta, { replace: true }))
  const cerrar = () => volver('/tareas')
  // En el computador, elegir otra tarea reemplaza a la que estaba abierta
  const abrir = (ruta: string) => {
    if (location.pathname === ruta) return
    aviso.cerrar()
    ir(ruta, esComputador && Boolean(id))
  }
  const nuevaTarea = () => (sinRed ? aviso.mostrar(tl.sinRedNueva) : abrir('/tareas/nueva'))

  const deshacer = async (cambio: () => Promise<unknown>) => {
    try {
      await cambio()
      aviso.cerrar()
    } catch {
      aviso.mostrar(textos.noSeGuardo)
    }
  }

  // ---------- Qué se ve ----------
  const todas = tareas ?? []
  const hoy = hoyEnCalifornia()
  const orden = enOrden(ordenarLista(todas, estados, mias, hoy))
  const abierta = id && id !== 'nueva' ? todas.find((x) => x.id === id) : undefined
  // Una tarea que ya no está (borrada, deshecha o una dirección vieja) lleva a la lista
  if (tareas && id && id !== 'nueva' && !abierta) return <Navigate to="/tareas" replace />
  // En el computador, sin tarea elegida queda abierta la primera de la lista
  const elegida = abierta ?? (esComputador && !id ? orden[0] : undefined)

  const alBorrar = (borrada: Tarea) => {
    if (esComputador) {
      const i = orden.findIndex((x) => x.id === borrada.id)
      const otra = orden[i + 1] ?? orden[i - 1]
      navigate(otra ? `/tareas/${otra.id}` : '/tareas', { replace: true, state: { desdeAqui: false, desde: estadoDeRuta?.desde } })
    } else cerrar()
    aviso.mostrar(tl.borraste(borrada.titulo), () => void deshacer(() => devolverTarea(borrada.id)))
  }
  // Como en Contactos: después de crear, en el computador queda abierta la tarea nueva y en el celular se vuelve a la
  // lista, donde se ve el aviso con "Deshacer". Después de guardar se vuelve a la tarea; en el celular la tarea ocupa
  // la pantalla y lo guardado ya se ve en ella, así que el aviso queda solo para el computador.
  const alTerminar = (tarea: Tarea, avisoDeTarea: AvisoDeTarea) => {
    const editada = accion === 'editar'
    if (editada) volver(`/tareas/${tarea.id}`)
    else if (esComputador) ir(`/tareas/${tarea.id}`, true)
    else volver('/tareas')
    if (esComputador || !editada) aviso.mostrar(avisoDeTarea.texto, () => void deshacer(avisoDeTarea.deshacer))
  }
  const atras = desdeHoy ? { texto: textos.secciones.hoy, ir: () => navigate('/hoy') } : { texto: t.titulo, ir: cerrar }

  const panel =
    id === 'nueva' ? (
      <NuevaTarea computador={esComputador} onCerrar={cerrar} onListo={alTerminar} />
    ) : abierta && accion === 'editar' && puedeCambiarTarea(abierta, yo) ? (
      <NuevaTarea computador={esComputador} tarea={abierta} onCerrar={() => volver(`/tareas/${abierta.id}`)} onListo={alTerminar} />
    ) : elegida ? (
      <DetalleTarea
        key={elegida.id}
        tarea={elegida}
        computador={esComputador}
        atras={atras}
        onEditar={() => ir(`/tareas/${elegida.id}/editar`)}
        onBorrada={alBorrar}
      />
    ) : null

  // Celular: la tarea, nueva o abierta, ocupa la pantalla
  if (!esComputador && panel) return panel
  if (!esComputador && id && !tareas) return null

  const vacio = tareas?.length === 0
  const sinMias = !vacio && mias && orden.length === 0
  const segmento = (
    <div role="group" aria-label={tl.queVer} className={estilos.segmento}>
      <button type="button" aria-pressed={!mias} onClick={() => setMias(false)}>
        {tl.todas}
      </button>
      <button type="button" aria-pressed={mias} onClick={() => setMias(true)}>
        {tl.mias}
      </button>
    </div>
  )
  const lista = (
    <ListaTareas
      tareas={todas}
      estados={estados}
      yo={yo.id}
      mias={mias}
      elegida={esComputador ? elegida?.id : undefined}
      onAbrir={(tarea) => abrir(`/tareas/${tarea.id}`)}
      avisar={aviso.mostrar}
      cerrarAviso={aviso.cerrar}
    />
  )
  const sinTareas = (
    <div className={estilos.vacio}>
      <span className={estilos.tuercaVacia} aria-hidden="true" />
      <div className={estilos.vacioTexto}>{tl.vacio}</div>
      <button type="button" className={estilos.agregar} aria-disabled={sinRed} onClick={nuevaTarea}>
        {tl.nuevaTarea}
      </button>
    </div>
  )
  const sinTareasMias = <div className={estilos.sinMias}>{tl.sinMias}</div>

  // ---------- Computador ----------
  if (esComputador) {
    return (
      <div className={escritorio.pantalla}>
        <div className={estilos.cabeceraPc}>
          <h1 className={escritorio.titulo}>{t.titulo}</h1>
          <div className={estilos.derechaPc}>
            <SinConexion />
            {segmento}
            <button type="button" className={estilos.nuevo} aria-pressed={id === 'nueva'} aria-disabled={sinRed && id !== 'nueva'} onClick={() => (id === 'nueva' ? cerrar() : nuevaTarea())}>
              <Icono nombre="mas" medida={18} trazo={2.25} />
              {tl.nuevaTarea}
            </button>
          </div>
        </div>
        <div className={escritorio.cuerpo}>
          <div className={estilos.columnas}>
            <div className={estilos.columna}>{vacio ? sinTareas : sinMias ? sinTareasMias : lista}</div>
            <div className={estilos.lado}>{panel}</div>
          </div>
        </div>
        <Aviso texto={aviso.texto} onDeshacer={aviso.deshacer} conPanel />
      </div>
    )
  }

  // ---------- Celular ----------
  return (
    <div className={estilos.celular}>
      <div className={estilos.cabecera}>
        <div className={estilos.fichaCel}>
          <SinConexion sobrePanel />
        </div>
        <div className={estilos.titular}>
          <h1 className={estilos.titulo}>{t.titulo}</h1>
          <button type="button" className={estilos.nuevo} aria-label={tl.nuevaTarea} aria-disabled={sinRed} onClick={nuevaTarea}>
            <Icono nombre="mas" medida={18} trazo={2.25} />
            {tl.nueva}
          </button>
        </div>
        {!vacio && <div className={estilos.controles}>{segmento}</div>}
      </div>
      {vacio ? sinTareas : sinMias ? sinTareasMias : lista}
      <Aviso texto={aviso.texto} onDeshacer={aviso.deshacer} />
    </div>
  )
}
