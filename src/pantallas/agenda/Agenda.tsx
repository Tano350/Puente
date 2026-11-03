import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router'
import { Aviso } from '../../componentes/Controles.tsx'
import { InterruptorHoraDeChile, useHoraDeChile } from '../../componentes/HoraDeChile.tsx'
import { Icono } from '../../componentes/Icono.tsx'
import { useAviso } from '../../componentes/useAviso.ts'
import { useEsComputador } from '../../componentes/useEsComputador.ts'
import { consultas, usePersonas } from '../../datos/consultas.ts'
import { cambiarContacto, useContactos, type Contacto } from '../../datos/contactos.ts'
import { borrarEvento, ErrorDeEvento, ir as irAlEvento, noIr, useAsistentes, useEventos, useOcupados, type Evento } from '../../datos/eventos.ts'
import { conMayuscula, diaEn, diaLargo, rango } from '../../datos/fechas.ts'
import { primerNombre } from '../../datos/nombres.ts'
import { useSesion } from '../../datos/sesion.tsx'
import { useTextos } from '../../textos.ts'
import { armarPiezas, deLosQueVoy, diaInicial, diasDe, mover, porDia, puedeMover, semanaDe, tituloMes, useAhora, type PiezaEvento, type Vista } from './AgendaDatos.ts'
import { AgendaDia } from './AgendaDia.tsx'
import { AgendaMes } from './AgendaMes.tsx'
import { AgendaSemana } from './AgendaSemana.tsx'
import { CrearEvento } from './CrearEvento.tsx'
import { DetalleEvento } from './DetalleEvento.tsx'
import { VistaFranja } from './VistaFranja.tsx'
import estilos from './Agenda.module.css'

const VISTAS: Vista[] = ['dia', 'semana', 'mes']

// Agenda: Día, Semana y Mes, con "Todo" o "A los que voy".
// Rutas: /agenda, /agenda/nuevo (con { contacto } en el estado si sale de un contacto) y /agenda/:id.
// En el celular el evento y "Nuevo" ocupan la pantalla; en el computador van en la columna al lado de la vista.
export function Agenda() {
  const textos = useTextos()
  const tv = textos.agenda.vista
  const sesion = useSesion()
  const navigate = useNavigate()
  const location = useLocation()
  const { id } = useParams()
  const esComputador = useEsComputador()
  const eventos = useEventos()
  const { data: asistentes } = useAsistentes()
  const { data: ocupados } = useOcupados()
  const { data: personas } = usePersonas()
  const { data: contactos } = useContactos()
  const aviso = useAviso()
  const [chile, setChile] = useHoraDeChile()
  const ahora = useAhora()
  // Sin elegir, el celular abre en Día y el computador en Semana
  const [vistaElegida, setVista] = useState<Vista | null>(null)
  const [soloVoy, setSoloVoy] = useState(false)
  // El día que se mira: la semana y el mes son los que lo contienen
  const [ancla, setAncla] = useState<string | null>(null)
  const [siguiendo, setSiguiendo] = useState<string | null>(null)
  const [contactoAntes, setContactoAntes] = useState<Contacto | null>(null)
  const [pendiente, setPendiente] = useState<string | null>(null)
  const pestanas = useRef<(HTMLButtonElement | null)[]>([])
  // Un evento abierto desde Hoy o desde un contacto vuelve allá ("abrir: 'nota'" viene de "Escribir nota")
  const estado = location.state as { desdeAqui?: boolean; contacto?: string; desde?: 'hoy' | 'contactos'; abrir?: 'nota' } | null
  const desdeAqui = estado?.desdeAqui === true || estado?.desde !== undefined
  // Dónde está la pantalla al tocar "Deshacer" (el aviso dura más que la pantalla en que apareció)
  const actual = useRef({ id, desdeAqui })
  useEffect(() => {
    actual.current = { id, desdeAqui }
  })
  if (sesion.tipo !== 'dentro') return null
  const yo = sesion.persona

  const hoy = diaEn(ahora)
  const vista = vistaElegida ?? (esComputador ? 'semana' : 'dia')
  const dia = ancla ?? diaInicial(yo, hoy)
  const lista = eventos.data
  const abierto = id && id !== 'nuevo' ? lista?.find((e) => e.id === id) : undefined
  const desdeContacto = contactos?.find((c) => c.id === estado?.contacto)

  // Un evento que se abre fuera de lo que se ve lleva la agenda a su día
  if (abierto && abierto.id !== siguiendo) {
    setSiguiendo(abierto.id)
    const suDia = diaEn(abierto.inicio)
    if (!diasDe(vista, dia).includes(suDia)) setAncla(suDia)
  }
  // El contacto como estaba al abrir "Nuevo": si se deshace la reunión, vuelve a ese estado
  const nuevoDesde = id === 'nuevo' ? (desdeContacto ?? null) : null
  if (nuevoDesde?.id !== contactoAntes?.id) setContactoAntes(nuevoDesde)

  // Un evento que ya no está (deshecho o cancelado) lleva a la agenda
  if (lista && id && id !== 'nuevo' && !abierto) return <Navigate to="/agenda" replace />

  // ---------- Navegación ----------
  // Abrir agrega una entrada al historial; cerrar vuelve atrás si se abrió desde aquí, así el "atrás" del teléfono hace lo mismo
  const ir = (ruta: string, reemplazar = false) => navigate(ruta, { replace: reemplazar, state: { desdeAqui: reemplazar ? desdeAqui : true } })
  const volver = (atras: boolean) => (atras ? navigate(-1) : navigate('/agenda', { replace: true }))
  const cerrar = () => volver(desdeAqui)
  // "Nuevo" que salió de un contacto vuelve al contacto
  const cerrarNuevo = () => volver(desdeAqui || Boolean(estado?.contacto))
  // En el computador, elegir otro evento reemplaza al que estaba al lado
  const abrir = (evento: Evento) => {
    if (id !== evento.id) ir(`/agenda/${evento.id}`, esComputador && Boolean(id))
  }
  const elegirDia = (otro: string) => {
    setAncla(otro)
    setVista('dia')
  }

  const deshacer = async (cambio: () => Promise<unknown>) => {
    try {
      await cambio()
      aviso.cerrar()
    } catch {
      aviso.mostrar(textos.noSeGuardo)
    }
  }
  // Deshacer un evento recién creado lo borra; si era la reunión con un contacto, el contacto vuelve a su estado
  const deshacerCreado = async (evento: Evento, antes: Contacto | null) => {
    if (actual.current.id === evento.id) volver(actual.current.desdeAqui)
    await deshacer(async () => {
      await borrarEvento(evento.id)
      const despues = antes && consultas.getQueryData<Contacto[]>(['contactos'])?.find((c) => c.id === antes.id)
      if (antes && despues && despues.etapa !== antes.etapa) await cambiarContacto(antes.id, { etapa: antes.etapa, etapa_en: antes.etapa_en })
    })
  }
  // Después de crear queda abierto el evento nuevo, con "Deshacer"
  // (si salió de un contacto, volver o deshacer regresan al contacto)
  const alCrear = (evento: Evento) => {
    const antes = contactoAntes
    navigate(`/agenda/${evento.id}`, { replace: true, state: antes ? { desde: 'contactos' } : { desdeAqui } })
    aviso.mostrar(tv.creaste(evento.titulo), () => void deshacerCreado(evento, antes))
  }
  // "Tomar cupo" y "Voy" desde la lista del día (celular)
  const irAl = async (pieza: PiezaEvento) => {
    if (pendiente) return
    setPendiente(pieza.id)
    try {
      await irAlEvento(pieza.id)
      aviso.mostrar(pieza.estado === 'tomar' ? tv.tomaste : tv.vasA(pieza.titulo), () => void deshacer(() => noIr(pieza.id)))
    } catch (error) {
      aviso.mostrar(error instanceof ErrorDeEvento && error.motivo !== 'otro' ? tv.motivos[error.motivo] : textos.noSeGuardo)
    }
    setPendiente(null)
  }

  // ---------- Qué se ve ----------
  const cargando = !lista || !asistentes || !ocupados
  const piezas = armarPiezas(lista ?? [], asistentes ?? [], ocupados ?? [], yo, ahora)
  const porDias = porDia(soloVoy ? piezas.filter(deLosQueVoy) : piezas)
  const nombres = new Map((personas ?? []).map((p) => [p.id, primerNombre(p)]))
  const semana = semanaDe(dia)
  const titulo = vista === 'dia' ? conMayuscula(diaLargo(dia)) : vista === 'semana' ? tv.semanaDel(rango(semana[0], semana[6])) : tituloMes(dia)

  // En el computador siempre hay un boleto al lado: el elegido o, si no, lo siguiente a lo que vas en lo que se ve
  const delPeriodo = diasDe(vista, dia)
    .flatMap((d) => porDias.get(d) ?? [])
    .filter((p): p is PiezaEvento => p.tipo === 'evento')
  const sugerido = delPeriodo.find((p) => p.proxima) ?? delPeriodo.find((p) => !p.pasada) ?? delPeriodo[0]
  const elegido = id === 'nuevo' ? undefined : (abierto ?? (esComputador ? sugerido?.evento : undefined))

  // Mirando un día, "Nuevo" parte en ese día
  const nuevo = id === 'nuevo' && (
    <CrearEvento computador={esComputador} desdeContacto={desdeContacto} dia={!estado?.contacto && vista === 'dia' ? dia : undefined} onCerrar={cerrarNuevo} onCreado={alCrear} />
  )

  // ---------- Celular: el evento y "Nuevo" ocupan la pantalla ----------
  if (!esComputador) {
    if (nuevo) return nuevo
    if (abierto)
      return (
        <>
          <DetalleEvento
            evento={abierto}
            computador={false}
            atras={estado?.desde === 'hoy' ? textos.hoy.titulo : estado?.desde === 'contactos' ? textos.contactos.titulo : undefined}
            conNota={estado?.abrir === 'nota'}
            onCerrar={cerrar}
          />
          <Aviso texto={aviso.texto} onDeshacer={aviso.deshacer} sobrePie />
        </>
      )
    if (id && !lista) return null
  }

  // ---------- Piezas de las dos formas ----------
  // Las pestañas se recorren con las flechas, como pide el patrón de pestañas
  const moverPestana = (e: KeyboardEvent, i: number) => {
    const teclas: Record<string, number> = { ArrowRight: (i + 1) % 3, ArrowLeft: (i + 2) % 3, Home: 0, End: 2 }
    const destino = teclas[e.key]
    if (destino === undefined) return
    e.preventDefault()
    setVista(VISTAS[destino])
    pestanas.current[destino]?.focus()
  }
  const pestanasVista = (
    <div role="tablist" aria-label={tv.vistas} className={esComputador ? estilos.segmentoPc : estilos.pestanas}>
      {VISTAS.map((v, i) => (
        <button
          key={v}
          ref={(boton) => {
            pestanas.current[i] = boton
          }}
          type="button"
          role="tab"
          id={`agenda-${v}`}
          aria-selected={vista === v}
          aria-controls="agenda-vista"
          tabIndex={vista === v ? 0 : -1}
          onClick={() => setVista(v)}
          onKeyDown={(e) => moverPestana(e, i)}
        >
          {tv.nombres[v]}
        </button>
      ))}
    </div>
  )
  const filtro = (
    <div role="group" aria-label={tv.queVer} className={esComputador ? estilos.segmentoPc : estilos.segmento}>
      <button type="button" aria-pressed={!soloVoy} onClick={() => setSoloVoy(false)}>
        {tv.todo}
      </button>
      <button type="button" aria-pressed={soloVoy} onClick={() => setSoloVoy(true)}>
        {tv.aLosQueVoy}
      </button>
    </div>
  )
  // Al llegar al borde del viaje la flecha se apaga, pero no pierde el foco
  const flecha = (paso: number) => (
    <button
      type="button"
      className={estilos.flecha}
      aria-label={paso < 0 ? tv.anterior[vista] : tv.siguiente[vista]}
      aria-disabled={!puedeMover(vista, dia, paso)}
      onClick={() => {
        if (puedeMover(vista, dia, paso)) setAncla(mover(vista, dia, paso))
      }}
    >
      <Icono nombre={paso < 0 ? 'izquierda' : 'derecha'} medida={20} trazo={2} />
    </button>
  )
  const flechas = (
    <>
      {flecha(-1)}
      {flecha(1)}
    </>
  )
  const contenido =
    eventos.isError && !lista ? (
      <div className={estilos.fallo}>
        <p>{tv.noSeCargo}</p>
        <button type="button" className={estilos.reintentar} onClick={() => void eventos.refetch()}>
          {tv.reintentar}
        </button>
      </div>
    ) : cargando ? null : vista === 'dia' ? (
      <AgendaDia
        dia={dia}
        piezas={porDias.get(dia) ?? []}
        computador={esComputador}
        chile={chile}
        hoy={hoy}
        ahora={ahora}
        soloVoy={soloVoy}
        nombres={nombres}
        elegido={elegido?.id}
        pendiente={pendiente}
        onAbrir={abrir}
        onIr={(pieza) => void irAl(pieza)}
      />
    ) : vista === 'semana' ? (
      <AgendaSemana dias={semana} piezas={porDias} computador={esComputador} chile={chile} hoy={hoy} ahora={ahora} elegido={elegido?.id} onAbrir={abrir} onDia={elegirDia} />
    ) : (
      <AgendaMes dia={dia} piezas={porDias} computador={esComputador} hoy={hoy} yo={yo} soloVoy={soloVoy} onDia={elegirDia} />
    )

  // ---------- Computador: la vista y, al lado, el boleto o "Nuevo" ----------
  if (esComputador) {
    return (
      <div className={estilos.pc}>
        <header className={estilos.cabeceraPc}>
          <div className={estilos.titularPc}>
            <h1 className={estilos.titulo}>{textos.agenda.titulo}</h1>
            <div className={estilos.navegarPc}>
              {flechas}
              <span className={estilos.periodoPc} aria-live="polite">
                {titulo}
              </span>
            </div>
            <button type="button" className={estilos.nuevo} aria-pressed={id === 'nuevo'} onClick={() => (id === 'nuevo' ? cerrarNuevo() : ir('/agenda/nuevo'))}>
              <Icono nombre="mas" medida={18} trazo={2.25} />
              {tv.nuevoEvento}
            </button>
          </div>
          <div className={estilos.controlesPc}>
            {pestanasVista}
            {filtro}
            <span className={estilos.chilePc}>
              <InterruptorHoraDeChile activo={chile} onCambio={setChile} />
            </span>
          </div>
        </header>
        <div className={estilos.cuerpoPc}>
          <div className={estilos.columnasPc}>
            <div id="agenda-vista" role="tabpanel" aria-labelledby={`agenda-${vista}`} className={estilos.vistaPc}>
              {vista === 'dia' && <VistaFranja dias={semana} elegido={dia} hoy={hoy} computador onElegir={setAncla} />}
              {contenido}
            </div>
            <aside key={nuevo ? 'nuevo' : elegido?.id} aria-label={nuevo ? tv.nuevo : elegido?.titulo} className={estilos.lado}>
              {nuevo ||
                (elegido ? (
                  <DetalleEvento evento={elegido} computador conNota={estado?.abrir === 'nota' && elegido.id === id} onCerrar={cerrar} />
                ) : (
                  !cargando && <p className={estilos.ladoVacio}>{(soloVoy ? tv.sinLosTuyos : tv.sinEventos)[vista]}</p>
                ))}
            </aside>
          </div>
        </div>
        <Aviso texto={aviso.texto} onDeshacer={aviso.deshacer} conPanel />
      </div>
    )
  }

  return (
    <div className={estilos.celular}>
      <div className={estilos.cabecera}>
        <div className={estilos.titular}>
          <h1 className={estilos.titulo}>{textos.agenda.titulo}</h1>
          <button type="button" className={estilos.nuevo} aria-label={tv.nuevoEventoORato} onClick={() => ir('/agenda/nuevo')}>
            <Icono nombre="mas" medida={18} trazo={2.25} />
            {tv.nuevo}
          </button>
        </div>
        {pestanasVista}
        {vista === 'dia' ? (
          <VistaFranja
            dias={semana}
            elegido={dia}
            hoy={hoy}
            computador={false}
            onElegir={setAncla}
            onSemana={(paso) => {
              if (puedeMover('semana', dia, paso)) setAncla(mover('semana', dia, paso))
            }}
          />
        ) : (
          <div className={estilos.periodo}>
            <span className={estilos.periodoTexto} aria-live="polite">
              {titulo}
            </span>
            <span className={estilos.flechas}>{flechas}</span>
          </div>
        )}
      </div>
      <div className={estilos.controles}>
        {filtro}
        {vista === 'dia' && <InterruptorHoraDeChile activo={chile} onCambio={setChile} />}
      </div>
      <div id="agenda-vista" role="tabpanel" aria-labelledby={`agenda-${vista}`}>
        {contenido}
      </div>
      <Aviso texto={aviso.texto} onDeshacer={aviso.deshacer} />
    </div>
  )
}
