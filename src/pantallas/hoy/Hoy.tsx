import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { Aviso } from '../../componentes/Controles.tsx'
import { EntradaPerfil } from '../../componentes/EntradaPerfil.tsx'
import { InterruptorHoraDeChile, useHoraDeChile } from '../../componentes/HoraDeChile.tsx'
import { Icono } from '../../componentes/Icono.tsx'
import { SinConexion } from '../../componentes/SinConexion.tsx'
import { Tuerca } from '../../componentes/Tuerca.tsx'
import { useAviso } from '../../componentes/useAviso.ts'
import { useEsComputador } from '../../componentes/useEsComputador.ts'
import { estaConectado, useConectado } from '../../datos/conexion.ts'
import { usePersonas } from '../../datos/consultas.ts'
import { useContactos } from '../../datos/contactos.ts'
import { ErrorDeEvento, ir, noIr, useAsistentes, useEventos, useNotasReunion, type Evento } from '../../datos/eventos.ts'
import { conMayuscula, diaEn, diaLargo, diasEntre, hora, hoyAqui, hoyEnCalifornia } from '../../datos/fechas.ts'
import { comoSaldar, conmigo, plata, saldos, useGastos, usePagos, usePartes } from '../../datos/gastos.ts'
import { estaAlla } from '../../datos/grupo.ts'
import { primerNombre } from '../../datos/nombres.ts'
import { useSesion, type Persona } from '../../datos/sesion.tsx'
import { useTextos, type Textos } from '../../textos.ts'
import { DetalleEvento } from '../agenda/DetalleEvento.tsx'
import { ResumenRendicion } from '../gastos/Rendicion.tsx'
import { TarjetaSaldo } from '../gastos/Saldos.tsx'
import { loProximo, momentoDelViaje, porConfirmar, reunionesSinNota, tambienHoy, tuDia, useAhora, type Parada } from './HoyDatos.ts'
import { TambienHoy } from './HoyGrupo.tsx'
import { armarEstaciones, Linea, Paradas, type MarcaAhora } from './HoyLinea.tsx'
import { HojaPendientes, ListaPendientes, pendientesDe } from './HoyPendientes.tsx'
import { AllaHoy, BoletosSinNota, HojaReuniones, ParaCerrar, type Cierre } from './HoyVolver.tsx'
import estilos from './Hoy.module.css'

// La ficha de arriba: el día y, en la tuerca, cuánto falta, qué día del viaje es o hace cuánto volviste
function ficha(persona: Persona, hoy: string, textos: Textos): { fecha: string; detalle: string | null; tuerca: string[] | null } {
  const t = textos.hoy
  const fecha = conMayuscula(diaLargo(hoy))
  const { llega, vuelve } = persona
  if (!llega || !vuelve) return { fecha, detalle: null, tuerca: null }
  if (hoy < llega) return { fecha, detalle: t.llegasEl(diaLargo(llega)), tuerca: t.faltan(diasEntre(hoy, llega) - 1) }
  if (hoy > vuelve) return { fecha, detalle: t.volvisteEl(diaLargo(vuelve)), tuerca: t.hace(diasEntre(vuelve, hoy) - 1) }
  return { fecha, detalle: null, tuerca: t.diaDelViaje(diasEntre(llega, hoy)) }
}

// Antes de llegar: lo próximo y tus pendientes. Durante tu estadía: tu día como línea y lo del grupo al que te puedes sumar.
// Al volver: lo que falta para cerrar el viaje, tus pendientes y cómo sigue el grupo allá.
export function Hoy() {
  const textos = useTextos()
  const sesion = useSesion()
  const navigate = useNavigate()
  const computador = useEsComputador()
  const ahora = useAhora()
  const [chile, setChile] = useHoraDeChile()
  const aviso = useAviso()
  const sinRed = !useConectado()
  const { data: contactos } = useContactos()
  const { data: eventos } = useEventos()
  const { data: asistentes } = useAsistentes()
  const { data: notas } = useNotasReunion()
  const { data: personas } = usePersonas()
  const { data: gastos } = useGastos()
  const { data: partes } = usePartes()
  const { data: pagos } = usePagos()
  const [elegido, setElegido] = useState<string | null>(null)
  const [cierreElegido, setCierreElegido] = useState<Cierre['id']>('notas')
  const [hoja, setHoja] = useState<'pendientes' | 'reuniones' | null>(null)
  const [yendo, setYendo] = useState<string | null>(null)
  if (sesion.tipo !== 'dentro') return null
  const { persona } = sesion
  const t = textos.hoy
  const v = t.viaje
  const hoy = hoyAqui()
  const momento = momentoDelViaje(persona, hoy)
  const durante = momento === 'durante'
  const { fecha, detalle, tuerca } = ficha(persona, hoy, textos)
  const cargado = Boolean(eventos && asistentes)
  const lista = eventos ?? []
  const van = asistentes ?? []

  // Tu día (durante) o lo próximo (antes), como estaciones
  let paradas: Parada[] = []
  let marca: MarcaAhora | null = null
  if (durante) {
    const dia = tuDia(lista, van, persona.id, hoy, ahora)
    paradas = dia.paradas
    marca = { en: dia.ahoraEn, hora: hora(new Date(ahora).toISOString()) }
  } else if (momento === 'antes') {
    paradas = loProximo(lista, van, persona, ahora)
  }
  const estaciones = armarEstaciones(paradas, { textos, durante, chile, ahora, hoyCalifornia: hoyEnCalifornia(), yo: persona.id, asistentes: van, personas: personas ?? [], contactos: contactos ?? [], notas: notas ?? [] })
  const tambien = durante ? tambienHoy(lista, van, persona.id, hoy, ahora) : []
  const sinConfirmar = durante || momento === 'antes' ? porConfirmar(lista, van, persona, ahora, durante ? hoy : null) : []
  const pendientes = pendientesDe(persona, contactos ?? [], sinConfirmar, textos, navigate)
  const sinNota = momento === 'despues' ? reunionesSinNota(lista, van, notas ?? [], persona.id, ahora) : []

  // Para cerrar tu viaje: las notas que faltan, lo que debes transferir y elegir qué gastos rindes
  const cierres: Cierre[] = []
  if (momento === 'despues') {
    if (sinNota.length > 0) cierres.push({ id: 'notas', icono: 'lapiz', texto: v.escribeNotas(sinNota.length) })
    const grupo = (personas ?? []).filter((p) => !p.sacada_en).map((p) => p.id)
    const debes = gastos && partes && pagos ? comoSaldar(saldos(gastos, partes, pagos, grupo)).filter((x) => x.de === persona.id) : []
    if (debes.length === 1) {
      const a = (personas ?? []).find((p) => p.id === debes[0].a)
      cierres.push({ id: 'pago', icono: 'transferir', texto: v.transfiere(plata(debes[0].monto), a ? primerNombre(a) : '') })
    } else if (debes.length > 1) {
      cierres.push({ id: 'pago', icono: 'transferir', texto: v.transfiereVarios(plata(debes.reduce((suma, x) => suma + x.monto, 0)), debes.length) })
    }
    if ((gastos ?? []).some((g) => conmigo(g, partes ?? [], persona.id).tipo !== 'noparticipas')) cierres.push({ id: 'rendir', icono: 'gastos', texto: v.eligeRendir })
  }
  const cierre = cierres.find((c) => c.id === cierreElegido)?.id ?? (computador && cierreElegido === 'pago' ? 'pago' : cierres[0]?.id)

  // Allá hoy: los que siguen allá y los eventos del día en California
  const diaAlla = hoyEnCalifornia()
  const siguen = (personas ?? []).filter((p) => !p.sacada_en && p.id !== persona.id && estaAlla(p, diaAlla)).length
  const eventosAlla = lista.filter((e) => diaEn(e.inicio) === diaAlla).length

  // En el computador, la parada elegida muestra su boleto al lado (si no eliges, la próxima)
  const visibles = [...paradas.map((p) => p.evento.id), ...tambien.map((e) => e.id)]
  const porDefecto = (paradas.find((p) => p.estado === 'proxima') ?? paradas.find((p) => p.estado === 'enCurso') ?? paradas.at(-1))?.evento.id ?? tambien[0]?.id ?? null
  const idElegido = elegido && visibles.includes(elegido) ? elegido : porDefecto
  const eventoElegido = lista.find((e) => e.id === idElegido)

  // El boleto sabe que vienes de Hoy (para volver aquí) y si vienes a escribir la nota
  const abrir = (id: string) => (computador ? setElegido(id) : navigate(`/agenda/${id}`, { state: { desde: 'hoy' } }))
  const escribirNota = (id: string) => navigate(`/agenda/${id}`, { state: { desde: 'hoy', abrir: 'nota' } })
  const abrirCierre = (id: Cierre['id']) => {
    if (computador) setCierreElegido(id)
    else if (id === 'pago') navigate('/gastos', { state: { ver: 'saldos' } })
    else if (id === 'rendir') navigate('/gastos', { state: { ver: 'rendicion' } })
    else if (sinNota.length === 1) escribirNota(sinNota[0].id)
    else setHoja('reuniones')
  }
  const sumarme = async (evento: Evento) => {
    if (!estaConectado()) return aviso.mostrar(v.sinRedVoy)
    setYendo(evento.id)
    try {
      await ir(evento.id)
      aviso.mostrar(evento.modo === 'para_todos' ? v.vasA(evento.titulo) : v.tomaste, () => void noIr(evento.id).catch(() => aviso.mostrar(v.noSePudoIr.otro)))
    } catch (error) {
      aviso.mostrar(v.noSePudoIr[error instanceof ErrorDeEvento ? error.motivo : 'otro'])
    } finally {
      setYendo(null)
    }
  }

  const conHoras = estaciones.length > 0 || tambien.length > 0
  const seccionLinea = (durante || momento === 'antes') && (
    <section className={estilos.seccion} aria-labelledby="hoy-linea">
      <div className={estilos.cabecera}>
        <h2 id="hoy-linea" className={estilos.cinta}>
          {durante ? v.tuDia : v.loProximo}
        </h2>
        {conHoras && <InterruptorHoraDeChile activo={chile} onCambio={setChile} />}
      </div>
      {cargado &&
        (estaciones.length === 0 ? (
          <div>
            <p className={estilos.vacio}>{durante ? v.sinEventos : v.sinProximos}</p>
            <button type="button" className={estilos.verAgenda} onClick={() => navigate('/agenda')}>
              {v.verAgenda}
            </button>
          </div>
        ) : computador ? (
          <Paradas estaciones={estaciones} ahora={marca} elegida={idElegido} onElegir={setElegido} />
        ) : (
          <Linea estaciones={estaciones} ahora={marca} grande={durante} onAbrir={abrir} onNota={escribirNota} />
        ))}
    </section>
  )
  const seccionTambien = tambien.length > 0 && (
    <section className={estilos.seccion} aria-labelledby="hoy-tambien">
      {sinRed && <p className={estilos.notaRed}>{v.sinRedVoy}</p>}
      <h2 id="hoy-tambien" className={estilos.cinta}>
        {v.tambienHoy}
      </h2>
      <TambienHoy eventos={tambien} asistentes={van} yo={persona.id} chile={chile} computador={computador} elegido={idElegido} yendo={yendo} onAbrir={abrir} onVoy={(e) => void sumarme(e)} />
    </section>
  )
  const seccionPendientes = (
    <section className={`${estilos.seccion} ${momento === 'sinFechas' ? estilos.primera : ''}`} aria-labelledby="hoy-pendientes">
      <h2 id="hoy-pendientes" className={estilos.cinta}>
        {t.pendientes}
      </h2>
      <ListaPendientes pendientes={pendientes.lista} />
    </section>
  )
  const tituloCerrar = (
    <h2 id="hoy-cerrar" className={estilos.cinta}>
      {v.paraCerrar}
    </h2>
  )
  const seccionCerrar = cierres.length > 0 && (
    <section className={estilos.seccion} aria-labelledby="hoy-cerrar">
      {computador ? <div className={estilos.cabecera}>{tituloCerrar}</div> : tituloCerrar}
      <ParaCerrar cierres={cierres} computador={computador} elegido={cierre ?? 'notas'} onElegir={abrirCierre} />
    </section>
  )
  const seccionAlla = momento === 'despues' && siguen > 0 && (
    <section className={estilos.seccion} aria-labelledby="hoy-alla">
      <h2 id="hoy-alla" className={estilos.cinta}>
        {v.allaHoy}
      </h2>
      <AllaHoy personas={siguen} eventos={eventosAlla} onAbrir={() => navigate('/grupo')} />
    </section>
  )

  let secciones: ReactNode = seccionPendientes
  if (momento === 'despues')
    secciones = (
      <>
        {seccionCerrar}
        {seccionPendientes}
        {seccionAlla}
      </>
    )
  else if (durante)
    secciones = (
      <>
        {seccionLinea}
        {seccionTambien}
      </>
    )
  else if (momento === 'antes')
    secciones = (
      <>
        {seccionLinea}
        {seccionPendientes}
      </>
    )

  // Durante el viaje los pendientes van resumidos en una línea de la ficha, que abre la lista en una hoja.
  // En el celular es una fila bajo la ficha; en el computador va bajo la fecha.
  const resumen = durante ? pendientes.resumen : null
  const botonResumen = resumen && (
    <button type="button" className={estilos.resumenBoton} aria-haspopup="dialog" onClick={() => setHoja('pendientes')}>
      <span className={estilos.punto} aria-hidden="true" />
      <span className={estilos.resumenTexto}>{resumen}</span>
      <Icono nombre="derecha" medida={16} trazo={2} />
    </button>
  )
  const cabeza = (
    <header className={estilos.ficha} data-fila={Boolean(resumen) && !computador}>
      <div className={estilos.fichaFila}>
        <div className={estilos.fichaTexto}>
          <h1 className={estilos.titulo}>{t.titulo}</h1>
          <p className={estilos.fecha}>{fecha}</p>
          {detalle && <p className={estilos.detalle}>{detalle}</p>}
          {computador && botonResumen && <div className={estilos.resumenPc}>{botonResumen}</div>}
          {sinRed && !computador && (
            <div className={estilos.sinRed}>
              <SinConexion sobrePanel />
            </div>
          )}
        </div>
        {computador && <SinConexion sobrePanel />}
        {tuerca && (
          <div className={estilos.tuerca}>
            <Tuerca ancho={104} />
            <span className={estilos.cuenta}>
              <span className={estilos.chico}>{tuerca[0]}</span>
              <span className={estilos.numero}>{tuerca[1]}</span>
              <span className={estilos.chico}>{tuerca[2]}</span>
            </span>
          </div>
        )}
        {!computador && (
          <div className={estilos.perfil}>
            <EntradaPerfil />
          </div>
        )}
      </div>
      {!computador && botonResumen && <div className={estilos.resumen}>{botonResumen}</div>}
    </header>
  )

  if (computador) {
    const lado =
      momento === 'despues' ? (
        cierre === 'notas' ? (
          <BoletosSinNota reuniones={sinNota} contactos={contactos ?? []} onNota={escribirNota} />
        ) : cierre === 'pago' ? (
          <TarjetaSaldo computador />
        ) : cierre === 'rendir' ? (
          <ResumenRendicion onPreparar={() => navigate('/gastos', { state: { ver: 'rendicion' } })} />
        ) : null
      ) : eventoElegido ? (
        <DetalleEvento evento={eventoElegido} computador onCerrar={() => setElegido(null)} />
      ) : null
    return (
      <div className={estilos.hoy}>
        {cabeza}
        <div className={estilos.cuerpo}>
          <div className={estilos.columnas}>
            <div className={estilos.izquierda}>{secciones}</div>
            <div className={estilos.derecha}>{lado}</div>
          </div>
        </div>
        <HojaPendientes abierta={hoja === 'pendientes'} pendientes={pendientes.lista} onCerrar={() => setHoja(null)} />
        <Aviso texto={aviso.texto} onDeshacer={aviso.deshacer} conPanel />
      </div>
    )
  }

  return (
    <div className={estilos.hoy}>
      {cabeza}
      {secciones}
      <HojaPendientes abierta={hoja === 'pendientes'} pendientes={pendientes.lista} onCerrar={() => setHoja(null)} />
      <HojaReuniones abierta={hoja === 'reuniones'} reuniones={sinNota} onNota={escribirNota} onCerrar={() => setHoja(null)} />
      <Aviso texto={aviso.texto} onDeshacer={aviso.deshacer} />
    </div>
  )
}
