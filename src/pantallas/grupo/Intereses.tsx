import { useState } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router'
import { Aviso, BotonBorde, BotonPrincipal, Hoja, TituloHoja } from '../../componentes/Controles.tsx'
import escritorio from '../../componentes/Escritorio.module.css'
import { SinConexion } from '../../componentes/SinConexion.tsx'
import { useAviso } from '../../componentes/useAviso.ts'
import { useEsComputador } from '../../componentes/useEsComputador.ts'
import { usePersonas } from '../../datos/consultas.ts'
import { useConectado } from '../../datos/conexion.ts'
import { ahora } from '../../datos/fechas.ts'
import { soloParaTema, useEventos } from '../../datos/eventos.ts'
import { integrantes } from '../../datos/grupo.ts'
import { borrarTema, devolverTema, eventosDelTema, meInteresa, puedeCambiarTema, useInteresados, useTemas, yaNoMeInteresa, type Tema } from '../../datos/intereses.ts'
import { useSesion } from '../../datos/sesion.tsx'
import { useTextos } from '../../textos.ts'
import { BotonNuevoTema, CabeceraCelular, SegmentoGrupo } from './CabeceraGrupo.tsx'
import estilos from './Intereses.module.css'
import { ListaTemas } from './ListaTemas.tsx'
import { TemaDetalle } from './TemaDetalle.tsx'
import { TemaFormulario } from './TemaFormulario.tsx'

type EstadoDeRuta = { desdeAqui?: boolean } | null

// Intereses, dentro de Grupo: la lista de temas; en el celular el tema ocupa la pantalla, en el computador queda a la
// derecha. Rutas: /grupo/intereses, /grupo/intereses/nuevo, /grupo/intereses/:tema y /grupo/intereses/:tema/editar.
export function Intereses() {
  const textos = useTextos()
  const sesion = useSesion()
  const navigate = useNavigate()
  const location = useLocation()
  const { tema: id, accion } = useParams()
  const esComputador = useEsComputador()
  const { data: temas } = useTemas()
  const { data: interesados } = useInteresados()
  const { data: personas } = usePersonas()
  const { data: eventos } = useEventos()
  const aviso = useAviso()
  const conectado = useConectado()
  const [borrando, setBorrando] = useState<Tema | null>(null)
  if (sesion.tipo !== 'dentro') return null
  const yo = sesion.persona
  const t = textos.intereses
  const c = t.comun

  // ---------- Navegación ----------
  // Abrir agrega una entrada al historial; cerrar vuelve atrás si se abrió desde aquí, así el «atrás» del teléfono hace lo mismo
  const desdeAqui = (location.state as EstadoDeRuta)?.desdeAqui === true
  const ir = (ruta: string, reemplazar = false) => navigate(ruta, { replace: reemplazar, state: { desdeAqui: reemplazar ? desdeAqui : true } })
  const volver = (ruta: string) => (desdeAqui ? navigate(-1) : navigate(ruta, { replace: true }))
  const cerrar = () => volver('/grupo/intereses')
  const abrir = (ruta: string) => {
    if (location.pathname === ruta) return
    aviso.cerrar()
    ir(ruta, esComputador && Boolean(id))
  }

  // ---------- Qué se ve ----------
  const lista = temas ?? []
  const gente = integrantes([yo, ...(personas ?? []).filter((p) => p.id !== yo.id)], yo.id)
  const nuevo = id === 'nuevo'
  const abierto = id && !nuevo ? lista.find((x) => x.id === id) : undefined
  // Un tema que ya no está (borrado, deshecho o una dirección vieja) lleva a la lista
  if (temas && id && !nuevo && !abierto) return <Navigate to="/grupo/intereses" replace />
  // En el computador, sin tema elegido queda abierto el primero
  const elegido = abierto ?? (esComputador && !id ? lista[0] : undefined)
  const editando = Boolean(abierto && accion === 'editar' && puedeCambiarTema(abierto, yo))

  // ---------- Acciones ----------
  const deshacer = async (cambio: () => Promise<unknown>) => {
    try {
      await cambio()
      aviso.cerrar()
    } catch {
      aviso.mostrar(textos.noSeGuardo)
    }
  }
  const conConexion = (sinRed: string, accionar: () => void) => {
    if (conectado) accionar()
    else aviso.mostrar(sinRed)
  }
  const sumarse = (tema: Tema) =>
    conConexion(c.necesitasConexion, () => {
      void meInteresa(tema.id).then(
        () => aviso.mostrar(t.grupo.teSumaste(tema.nombre), () => void deshacer(() => yaNoMeInteresa(tema.id))),
        () => aviso.mostrar(textos.noSeGuardo),
      )
    })
  const salirse = (tema: Tema) =>
    conConexion(c.necesitasConexion, () => {
      void yaNoMeInteresa(tema.id).then(
        () => aviso.mostrar(t.tema.saliste(tema.nombre), () => void deshacer(() => meInteresa(tema.id))),
        () => aviso.mostrar(textos.noSeGuardo),
      )
    })
  const borrar = (tema: Tema) => {
    setBorrando(null)
    conConexion(t.grupo.sinRedCambiar, () => {
      void borrarTema(tema.id).then(
        () => {
          navigate('/grupo/intereses', { replace: true })
          aviso.mostrar(t.tema.borraste(tema.nombre), () => void deshacer(() => devolverTema(tema.id)))
        },
        () => aviso.mostrar(textos.noSeGuardo),
      )
    })
  }
  // Borrar no pregunta, salvo que haya eventos que todavía son solo para este tema: se abren a todos
  const pedirBorrar = (tema: Tema) =>
    conConexion(t.grupo.sinRedCambiar, () => (eventosDelTema(tema.id, eventos ?? []).some((e) => soloParaTema(e) && e.fin > ahora()) ? setBorrando(tema) : borrar(tema)))
  const soloPara = borrando ? eventosDelTema(borrando.id, eventos ?? []).filter((e) => soloParaTema(e) && e.fin > ahora()) : []

  const nuevoTema = () => conConexion(t.grupo.sinRedCrear, () => abrir('/grupo/intereses/nuevo'))
  const alTerminar = (tema: Tema) => {
    if (accion === 'editar') volver(`/grupo/intereses/${tema.id}`)
    else if (esComputador) ir(`/grupo/intereses/${tema.id}`, true)
    else volver('/grupo/intereses')
    if (accion !== 'editar') aviso.mostrar(t.grupo.creaste(tema.nombre))
  }

  const panel = nuevo ? (
    <TemaFormulario key="nuevo" computador={esComputador} sinRed={!conectado} onSinRed={() => aviso.mostrar(t.grupo.sinRedCrear)} onCerrar={cerrar} onListo={alTerminar} />
  ) : abierto && editando ? (
    <TemaFormulario
      key={abierto.id}
      computador={esComputador}
      tema={abierto}
      sinRed={!conectado}
      onSinRed={() => aviso.mostrar(t.grupo.sinRedCambiar)}
      onCerrar={() => volver(`/grupo/intereses/${abierto.id}`)}
      onListo={alTerminar}
    />
  ) : elegido ? (
    <TemaDetalle
      key={elegido.id}
      tema={elegido}
      computador={esComputador}
      sinRed={!conectado}
      onAtras={cerrar}
      onEditar={() => conConexion(t.grupo.sinRedCambiar, () => ir(`/grupo/intereses/${elegido.id}/editar`))}
      onBorrar={() => pedirBorrar(elegido)}
      onSumar={() => sumarse(elegido)}
      onSalir={() => salirse(elegido)}
    />
  ) : null

  const hoja = (
    <Hoja abierta={borrando !== null} alerta etiqueta={borrando ? t.tema.borrarPregunta(borrando.nombre) : ''} onCerrar={() => setBorrando(null)}>
      {borrando && (
        <>
          <TituloHoja>{t.tema.borrarPregunta(borrando.nombre)}</TituloHoja>
          <p className={estilos.hojaTexto}>{t.tema.borrarAviso(textos.y(soloPara.map((e) => e.titulo)), soloPara.length > 1, borrando.nombre)}</p>
          <div className={estilos.hojaBotones}>
            <BotonPrincipal peligro onClick={() => borrar(borrando)}>
              {t.tema.borrar}
            </BotonPrincipal>
            <BotonBorde onClick={() => setBorrando(null)}>{textos.cancelar}</BotonBorde>
          </div>
        </>
      )}
    </Hoja>
  )

  // Celular: el tema, nuevo o abierto, ocupa la pantalla
  if (!esComputador && panel) {
    return (
      <>
        {panel}
        {hoja}
        <Aviso texto={aviso.texto} onDeshacer={aviso.deshacer} sobrePie={Boolean(abierto && !editando)} />
      </>
    )
  }
  if (!esComputador && id && !temas) return null

  const vacio = temas?.length === 0
  const sinTemas = (
    <div className={estilos.vacio}>
      <span className={estilos.tuercaVacia} aria-hidden="true" />
      <div className={estilos.vacioTexto}>{t.grupo.vacio}</div>
      <div className={estilos.vacioAyuda}>{t.grupo.vacioAyuda}</div>
      <button type="button" className={estilos.agregar} aria-disabled={!conectado} onClick={nuevoTema}>
        {t.grupo.nuevoTema}
      </button>
    </div>
  )
  const tarjetas = (
    <ListaTemas
      temas={lista}
      interesados={interesados ?? []}
      gente={gente}
      yo={yo.id}
      elegido={esComputador ? elegido?.id : undefined}
      sinRed={!conectado}
      onAbrir={(tema) => abrir(`/grupo/intereses/${tema.id}`)}
      onSumar={sumarse}
    />
  )

  // ---------- Computador ----------
  if (esComputador) {
    return (
      <div className={escritorio.pantalla}>
        <div className={estilos.cabeceraPc}>
          <div className={estilos.tituloFilaPc}>
            <h1 className={escritorio.titulo}>{textos.grupo.titulo}</h1>
            <SegmentoGrupo vista="intereses" />
          </div>
          <div className={estilos.derechaPc}>
            <SinConexion />
            <BotonNuevoTema texto={t.grupo.nuevoTema} apagado={!conectado && !nuevo} activo={nuevo} onClick={() => (nuevo ? cerrar() : nuevoTema())} />
          </div>
        </div>
        <div className={escritorio.cuerpo}>
          <div className={estilos.columnas}>
            <div className={estilos.columna}>{vacio ? sinTemas : tarjetas}</div>
            <div className={estilos.lado}>{panel}</div>
          </div>
        </div>
        {hoja}
        <Aviso texto={aviso.texto} onDeshacer={aviso.deshacer} conPanel />
      </div>
    )
  }

  // ---------- Celular ----------
  return (
    <div className={estilos.celular}>
      <CabeceraCelular vista="intereses" conFicha nuevo={<BotonNuevoTema texto={t.grupo.nuevo} apagado={!conectado} onClick={nuevoTema} />} />
      <div className={estilos.cuerpo}>{vacio ? sinTemas : tarjetas}</div>
      {hoja}
      <Aviso texto={aviso.texto} onDeshacer={aviso.deshacer} />
    </div>
  )
}
