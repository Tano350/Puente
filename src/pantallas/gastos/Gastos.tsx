import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router'
import { Aviso } from '../../componentes/Controles.tsx'
import { Icono } from '../../componentes/Icono.tsx'
import { SinConexion } from '../../componentes/SinConexion.tsx'
import { useAviso } from '../../componentes/useAviso.ts'
import { useEsComputador } from '../../componentes/useEsComputador.ts'
import escritorio from '../../componentes/Escritorio.module.css'
import { estaConectado, useConectado } from '../../datos/conexion.ts'
import { usePersonas } from '../../datos/consultas.ts'
import { hoyEnCalifornia } from '../../datos/fechas.ts'
import { borrarGasto, devolverGasto, puedeCambiarGasto, useGastos, usePartes, type Gasto } from '../../datos/gastos.ts'
import { primerNombre } from '../../datos/nombres.ts'
import { useSesion } from '../../datos/sesion.tsx'
import { useTextos } from '../../textos.ts'
import { AnotarGasto } from './AnotarGasto.tsx'
import { DetalleGasto } from './DetalleGasto.tsx'
import { ListaGastos } from './ListaGastos.tsx'
import { ResumenRendicion, VistaRendicion } from './Rendicion.tsx'
import { TarjetaSaldo, VistaSaldos } from './Saldos.tsx'
import { ResumenTotales } from './Totales.tsx'
import estilos from './Gastos.module.css'

type Pestana = 'gastos' | 'saldos' | 'rendicion'
const PESTANAS: Pestana[] = ['gastos', 'saldos', 'rendicion']

// Gastos: en el celular, las pestañas Gastos, Saldos y Rendición; en el computador, la lista por día con los saldos al lado.
// Rutas: /gastos, /gastos/nuevo, /gastos/:id y /gastos/:id/editar. El gasto, nuevo o abierto, ocupa la pantalla en el
// celular y va en un panel encima de la lista en el computador. Otra pantalla abre una pestaña con
// navigate('/gastos', { state: { ver: 'saldos' | 'rendicion' } }); en el computador, "rendicion" abre la rendición encima.
// Con saldar: true también abre "Saldar" (en el celular, en la pestaña Saldos).
export function Gastos() {
  const textos = useTextos()
  const sesion = useSesion()
  const navigate = useNavigate()
  const location = useLocation()
  const { id, accion } = useParams()
  const esComputador = useEsComputador()
  const gastos = useGastos()
  const partes = usePartes()
  const personas = usePersonas()
  const aviso = useAviso()
  const conectado = useConectado()
  const estado = location.state as { desdeAqui?: boolean; ver?: string; saldar?: boolean } | null
  const pedida = PESTANAS.find((p) => p === estado?.ver)
  const [pestana, setPestana] = useState<Pestana>(pedida ?? 'gastos')
  // Quien llega pidiendo 'Saldar' (Hoy, al volver del viaje) lo encuentra abierto; se consume al abrirse
  const [saldarAlLlegar, setSaldarAlLlegar] = useState(estado?.saldar === true)
  const alAbrirseSaldar = useCallback(() => {
    setSaldarAlLlegar(false)
    // Que recargar la página o volver a esta entrada no lo abra otra vez
    const entrada = window.history.state as { usr?: Record<string, unknown> } | null
    if (entrada?.usr?.saldar) window.history.replaceState({ ...entrada, usr: { ...entrada.usr, saldar: false } }, '')
  }, [])
  const pestanas = useRef<(HTMLButtonElement | null)[]>([])
  const desdeAqui = estado?.desdeAqui === true
  const verRendicion = esComputador && !id && pedida === 'rendicion'
  // Dónde está la pantalla al tocar "Deshacer" (el aviso dura más que la pantalla en que apareció)
  const actual = useRef({ id, desdeAqui, verRendicion })
  useEffect(() => {
    actual.current = { id, desdeAqui, verRendicion }
  })
  if (sesion.tipo !== 'dentro') return null
  const yo = sesion.persona
  const t = textos.gastos
  const tl = t.lista

  // ---------- Navegación ----------
  // Abrir agrega una entrada al historial; cerrar vuelve atrás si se abrió desde aquí, así el "atrás" del teléfono hace lo mismo
  const ir = (ruta: string, reemplazar = false, ver?: Pestana) => navigate(ruta, { replace: reemplazar, state: { desdeAqui: reemplazar ? desdeAqui : true, ver } })
  const volver = (ruta: string) => (desdeAqui ? navigate(-1) : navigate(ruta, { replace: true }))
  const cerrar = () => volver('/gastos')
  // Cierra lo que esté abierto cuando llega el aviso, que puede ser después de cambiar de pantalla
  const cerrarAhora = () => (actual.current.desdeAqui ? navigate(-1) : navigate('/gastos', { replace: true }))
  // En el computador hay un panel a la vez: abrir otro reemplaza al que estaba
  const abrir = (ruta: string, ver?: Pestana) => {
    if (location.pathname === ruta && pedida === ver) return
    aviso.cerrar()
    ir(ruta, esComputador && (Boolean(id) || verRendicion), ver)
  }

  const deshacer = async (cambio: () => Promise<unknown>) => {
    try {
      await cambio()
      aviso.cerrar()
    } catch {
      aviso.mostrar(textos.noSeGuardo)
    }
  }
  // Después de anotar, en el computador queda abierto el gasto nuevo; en el celular se vuelve a la lista.
  // Después de guardar un cambio se vuelve al gasto.
  const alTerminar = (gasto: Gasto, como: 'anotado' | 'guardado') => {
    if (como === 'guardado') {
      volver(`/gastos/${gasto.id}`)
      aviso.mostrar(tl.guardaste)
      return
    }
    if (esComputador) ir(`/gastos/${gasto.id}`, true)
    else {
      volver('/gastos')
      setPestana('gastos')
    }
    // Sin señal el gasto queda anotado en este celular y sube cuando vuelva la conexión
    aviso.mostrar(estaConectado() ? tl.anotaste(gasto.titulo) : tl.anotasteSinSenal(gasto.titulo), () =>
      void deshacer(async () => {
        if (actual.current.id === gasto.id) cerrarAhora()
        await borrarGasto(gasto.id)
      }),
    )
  }
  // Eliminado, el gasto se cierra; "Deshacer" lo trae de vuelta y, si no hay otro abierto, lo abre
  const alEliminar = (gasto: Gasto) => {
    if (actual.current.id === gasto.id) cerrarAhora()
    aviso.mostrar(tl.eliminaste(gasto.titulo), () =>
      void deshacer(async () => {
        await devolverGasto(gasto.id)
        if (!actual.current.id && !actual.current.verRendicion) ir(`/gastos/${gasto.id}`)
      }),
    )
  }

  const lista = gastos.data
  const abierto = id && id !== 'nuevo' ? lista?.find((g) => g.id === id) : undefined
  // Un gasto que ya no está (eliminado, deshecho o una dirección vieja) lleva a la lista
  if (lista && id && id !== 'nuevo' && !abierto) return <Navigate to="/gastos" replace />
  const panel =
    id === 'nuevo' ? (
      <AnotarGasto key="nuevo" computador={esComputador} onCerrar={cerrar} onListo={alTerminar} />
    ) : abierto && accion === 'editar' && puedeCambiarGasto(abierto, yo) ? (
      <AnotarGasto key={`editar-${abierto.id}`} computador={esComputador} gasto={abierto} onCerrar={() => volver(`/gastos/${abierto.id}`)} onListo={alTerminar} />
    ) : abierto ? (
      <DetalleGasto key={abierto.id} gasto={abierto} computador={esComputador} onCerrar={cerrar} onEditar={() => ir(`/gastos/${abierto.id}/editar`)} onEliminado={alEliminar} />
    ) : verRendicion ? (
      <VistaRendicion computador onCerrar={cerrar} />
    ) : null

  // ---------- Celular: el gasto, nuevo o abierto, ocupa la pantalla ----------
  if (!esComputador && panel)
    return (
      <>
        {panel}
        <Aviso texto={aviso.texto} onDeshacer={aviso.deshacer} />
      </>
    )
  if (!esComputador && id && !lista) return null

  // ---------- Qué se ve ----------
  const listos = lista && partes.data && (personas.data || personas.isError) ? { gastos: lista, partes: partes.data } : null
  const nombres = new Map((personas.data ?? []).map((p) => [p.id, primerNombre(p)]))
  const hay = (listos?.gastos.length ?? 0) > 0
  const contenido =
    (gastos.isError && !lista) || (partes.isError && !partes.data) ? (
      <div className={estilos.fallo}>
        <p>{tl.noSeCargo}</p>
        <button
          type="button"
          className={estilos.reintentar}
          onClick={() => {
            void gastos.refetch()
            void partes.refetch()
          }}
        >
          {tl.reintentar}
        </button>
      </div>
    ) : !listos ? null : hay ? (
      <ListaGastos
        gastos={listos.gastos}
        partes={listos.partes}
        yo={yo.id}
        nombres={nombres}
        hoy={hoyEnCalifornia()}
        computador={esComputador}
        elegido={abierto?.id}
        onAbrir={(g) => abrir(`/gastos/${g.id}`)}
      />
    ) : (
      <div className={estilos.vacio}>
        <span className={estilos.tuercaVacia} aria-hidden="true" />
        <div className={estilos.vacioTexto}>{tl.vacio}</div>
      </div>
    )

  // ---------- Computador: la lista y, al lado, tu saldo, los saldos y la rendición ----------
  if (esComputador) {
    return (
      <div className={escritorio.pantalla}>
        <div className={estilos.cabeceraPc}>
          <h1 className={escritorio.titulo}>{t.titulo}</h1>
          <div className={estilos.accionesPc}>
            <SinConexion />
            <button type="button" className={estilos.anotarPc} aria-pressed={id === 'nuevo'} onClick={() => (id === 'nuevo' ? cerrar() : abrir('/gastos/nuevo'))}>
              <Icono nombre="mas" medida={18} trazo={2.25} />
              {tl.anotar}
            </button>
          </div>
        </div>
        <div className={estilos.cuerpoPc}>
          <div className={estilos.columnasPc} data-panel={Boolean(panel)}>
            <div className={estilos.listaPc}>{contenido}</div>
            {/* Con un panel abierto, la columna queda tapada: no se alcanza con el teclado */}
            <aside aria-label={t.pestanas.saldos} className={estilos.ladoPc} inert={Boolean(panel)}>
              <div className={estilos.bloque}>
                <div className={estilos.sobreTarjeta}>
                  <ResumenTotales />
                </div>
                <TarjetaSaldo computador abrirSaldar={saldarAlLlegar} onSaldarAbierto={alAbrirseSaldar} />
              </div>
              <div className={estilos.bloque}>
                <ResumenRendicion onPreparar={() => abrir('/gastos', 'rendicion')} />
              </div>
              <div className={estilos.bloque}>
                <VistaSaldos computador enColumna />
              </div>
            </aside>
          </div>
          {panel}
        </div>
        <Aviso texto={aviso.texto} onDeshacer={aviso.deshacer} conPanel={Boolean(panel)} />
      </div>
    )
  }

  // ---------- Celular ----------
  // Las pestañas se recorren con las flechas, como pide el patrón de pestañas
  const moverPestana = (e: KeyboardEvent, i: number) => {
    const teclas: Record<string, number> = { ArrowRight: (i + 1) % 3, ArrowLeft: (i + 2) % 3, Home: 0, End: 2 }
    const destino = teclas[e.key]
    if (destino === undefined) return
    e.preventDefault()
    setPestana(PESTANAS[destino])
    pestanas.current[destino]?.focus()
  }
  return (
    <div className={estilos.celular}>
      <div className={estilos.cabecera} data-sin-red={!conectado}>
        {!conectado && (
          <div className={estilos.fichaFila}>
            <SinConexion sobrePanel />
          </div>
        )}
        <h1 className={estilos.titulo}>{t.titulo}</h1>
        <div role="tablist" aria-label={tl.vistas} className={estilos.pestanas}>
          {PESTANAS.map((p, i) => (
            <button
              key={p}
              ref={(boton) => {
                pestanas.current[i] = boton
              }}
              type="button"
              role="tab"
              id={`gastos-${p}`}
              aria-selected={pestana === p}
              aria-controls="gastos-vista"
              tabIndex={pestana === p ? 0 : -1}
              onClick={() => setPestana(p)}
              onKeyDown={(e) => moverPestana(e, i)}
            >
              {t.pestanas[p]}
            </button>
          ))}
        </div>
      </div>
      <div id="gastos-vista" role="tabpanel" aria-labelledby={`gastos-${pestana}`}>
        {pestana === 'gastos' ? (
          <>
            {hay && (
              <div className={estilos.arriba}>
                <div className={estilos.sobreTarjeta}>
                  <ResumenTotales />
                </div>
                <TarjetaSaldo computador={false} />
              </div>
            )}
            {contenido}
          </>
        ) : (
          <div className={estilos.arriba}>{pestana === 'saldos' ? <VistaSaldos computador={false} abrirSaldar={saldarAlLlegar} onSaldarAbierto={alAbrirseSaldar} /> : <VistaRendicion computador={false} />}</div>
        )}
      </div>
      <button type="button" className={estilos.anotar} onClick={() => abrir('/gastos/nuevo')}>
        <Icono nombre="gastos" medida={20} trazo={2} />
        {tl.anotar}
      </button>
      <Aviso texto={aviso.texto} onDeshacer={aviso.deshacer} sobrePie />
    </div>
  )
}
