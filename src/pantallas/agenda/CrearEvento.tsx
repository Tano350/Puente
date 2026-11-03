import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { BotonBorde, BotonPrincipal } from '../../componentes/Controles.tsx'
import { Icono } from '../../componentes/Icono.tsx'
import { PantallaConPie } from '../../componentes/Paneles.tsx'
import { cambiarContacto, puedeCambiar, seAgenda, type Contacto } from '../../datos/contactos.ts'
import { borrarOcupado, crearEvento, libres, marcarOcupado, sumarAEvento, type Evento } from '../../datos/eventos.ts'
import { useSesion } from '../../datos/sesion.tsx'
import { useTextos } from '../../textos.ts'
import { avisarAlCerrar } from './CrearAviso.tsx'
import { CrearBoleto } from './CrearBoleto.tsx'
import { alReves, borradorInicial, rangoDe, validar, type Borrador, type Clase, type Errores } from './CrearBorrador.ts'
import { CrearQuienes } from './CrearQuienes.tsx'
import estilos from './CrearEvento.module.css'

type Props = { computador: boolean; desdeContacto?: Contacto; dia?: string; onCerrar: () => void; onCreado: (evento: Evento) => void }

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

// "Nuevo": un evento (el boleto para llenar) o un rato ocupado.
// En el celular tapa todo; en el computador va en la columna al lado de la semana, sin cromo propio.
export function CrearEvento(props: Props) {
  // La reunión con un contacto parte con su propio borrador (el contacto puede llegar después de abrir)
  return <Formulario key={props.desdeContacto?.id ?? 'nuevo'} {...props} />
}

function Formulario({ computador, desdeContacto, dia, onCerrar, onCreado }: Props) {
  const textos = useTextos()
  const sesion = useSesion()
  const t = textos.agenda.crear
  const [borrador, setBorrador] = useState<Borrador>(() => borradorInicial(t, desdeContacto, dia))
  const [errores, setErrores] = useState<Errores>({})
  const [guardando, setGuardando] = useState(false)
  const [fallo, setFallo] = useState(false)
  // Para no crearlo dos veces si tocan el botón seguido, antes de que se vea "ocupado"
  const enviando = useRef(false)
  // Si el evento quedó pero falló al sumar a alguien, reintentar no lo duplica
  const creado = useRef<Evento | null>(null)
  const evento = borrador.clase === 'evento'
  const disponibilidad = useLibres(evento ? rangoDe(borrador) : null)
  if (sesion.tipo !== 'dentro') return null
  const yo = sesion.persona

  // El contacto pasa a "Reunión agendada" si viene de antes y quien crea puede cambiarlo
  const contacto = desdeContacto && seAgenda(desdeContacto.etapa, 'reunion_agendada') && puedeCambiar(desdeContacto, yo) ? desdeContacto : undefined

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
        const { tipo, lugar, direccion, modo, cupos, elegidos, notas } = borrador
        creado.current ??= await crearEvento(yo.id, {
          titulo,
          tipo: tipo ?? 'otro',
          lugar: lugar.trim() || null,
          direccion: direccion.trim() || null,
          ...rango,
          modo,
          cupos: modo === 'con_cupo' ? cupos : null,
          notas: notas.trim() || null,
          contacto: desdeContacto?.id ?? null,
        })
        if (modo === 'cerrado') for (const persona of elegidos) await sumarAEvento(creado.current.id, persona)
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
      onCreado(listo.evento)
      return
    }
    const id = listo.id
    avisarAlCerrar(t.marcaste, () => borrarOcupado(id))
    onCerrar()
  }

  const selector = !desdeContacto && (
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
    <BotonPrincipal onClick={() => void guardar()} ocupado={guardando}>
      {evento ? t.crearEvento : t.marcarOcupado}
    </BotonPrincipal>
  )
  const noSeGuardo = fallo && (
    <div className={estilos.fallo} role="alert">
      {textos.noSeGuardo}
    </div>
  )
  const hayErrores = CAMPOS.some((campo) => errores[campo])

  const cuerpo = (
    <>
      {contacto && (
        <div className={estilos.contacto}>
          <Icono nombre="contactos" medida={18} />
          {t.pasara(contacto.nombre, textos.contactos.etapas.reunion_agendada)}
        </div>
      )}
      <CrearBoleto borrador={borrador} errores={errores} computador={computador} enfocar={computador && !desdeContacto} onCambio={cambiar} />
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
          <CrearQuienes computador={computador} dia={borrador.dia} modo={borrador.modo} elegidos={borrador.elegidos} onModo={(modo) => cambiar({ modo })} onElegidos={(elegidos) => cambiar({ elegidos })} />
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
        <div className={estilos.tituloFila}>
          <h2 className={estilos.tituloPanel}>{t.titulo}</h2>
          {selector}
        </div>
        {cuerpo}
        <div className={estilos.botones}>
          {boton}
          <BotonBorde onClick={onCerrar}>{textos.cancelar}</BotonBorde>
        </div>
        {noSeGuardo}
      </div>
    )
  }

  return (
    <PantallaConPie
      encima
      pie={
        <>
          {boton}
          {noSeGuardo}
        </>
      }
    >
      <div className={estilos.cabeza}>
        <div className={estilos.cabezaFila}>
          <button type="button" className={estilos.cancelar} onClick={onCerrar}>
            {textos.cancelar}
          </button>
        </div>
        <div className={estilos.tituloFila}>
          <h1 className={estilos.titulo}>{t.titulo}</h1>
          {selector}
        </div>
      </div>
      <div className={estilos.formulario}>{cuerpo}</div>
    </PantallaConPie>
  )
}
