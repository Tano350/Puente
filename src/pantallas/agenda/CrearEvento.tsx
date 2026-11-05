import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { BotonBorde, BotonPrincipal, Hoja, TituloHoja } from '../../componentes/Controles.tsx'
import { Icono } from '../../componentes/Icono.tsx'
import { SinConexion } from '../../componentes/SinConexion.tsx'
import { useConectado } from '../../datos/conexion.ts'
import { PantallaConPie } from '../../componentes/Paneles.tsx'
import type { TablesUpdate } from '../../datos/base.ts'
import { cambiarContacto, puedeCambiar, seAgenda, useContactos, type Contacto } from '../../datos/contactos.ts'
import { asistentesDe, borrarOcupado, cambiarEvento, cancelarEvento, crearEvento, libres, marcarOcupado, sumarAEvento, useAsistentes, useEventos, type Evento } from '../../datos/eventos.ts'
import { ahora } from '../../datos/fechas.ts'
import { useSesion } from '../../datos/sesion.tsx'
import { useTextos } from '../../textos.ts'
import { avisarAlCerrar } from './CrearAviso.tsx'
import { CrearBoleto } from './CrearBoleto.tsx'
import { alReves, borradorDe, borradorInicial, CAMBIABLES, datosDe, rangoDe, validar, type Borrador, type Clase, type Errores } from './CrearBorrador.ts'
import { CrearQuienes } from './CrearQuienes.tsx'
import estilos from './CrearEvento.module.css'

// "editando": el evento que se edita (quien organiza o administra). Al guardar, onGuardado recibe lo que
// había antes de los cambios, para deshacerlos (o null si no se puede); al cancelarlo, onCancelado.
type Props = {
  computador: boolean
  desdeContacto?: Contacto
  dia?: string
  editando?: Evento
  onCerrar: () => void
  onCreado?: (evento: Evento) => void
  onGuardado?: (evento: Evento, antes: TablesUpdate<'eventos'> | null) => void
  onCancelado?: (evento: Evento) => void
}

const CAMPOS = ['titulo', 'dia', 'hora'] as const

// Cuántos del grupo tienen libre esa hora, cuando el día y la hora dejan de cambiar
function useLibres(rango: { inicio: string; fin: string } | null) {
  const clave = rango ? `${rango.inicio}/${rango.fin}` : null
  const [quieta, setQuieta] = useState(clave)
  useEffect(() => {
    const reloj = window.setTimeout(() => setQuieta(clave), 300)
    return () => window.clearTimeout(reloj)
  }, [clave])
  const [desde = '', hasta = ''] = quieta?.split('/') ?? []
  const { data } = useQuery({ queryKey: ['libres', desde, hasta], queryFn: () => libres(desde, hasta), enabled: Boolean(quieta), placeholderData: keepPreviousData })
  return clave ? data : undefined
}

// "Nuevo": un evento (el boleto para llenar) o un rato ocupado. "Editar evento": el mismo boleto, lleno.
// En el celular tapa todo; en el computador va en la columna al lado de la semana, sin cromo propio.
export function CrearEvento(props: Props) {
  // La reunión con un contacto (o el evento que se edita) parte con su propio borrador (el contacto puede llegar después de abrir)
  return <Formulario key={props.editando?.id ?? props.desdeContacto?.id ?? 'nuevo'} {...props} />
}

function Formulario({ computador, desdeContacto, dia, editando, onCerrar, onCreado, onGuardado, onCancelado }: Props) {
  const textos = useTextos()
  const sesion = useSesion()
  const { data: asistentes } = useAsistentes()
  const { data: contactos } = useContactos()
  const { data: eventos } = useEventos()
  const sinRed = !useConectado()
  const t = textos.agenda.crear
  const te = textos.agenda.editar
  const [borrador, setBorrador] = useState<Borrador>(() => (editando ? borradorDe(editando) : borradorInicial(t, desdeContacto, dia)))
  // Al editar se guarda solo lo que cambió desde que se abrió
  const [inicial] = useState(borrador)
  const [errores, setErrores] = useState<Errores>({})
  const [guardando, setGuardando] = useState(false)
  const [fallo, setFallo] = useState(false)
  const [cancelando, setCancelando] = useState(false)
  // Para no crearlo dos veces si tocan el botón seguido, antes de que se vea "ocupado"
  const enviando = useRef(false)
  // Si el evento quedó pero falló al sumar a alguien, reintentar no lo duplica
  const creado = useRef<Evento | null>(null)
  const evento = borrador.clase === 'evento'
  // Al editar no se muestra: los que ya van saldrían ocupados por el mismo evento
  const disponibilidad = useLibres(evento && !editando ? rangoDe(borrador) : null)
  if (sesion.tipo !== 'dentro') return null
  const yo = sesion.persona

  // El contacto pasa a "Reunión agendada" si viene de antes y quien crea puede cambiarlo
  const contacto = desdeContacto && seAgenda(desdeContacto.etapa, 'reunion_agendada') && puedeCambiar(desdeContacto, yo) ? desdeContacto : undefined

  // Al cancelar una reunión, su contacto vuelve a "Respondió" si no le queda otra reunión vigente (lo hace la base)
  const vuelve =
    editando?.contacto && !(eventos ?? []).some((e) => e.id !== editando.id && e.contacto === editando.contacto && Date.parse(e.fin) >= Date.parse(ahora()))
      ? contactos?.find((c) => c.id === editando.contacto && c.etapa === 'reunion_agendada')
      : undefined

  const cambiar = (cambios: Partial<Borrador>) => {
    const nuevo = { ...borrador, ...cambios }
    setBorrador(nuevo)
    // Lo que se corrige deja de marcarse; un término antes del inicio se avisa al tiro
    setErrores((e) => ({
      titulo: 'titulo' in cambios ? undefined : e.titulo,
      dia: 'dia' in cambios ? undefined : e.dia,
      hora: 'empieza' in cambios || 'termina' in cambios ? (alReves(nuevo) ? t.alReves : undefined) : e.hora,
    }))
  }
  const cambiarClase = (clase: Clase) => {
    if (clase === borrador.clase) return
    setBorrador({ ...borrador, clase })
    setErrores({})
    setFallo(false)
  }

  const guardar = async () => {
    if (enviando.current) return
    const nuevos = validar(borrador, t)
    setErrores(nuevos)
    const rango = rangoDe(borrador)
    if (nuevos.titulo || nuevos.dia || nuevos.hora || !rango) {
      const campo = nuevos.titulo ? 'crear-titulo' : nuevos.dia ? 'crear-dia' : borrador.empieza ? 'crear-fin' : 'crear-hora'
      document.getElementById(campo)?.focus()
      return
    }
    if (editando) return guardarCambios(editando, datosDe(borrador, rango))
    const titulo = borrador.titulo.trim()
    enviando.current = true
    setGuardando(true)
    setFallo(false)
    let listo: { clase: 'evento'; evento: Evento } | { clase: 'ocupado'; id: string }
    try {
      if (borrador.clase === 'ocupado') {
        const rato = await marcarOcupado({ titulo, ...rango })
        listo = { clase: 'ocupado', id: rato.id }
      } else {
        creado.current ??= await crearEvento(yo.id, { ...datosDe(borrador, rango), contacto: desdeContacto?.id ?? null })
        if (borrador.modo === 'cerrado') for (const persona of borrador.elegidos) await sumarAEvento(creado.current.id, persona)
        // El evento ya quedó: si el contacto no se pudo mover no se reporta error, para que reintentar no lo duplique
        if (contacto) await cambiarContacto(contacto.id, { etapa: 'reunion_agendada' }).catch(() => undefined)
        listo = { clase: 'evento', evento: creado.current }
      }
    } catch {
      setFallo(true)
      return
    } finally {
      enviando.current = false
      setGuardando(false)
    }
    if (listo.clase === 'evento') {
      onCreado?.(listo.evento)
      return
    }
    const id = listo.id
    avisarAlCerrar(t.marcaste, () => borrarOcupado(id))
    onCerrar()
  }

  // Al editar se manda solo lo que cambió (sin cambios, se vuelve al evento); "Deshacer" vuelve a lo que tenía
  const guardarCambios = async (original: Evento, datos: ReturnType<typeof datosDe>) => {
    const horas = rangoDe(inicial)
    const antes = horas && datosDe(inicial, horas)
    const cambiados = CAMBIABLES.filter((campo) => datos[campo] !== antes?.[campo])
    if (cambiados.length === 0) return onCerrar()
    const solo = (fuente: Record<(typeof CAMBIABLES)[number], unknown>) => Object.fromEntries(cambiados.map((campo) => [campo, fuente[campo]])) as TablesUpdate<'eventos'>
    // Con otro modo o más cupos, la lista de espera entra (o se borra) y deshacer no la devolvería, como al soltar un cupo
    const esperan = asistentesDe(original.id, asistentes ?? []).espera.length > 0
    const sinVuelta = esperan && (cambiados.includes('modo') || (datos.cupos ?? 0) > (original.cupos ?? 0))
    enviando.current = true
    setGuardando(true)
    setFallo(false)
    try {
      await cambiarEvento(original.id, solo(datos))
    } catch {
      setFallo(true)
      return
    } finally {
      enviando.current = false
      setGuardando(false)
    }
    onGuardado?.(original, sinVuelta ? null : solo(original))
  }

  const cancelar = async () => {
    if (!editando || enviando.current) return
    enviando.current = true
    setGuardando(true)
    setFallo(false)
    try {
      await cancelarEvento(editando.id)
    } catch {
      setCancelando(false)
      setFallo(true)
      return
    } finally {
      enviando.current = false
      setGuardando(false)
    }
    onCancelado?.(editando)
  }

  const selector = !desdeContacto && !editando && (
    <div role="group" aria-label={t.queAgregar} className={estilos.clases} data-computador={computador}>
      <button type="button" className={estilos.clase} aria-pressed={evento} onClick={() => cambiarClase('evento')}>
        {t.evento}
      </button>
      <button type="button" className={estilos.clase} aria-pressed={!evento} onClick={() => cambiarClase('ocupado')}>
        {textos.agenda.ratoOcupado}
      </button>
    </div>
  )
  const boton = (
    <BotonPrincipal apagado={sinRed} onClick={() => void guardar()} ocupado={guardando}>
      {editando ? te.guardar : evento ? t.crearEvento : t.marcarOcupado}
    </BotonPrincipal>
  )
  // Sin conexión el botón queda apagado y lo escrito se queda donde está
  const notaSinRed = sinRed && <div className={estilos.fallo}>{editando ? te.sinRedGuardar : evento ? t.sinRedCrear : t.sinRedMarcar}</div>
  const noSeGuardo = fallo && (
    <div className={estilos.fallo} role="alert">
      {textos.noSeGuardo}
    </div>
  )
  const hayErrores = CAMPOS.some((campo) => errores[campo])

  // Cancelar el evento, mientras no termine: primero pregunta
  const paraCancelar = editando && Date.parse(editando.fin) >= Date.parse(ahora()) && (
    <>
      <button type="button" className={estilos.cancelarEvento} aria-haspopup="dialog" aria-disabled={sinRed} onClick={() => !sinRed && setCancelando(true)}>
        {te.cancelarEvento}
      </button>
      {sinRed && <div className={estilos.notaCancelar}>{te.sinRedCancelar}</div>}
      <Hoja abierta={cancelando} etiqueta={te.cancelarPregunta(editando.titulo)} alerta onCerrar={() => setCancelando(false)}>
        <TituloHoja>{te.cancelarPregunta(editando.titulo)}</TituloHoja>
        <p className={estilos.explica}>{te.desaparece}</p>
        {vuelve && <p className={estilos.explica}>{te.contactoVuelve(vuelve.nombre, textos.contactos.etapas.respondio)}</p>}
        <div className={estilos.hojaBotones}>
          <BotonPrincipal peligro apagado={sinRed} ocupado={guardando} onClick={() => void cancelar()}>
            {te.cancelarEvento}
          </BotonPrincipal>
          <BotonBorde onClick={() => setCancelando(false)}>{textos.volver}</BotonBorde>
        </div>
      </Hoja>
    </>
  )

  const cuerpo = (
    <>
      {contacto && (
        <div className={estilos.contacto}>
          <Icono nombre="contactos" medida={18} />
          {t.pasara(contacto.nombre, textos.contactos.etapas.reunion_agendada)}
        </div>
      )}
      <CrearBoleto borrador={borrador} errores={errores} computador={computador} enfocar={computador && !desdeContacto && !editando} editando={Boolean(editando)} onCambio={cambiar} />
      {hayErrores && (
        <div className={estilos.errores} role="alert">
          {CAMPOS.map(
            (campo) =>
              errores[campo] && (
                <div key={campo} id={`crear-${campo}-error`} className={estilos.error}>
                  <Icono nombre="alerta" medida={15} trazo={2} />
                  {errores[campo]}
                </div>
              ),
          )}
        </div>
      )}
      {evento && disponibilidad && (
        <div className={estilos.libres} role="status">
          <Icono nombre="grupo" medida={16} trazo={2} />
          {t.libres(disponibilidad.libres, disponibilidad.alla)}
        </div>
      )}
      {evento ? (
        <>
          <CrearQuienes
            computador={computador}
            dia={borrador.dia}
            modo={borrador.modo}
            elegidos={borrador.elegidos}
            editando={Boolean(editando)}
            onModo={(modo) => cambiar({ modo })}
            onElegidos={(elegidos) => cambiar({ elegidos })}
          />
          <label className={estilos.etiqueta} htmlFor="crear-notas">
            {t.notas}
          </label>
          <textarea id="crear-notas" className={estilos.notas} rows={2} value={borrador.notas} placeholder={t.notasEjemplo} onChange={(e) => cambiar({ notas: e.target.value })} />
        </>
      ) : (
        <p className={estilos.nota}>{t.grupoVera}</p>
      )}
    </>
  )

  if (computador) {
    return (
      <div className={estilos.formulario} data-computador="true">
        <div className={estilos.fichaPc}>
          <SinConexion sobrePanel />
        </div>
        <div className={estilos.tituloFila}>
          <h2 className={estilos.tituloPanel}>{editando ? te.titulo : t.titulo}</h2>
          {selector}
        </div>
        {cuerpo}
        <div className={estilos.botones}>
          {boton}
          <BotonBorde onClick={onCerrar}>{textos.cancelar}</BotonBorde>
        </div>
        {notaSinRed}
        {noSeGuardo}
        {paraCancelar}
      </div>
    )
  }

  return (
    <PantallaConPie
      encima
      pie={
        <>
          {boton}
          {notaSinRed}
          {noSeGuardo}
        </>
      }
    >
      <div className={estilos.cabeza}>
        <div className={estilos.cabezaFila}>
          <button type="button" className={estilos.cancelar} onClick={onCerrar}>
            {textos.cancelar}
          </button>
          <SinConexion />
        </div>
        <div className={estilos.tituloFila}>
          <h1 className={estilos.titulo}>{editando ? te.titulo : t.titulo}</h1>
          {selector}
        </div>
      </div>
      <div className={estilos.formulario}>
        {cuerpo}
        {paraCancelar}
      </div>
    </PantallaConPie>
  )
}
