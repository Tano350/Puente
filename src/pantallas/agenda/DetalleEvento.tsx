import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Atras, Aviso, BotonBorde, BotonPrincipal, Hoja, TituloHoja } from '../../componentes/Controles.tsx'
import { ElegirPersona } from '../../componentes/ElegirPersona.tsx'
import { useHoraDeChile } from '../../componentes/HoraDeChile.tsx'
import { Icono } from '../../componentes/Icono.tsx'
import { PantallaConPie } from '../../componentes/Paneles.tsx'
import { useAviso } from '../../componentes/useAviso.ts'
import { consultas, usePersonas, type Persona } from '../../datos/consultas.ts'
import { SinConexion } from '../../componentes/SinConexion.tsx'
import { useConectado } from '../../datos/conexion.ts'
import { useContactos } from '../../datos/contactos.ts'
import {
  asistentesDe,
  enlaceMapa,
  ErrorDeEvento,
  esperar,
  estaAllaEse,
  guardarNotaReunion,
  ir,
  miLugar,
  noIr,
  sacarDeEvento,
  sumarAEvento,
  useAsistentes,
  useNotasReunion,
  type Evento,
} from '../../datos/eventos.ts'
import { ahora, CHILE, conMayuscula, diaDeLaSemana, diaEn, diaLargo, hora } from '../../datos/fechas.ts'
import { primerNombre } from '../../datos/nombres.ts'
import { useSesion } from '../../datos/sesion.tsx'
import { useTextos, type Textos } from '../../textos.ts'
import { EventoBoleto, type Talon } from './EventoBoleto.tsx'
import { EventoNotas, type Borrador } from './EventoNotas.tsx'
import { EventoQuienes } from './EventoQuienes.tsx'
import estilos from './DetalleEvento.module.css'

// "atras" nombra a dónde vuelve (Agenda si no se dice); "conNota" abre directo la nota, si fuiste y ya pasó.
// Con "onEditar" (quien organiza o administra) va "Editar" arriba.
type Props = { evento: Evento; computador: boolean; atras?: string; conNota?: boolean; onCerrar: () => void; onEditar?: () => void }

// Tu estado en el evento: lo que dicen el talón y la barra de abajo
type Estado =
  | { tipo: 'paso'; fui: boolean }
  | { tipo: 'tienes' }
  | { tipo: 'vas' }
  | { tipo: 'espera'; puesto: number }
  | { tipo: 'fuera'; cuando: 'antes' | 'despues' | 'sinFechas' }
  | { tipo: 'cerrada' }
  | { tipo: 'voy' }
  | { tipo: 'lleno' }
  | { tipo: 'hay' }

function estadoDe(evento: Evento, van: number, lugar: ReturnType<typeof miLugar>, yo: Persona): Estado {
  if (Date.parse(evento.fin) < Date.parse(ahora())) return { tipo: 'paso', fui: lugar?.estado === 'va' }
  if (lugar?.estado === 'va') return { tipo: evento.modo === 'con_cupo' ? 'tienes' : 'vas' }
  if (lugar?.estado === 'espera') return { tipo: 'espera', puesto: lugar.puesto }
  if (!estaAllaEse(yo, evento.inicio)) {
    if (!yo.llega || !yo.vuelve) return { tipo: 'fuera', cuando: 'sinFechas' }
    return { tipo: 'fuera', cuando: diaEn(evento.inicio) < yo.llega ? 'antes' : 'despues' }
  }
  if (evento.modo === 'cerrado') return { tipo: 'cerrada' }
  if (evento.modo === 'para_todos') return { tipo: 'voy' }
  return evento.cupos !== null && van >= evento.cupos ? { tipo: 'lleno' } : { tipo: 'hay' }
}

function talonDe(estado: Estado, evento: Evento, van: number, espera: number, t: Textos['agenda']['evento']): Talon {
  const cupos = evento.cupos ?? van
  switch (estado.tipo) {
    case 'paso':
      return { arriba: t.yaPaso[0], abajo: t.yaPaso[1] }
    case 'fuera':
      return { arriba: t.noEstas[0], abajo: t.noEstas[1] }
    case 'tienes':
      return { arriba: t.tuCupo, marca: 'check', abajo: t.deTotal(van, cupos) }
    case 'vas':
      return { arriba: t.vas, marca: 'check', abajo: van > 1 ? t.conMas(van - 1) : '' }
    case 'espera':
      return { arriba: t.enEsperaArriba, grande: t.puesto(estado.puesto), abajo: t.enLaLista }
    case 'cerrada':
      return { arriba: '', marca: 'candado', abajo: t.cerrada }
    case 'voy':
      return { arriba: t.van(van), grande: String(van), abajo: t.delGrupo }
    case 'lleno':
      return { arriba: t.lleno, grande: String(espera), abajo: t.enEspera }
    case 'hay': {
      const [arriba, abajo] = t.quedan(cupos - van)
      return { arriba, grande: String(cupos - van), abajo }
    }
  }
}

// El "Boleto" de un evento: el boleto con tu estado en el talón, el lugar con "Cómo llegar", los cupos como
// asientos, quién organiza y sus notas, las notas de reunión y la acción (o tu estado) abajo.
// En el celular ocupa la pantalla ("Agenda" vuelve); en el computador va en la columna al lado de la semana
// (o de Hoy), sin cromo propio. Muestra sus propios avisos.
export function DetalleEvento(props: Props) {
  // Cada evento parte de cero: sin confirmación ni nota a medio escribir
  return <Boleto key={props.evento.id} {...props} />
}

function Boleto({ evento, computador, atras, conNota, onCerrar, onEditar }: Props) {
  const textos = useTextos()
  const sesion = useSesion()
  const { data: asistentes } = useAsistentes()
  const { data: personas } = usePersonas()
  const { data: contactos } = useContactos()
  const { data: notas } = useNotasReunion()
  const [horaDeChile] = useHoraDeChile()
  const aviso = useAviso()
  const sinRed = !useConectado()
  const [confirmar, setConfirmar] = useState<'soltar' | 'dejar' | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const enCurso = useRef(false)
  const [borrador, setBorrador] = useState<Borrador | null>(null)
  const [cambiando, setCambiando] = useState(false)
  const [agregando, setAgregando] = useState(false)
  // En el computador la pregunta va en el lugar del botón: se ve entera, el foco entra a ella y vuelve al cerrarla
  const acciones = useRef<HTMLDivElement>(null)
  const primeraRespuesta = useRef<HTMLButtonElement>(null)
  const botonEstado = useRef<HTMLButtonElement>(null)
  const devolverFoco = useRef(false)
  useEffect(() => {
    if (!computador) return
    if (confirmar) {
      primeraRespuesta.current?.focus({ preventScroll: true })
      acciones.current?.scrollIntoView({ block: 'nearest' })
    } else if (devolverFoco.current) botonEstado.current?.focus()
    devolverFoco.current = false
  }, [confirmar, computador])
  // Desde "Escribir nota" en Hoy o en el contacto, la nota se abre sola en cuanto se sabe que fuiste
  const notaPedida = useRef(conNota)
  useEffect(() => {
    if (!notaPedida.current || !notas || !asistentes || sesion.tipo !== 'dentro') return
    notaPedida.current = false
    const mia = sesion.persona.id
    if (Date.parse(evento.fin) >= Date.parse(ahora()) || miLugar(evento.id, asistentes, mia)?.estado !== 'va') return
    const escrita = notas.find((n) => n.evento === evento.id && n.autor === mia)
    setBorrador({ aprendi: escrita?.aprendi ?? '', sigue: escrita?.sigue ?? '' })
  }, [notas, asistentes, sesion, evento])
  // Al escribir la nota, las preguntas y "Guardar nota" quedan a la vista
  const escribiendo = borrador !== null
  useEffect(() => {
    if (computador && escribiendo) acciones.current?.scrollIntoView({ block: 'nearest' })
  }, [computador, escribiendo])
  if (sesion.tipo !== 'dentro') return null
  const yo = sesion.persona
  const t = textos.agenda.evento

  const { van, espera } = asistentesDe(evento.id, asistentes ?? [])
  const lugar = miLugar(evento.id, asistentes ?? [], yo.id)
  const estado = asistentes ? estadoDe(evento, van.length, lugar, yo) : null
  const pasado = estado?.tipo === 'paso'
  // Quien administra solo ayuda con los cerrados, donde nadie más puede sumar gente
  const puedeCambiar = evento.organizador === yo.id || (yo.administra && evento.modo === 'cerrado')
  const persona = (id: string | null) => (id ? personas?.find((p) => p.id === id) : undefined)
  const nombreDe = (id: string) => {
    if (id === yo.id) return t.tuMinuscula
    const p = persona(id)
    return p ? primerNombre(p) : ''
  }
  const organizador = persona(evento.organizador)
  const soloAgrega = evento.organizador === yo.id ? t.soloAgregas : organizador ? t.soloAgrega(primerNombre(organizador)) : t.soloQuienOrganiza
  const contacto = evento.contacto ? contactos?.find((c) => c.id === evento.contacto) : undefined
  const miNota = notas?.find((n) => n.evento === evento.id && n.autor === yo.id)

  // ---------- Acciones ----------
  const mensajeDe = (error: unknown, siLleno: string): string => {
    if (!(error instanceof ErrorDeEvento)) return textos.noSeGuardo
    if (error.motivo === 'lleno') return siLleno
    if (error.motivo === 'no_estas') return t.noEstasAlla
    if (error.motivo === 'cerrado') return soloAgrega
    if (error.motivo === 'paso') return t.paso
    return textos.noSeGuardo
  }
  // Una cosa a la vez; si falla, el aviso dice por qué y se ve cómo quedó el evento
  const hacer = async (accion: () => Promise<void>, siLleno = t.seLleno) => {
    if (enCurso.current) return
    enCurso.current = true
    setOcupado(true)
    try {
      await accion()
    } catch (error) {
      aviso.mostrar(mensajeDe(error, siLleno))
      void consultas.invalidateQueries({ queryKey: ['asistentes'] })
    } finally {
      enCurso.current = false
      setOcupado(false)
    }
  }
  const conDeshacer = (accion: () => Promise<unknown>, siLleno?: string) => () => {
    aviso.cerrar()
    void hacer(async () => {
      await accion()
    }, siLleno)
  }

  const tomar = () =>
    void hacer(async () => {
      await ir(evento.id)
      aviso.mostrar(t.tomaste, conDeshacer(() => noIr(evento.id)))
    })
  const voy = () => void hacer(() => ir(evento.id))
  const anotarme = () =>
    void hacer(async () => {
      const puesto = await esperar(evento.id)
      aviso.mostrar(t.quedaste(puesto), conDeshacer(() => noIr(evento.id)))
    })
  const salirDeLaLista = () => void hacer(() => noIr(evento.id))
  // Si alguien espera, el cupo pasa al tiro a esa persona: ahí ya no se puede deshacer
  const siguiente = espera[0]
  const soltar = () => {
    setConfirmar(null)
    void hacer(async () => {
      await noIr(evento.id)
      if (siguiente) aviso.mostrar(t.loTomo(nombreDe(siguiente.persona)))
      else aviso.mostrar(t.soltaste, conDeshacer(() => ir(evento.id), t.loTomaron))
    })
  }
  // En uno cerrado, volver depende de quien organiza: si no eres tú, se pregunta antes
  const yaNoVoy = () => {
    if (evento.modo !== 'cerrado') return void hacer(() => noIr(evento.id))
    if (!puedeCambiar) return setConfirmar('dejar')
    void hacer(async () => {
      await noIr(evento.id)
      aviso.mostrar(t.yaNoVas, conDeshacer(() => sumarAEvento(evento.id, yo.id)))
    })
  }
  const dejar = () => {
    setConfirmar(null)
    void hacer(async () => {
      await noIr(evento.id)
      aviso.mostrar(t.yaNoVas)
    })
  }
  const mantener = () => {
    devolverFoco.current = true
    setConfirmar(null)
  }

  // Quien organiza suma o saca gente; si quien suma estaba esperando, deshacer lo sacaría de la lista
  const agregar = (elegida: Persona) => {
    setAgregando(false)
    const antes = asistentes?.find((a) => a.evento === evento.id && a.persona === elegida.id)
    const tu = elegida.id === yo.id
    if (antes?.estado === 'va') return aviso.mostrar(tu ? t.yaVas : t.yaVa(primerNombre(elegida)))
    void hacer(async () => {
      await sumarAEvento(evento.id, elegida.id)
      aviso.mostrar(tu ? t.teAgregaste : t.agregaste(primerNombre(elegida)), antes ? undefined : conDeshacer(() => sacarDeEvento(evento.id, elegida.id)))
    })
  }
  const sacar = (id: string) =>
    void hacer(async () => {
      await sacarDeEvento(evento.id, id)
      aviso.mostrar(t.sacaste(nombreDe(id)), conDeshacer(() => sumarAEvento(evento.id, id, { avisar: false })))
    })

  const abrirNota = () => setBorrador({ aprendi: miNota?.aprendi ?? '', sigue: miNota?.sigue ?? '' })
  const notaVacia = !borrador || (!borrador.aprendi.trim() && !borrador.sigue.trim())
  const guardarNota = () => {
    if (!borrador || notaVacia) return
    void hacer(async () => {
      await guardarNotaReunion(yo.id, evento.id, { aprendi: borrador.aprendi.trim() || null, sigue: borrador.sigue.trim() || null })
      setBorrador(null)
      aviso.mostrar(t.guardasteNota)
    })
  }

  // ---------- La acción de abajo (o tu estado) ----------
  // Sin conexión, lo que cambia tu lugar queda apagado y una nota debajo dice por qué
  const nota = (texto: string) => <p className={estilos.notaRed}>{texto}</p>
  const enEstado = (icono: 'check' | 'reloj', texto: string, boton: string, onClick: () => void, sinConexion: string) => (
    <>
      <div className={estilos.estado}>
        <span className={estilos.estadoTexto}>
          <span className={icono === 'check' ? estilos.check : estilos.reloj}>
            {icono === 'check' ? <Icono nombre="check" medida={20} trazo={2.5} /> : <Icono nombre="reloj" medida={20} trazo={2} />}
          </span>
          {texto}
        </span>
        <button ref={botonEstado} type="button" className={estilos.botonEstado} aria-disabled={ocupado || sinRed} onClick={() => !ocupado && !sinRed && onClick()}>
          {boton}
        </button>
      </div>
      {sinRed && nota(sinConexion)}
    </>
  )
  const info = (texto: string) => <div className={estilos.info}>{texto}</div>
  let accion: ReactNode = null
  if (borrador) {
    accion = (
      <div className={estilos.botones}>
        <BotonPrincipal apagado={notaVacia} ocupado={ocupado} onClick={guardarNota}>
          {t.guardarNota}
        </BotonPrincipal>
        <BotonBorde onClick={() => setBorrador(null)}>{textos.cancelar}</BotonBorde>
      </div>
    )
  } else if (estado?.tipo === 'paso') {
    if (estado.fui) accion = <BotonPrincipal onClick={abrirNota}>{miNota ? t.editarNota : t.escribirNota}</BotonPrincipal>
  } else if (estado?.tipo === 'tienes') {
    accion = enEstado('check', t.tienesCupo, t.soltarCupo, () => setConfirmar('soltar'), t.sinRedSoltar)
  } else if (estado?.tipo === 'vas') {
    accion = enEstado('check', t.vas, t.yaNoVoy, yaNoVoy, t.sinRedYaNoVoy)
  } else if (estado?.tipo === 'espera') {
    accion = enEstado('reloj', t.estasEnLista(estado.puesto), t.salir, salirDeLaLista, t.sinRedSalir)
  } else if (estado?.tipo === 'fuera') {
    accion = info(estado.cuando === 'antes' ? t.todaviaNoLlegas : estado.cuando === 'despues' ? t.yaVolviste : t.sinFechas)
  } else if (estado?.tipo === 'cerrada') {
    accion = info(soloAgrega)
  } else if (estado) {
    const principal = {
      voy: [t.voy, voy, t.sinRedVoy],
      lleno: [t.anotarme, anotarme, t.sinRedLista],
      hay: [t.tomarCupo, tomar, t.sinRedTomar],
    } as const
    const [texto, alTocar, sinConexion] = principal[estado.tipo]
    accion = (
      <>
        <BotonPrincipal apagado={sinRed} ocupado={ocupado} onClick={alTocar}>
          {texto}
        </BotonPrincipal>
        {sinRed && nota(sinConexion)}
      </>
    )
  }

  // Antes de soltar el cupo (o de dejar uno cerrado sin poder volver solo)
  const pregunta =
    confirmar === 'soltar'
      ? { titulo: t.soltarPregunta(evento.titulo), explica: siguiente ? t.loToma(nombreDe(siguiente.persona)) : t.quedaLibre, si: t.soltarCupo, no: t.mantener, alConfirmar: soltar }
      : confirmar === 'dejar'
        ? { titulo: t.dejarPregunta(evento.titulo), explica: t.soloTeSuma(organizador ? primerNombre(organizador) : null), si: t.yaNoVoy, no: textos.cancelar, alConfirmar: dejar }
        : null

  // ---------- El boleto ----------
  let chile: string | null = null
  if (horaDeChile) {
    const horario = t.horario(hora(evento.inicio, CHILE), hora(evento.fin, CHILE))
    const dia = diaEn(evento.inicio, CHILE)
    chile = textos.agenda.enChile(dia === diaEn(evento.inicio) ? horario : t.delDia(horario, diaDeLaSemana(dia)))
  }
  const destino = evento.direccion ?? evento.lugar
  const verMapa = destino && !pasado && estado?.tipo !== 'fuera'
  // Lo que organizaste y ya pasó, sin notas, no dice nada nuevo
  const verOrganiza = Boolean((organizador && (evento.organizador !== yo.id || !pasado)) || evento.notas)

  const cuerpo = (
    <>
      <div className={estilos.boleto}>
        <EventoBoleto
          tipo={textos.agenda.tipos[evento.tipo]}
          titulo={evento.titulo}
          fecha={conMayuscula(diaLargo(diaEn(evento.inicio)))}
          horario={t.horario(hora(evento.inicio), hora(evento.fin))}
          chile={chile}
          talon={estado && talonDe(estado, evento, van.length, espera.length, t)}
          encabezado={computador ? 'h2' : 'h1'}
        />
      </div>
      {(evento.lugar || evento.direccion) && (
        <div className={estilos.lugar}>
          <span className={estilos.lugarIcono}>
            <Icono nombre="lugar" medida={20} />
          </span>
          <span className={estilos.lugarTexto}>
            <span className={estilos.lugarNombre}>{evento.lugar ?? evento.direccion}</span>
            {evento.lugar && evento.direccion && <span className={estilos.direccion}>{evento.direccion}</span>}
          </span>
          {verMapa && (
            <a className={estilos.mapa} href={enlaceMapa(destino)} target="_blank" rel="noreferrer">
              {!computador && <Icono nombre="ruta" medida={16} trazo={2} />}
              {t.comoLlegar}
            </a>
          )}
        </div>
      )}
      <EventoQuienes
        evento={evento}
        pasado={pasado}
        van={van}
        espera={espera}
        yo={yo.id}
        nombreDe={nombreDe}
        contacto={contacto}
        computador={computador}
        puedeCambiar={puedeCambiar}
        cambiando={cambiando}
        ocupado={ocupado}
        sinRed={sinRed}
        onCambiando={setCambiando}
        onAgregar={() => setAgregando(true)}
        onSacar={sacar}
      />
      {verOrganiza && (
        <div className={estilos.organiza}>
          {organizador && <div className={estilos.organizaQuien}>{evento.organizador === yo.id ? t.organizasTu : t.organiza(organizador.nombre ?? primerNombre(organizador))}</div>}
          {evento.notas && <p className={estilos.organizaNotas}>{evento.notas}</p>}
        </div>
      )}
      {pasado && <EventoNotas evento={evento.id} yo={yo.id} borrador={borrador} computador={computador} onBorrador={setBorrador} onGuardar={guardarNota} />}
      <ElegirPersona abierta={agregando} titulo={t.agregarPersona} onElegir={agregar} onCerrar={() => setAgregando(false)} />
    </>
  )

  // En el celular, arriba a la derecha; en el computador, arriba de la columna
  const editar = onEditar && (
    <button type="button" className={computador ? estilos.editarPc : estilos.editar} onClick={onEditar}>
      <Icono nombre="lapiz" medida={18} trazo={2} />
      {textos.agenda.editar.editar}
    </button>
  )

  // ---------- Computador ----------
  if (computador) {
    return (
      <div className={estilos.pc}>
        <div className={estilos.arribaPc}>
          {editar}
          <SinConexion sobrePanel />
        </div>
        {cuerpo}
        {(accion || pregunta) && (
          <div ref={acciones} className={estilos.acciones}>
            {pregunta ? (
              <div
                role="alertdialog"
                aria-labelledby={`pregunta-${evento.id}`}
                aria-describedby={`explica-${evento.id}`}
                className={estilos.pregunta}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') mantener()
                }}
              >
                <div id={`pregunta-${evento.id}`} className={estilos.preguntaTitulo}>
                  {pregunta.titulo}
                </div>
                <p id={`explica-${evento.id}`} className={estilos.preguntaExplica}>
                  {pregunta.explica}
                </p>
                <div className={estilos.preguntaBotones}>
                  <button ref={primeraRespuesta} type="button" className={estilos.si} onClick={pregunta.alConfirmar}>
                    {pregunta.si}
                  </button>
                  <button type="button" className={estilos.no} onClick={mantener}>
                    {pregunta.no}
                  </button>
                </div>
              </div>
            ) : (
              accion
            )}
          </div>
        )}
        <Aviso texto={aviso.texto} onDeshacer={aviso.deshacer} conPanel />
      </div>
    )
  }

  // ---------- Celular ----------
  return (
    <PantallaConPie pie={accion}>
      <div className={estilos.cabecera}>
        <Atras texto={atras ?? textos.agenda.titulo} onClick={onCerrar} />
        <div className={estilos.derecha}>
          <SinConexion />
          {editar}
        </div>
      </div>
      {cuerpo}
      <Hoja abierta={pregunta !== null} etiqueta={pregunta?.titulo ?? ''} alerta onCerrar={() => setConfirmar(null)}>
        {pregunta && (
          <>
            <TituloHoja>{pregunta.titulo}</TituloHoja>
            <p className={estilos.explica}>{pregunta.explica}</p>
            <div className={estilos.hojaBotones}>
              <button type="button" className={estilos.soltar} onClick={pregunta.alConfirmar}>
                {pregunta.si}
              </button>
              <BotonBorde onClick={() => setConfirmar(null)}>{pregunta.no}</BotonBorde>
            </div>
          </>
        )}
      </Hoja>
      <Aviso texto={aviso.texto} onDeshacer={aviso.deshacer} sobrePie={Boolean(accion)} />
    </PantallaConPie>
  )
}
