import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { Atras, Aviso, BotonPrincipal } from '../../componentes/Controles.tsx'
import { ElegirPersona } from '../../componentes/ElegirPersona.tsx'
import { Icono } from '../../componentes/Icono.tsx'
import { PanelEncima, PantallaConPie } from '../../componentes/Paneles.tsx'
import { SinConexion } from '../../componentes/SinConexion.tsx'
import { useAviso } from '../../componentes/useAviso.ts'
import { useConectado } from '../../datos/conexion.ts'
import { usePersonas, type Persona } from '../../datos/consultas.ts'
import { cambiarContacto, puedeCambiar, seAgenda, type Canal, type Contacto, type Etapa } from '../../datos/contactos.ts'
import { useEventos, useNotasReunion } from '../../datos/eventos.ts'
import { primerNombre } from '../../datos/nombres.ts'
import { useSesion } from '../../datos/sesion.tsx'
import { useTextos } from '../../textos.ts'
import { DetalleEtapas } from './DetalleEtapas.tsx'
import { DetalleNotas } from './DetalleNotas.tsx'
import { DetalleReunion } from './DetalleReunion.tsx'
import estilos from './DetalleContacto.module.css'

// A dónde lleva el botón del canal: escribir un correo, abrir el LinkedIn o llamar
function enlace(canal: Canal, dato: string): string {
  if (canal === 'correo') return `mailto:${dato.trim()}`
  if (canal === 'telefono') return `tel:${dato.replace(/[^\d+]/g, '')}`
  return /^https?:\/\//i.test(dato.trim()) ? dato.trim() : `https://${dato.trim()}`
}

// La Tarjeta de un contacto: la organización en la cinta, el canal con su botón, las cinco etapas,
// el responsable, las notas y el paso siguiente abajo. En el celular ocupa la pantalla
// ("Contactos" vuelve); en el computador es el panel encima del tablero. Muestra sus propios avisos.
export function DetalleContacto({ contacto, computador, onCerrar, onEditar }: { contacto: Contacto; computador: boolean; onCerrar: () => void; onEditar: () => void }) {
  const textos = useTextos()
  const sesion = useSesion()
  const navigate = useNavigate()
  const { data: personas } = usePersonas()
  const { data: eventos } = useEventos()
  const { data: notasReunion } = useNotasReunion()
  const aviso = useAviso()
  const sinRed = !useConectado()
  const [eligiendo, setEligiendo] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  if (sesion.tipo !== 'dentro') return null
  const yo = sesion.persona
  const t = textos.contactos
  const d = t.detalle

  const puede = puedeCambiar(contacto, yo)
  const descartado = contacto.etapa === 'descartado'
  const tuyo = contacto.responsable === yo.id
  const persona = (id: string | null) => (id ? personas?.find((p) => p.id === id) : undefined)
  const responsable = persona(contacto.responsable)
  const asignador = tuyo && contacto.asignado_por !== yo.id ? persona(contacto.asignado_por) : undefined
  // Un contacto personal es siempre de quien lo creó: su responsable no cambia
  const cambiaResponsable = puede && !contacto.personal
  const corto = contacto.nombre.trim().split(/\s+/)[0]
  // La reunión es el último evento que salió del contacto
  const reunion = contacto.etapa === 'reunion_agendada' || contacto.etapa === 'reunion_hecha' ? eventos?.filter((e) => e.contacto === contacto.id).at(-1) : undefined
  const sinTuNota = reunion !== undefined && !notasReunion?.some((n) => n.evento === reunion.id && n.autor === yo.id)

  // ---------- Acciones ----------
  // Deshacer vuelve a la etapa anterior con su fecha
  const deshacer = async (antes: { etapa: Etapa; etapa_en: string }) => {
    try {
      await cambiarContacto(contacto.id, antes)
      aviso.cerrar()
    } catch {
      aviso.mostrar(textos.noSeGuardo)
    }
  }
  const cambiarEtapa = async (etapa: Etapa) => {
    if (!puede || sinRed || ocupado || etapa === contacto.etapa) return
    const antes = { etapa: contacto.etapa, etapa_en: contacto.etapa_en }
    setOcupado(true)
    try {
      await cambiarContacto(contacto.id, { etapa })
      aviso.mostrar(etapa === 'descartado' ? t.descartaste(contacto.nombre) : t.paso(corto, t.etapas[etapa]), () => void deshacer(antes))
    } catch {
      aviso.mostrar(textos.noSeGuardo)
    } finally {
      setOcupado(false)
    }
  }
  const elegirResponsable = async (elegida: Persona) => {
    setEligiendo(false)
    if (elegida.id === contacto.responsable) return
    try {
      await cambiarContacto(contacto.id, { responsable: elegida.id })
      aviso.mostrar(elegida.id === yo.id ? d.ahoraEsTuyo : d.seLoAsignaste(primerNombre(elegida)))
    } catch {
      aviso.mostrar(textos.noSeGuardo)
    }
  }

  // Agendar la reunión es crearla en la Agenda; al crearla, el contacto pasa a "Reunión agendada"
  const agendar = () => navigate('/agenda/nuevo', { state: { contacto: contacto.id } })
  const elegirEtapa = (etapa: Etapa) => (seAgenda(contacto.etapa, etapa) ? agendar() : void cambiarEtapa(etapa))

  // El paso siguiente va abajo. Después de la reunión, quien no ha escrito su nota la escribe en el evento.
  // Sin conexión, cambiar el estado o agendar queda apagado; escribir la nota sigue activo
  const siguientes: Partial<Record<Etapa, { texto: string; accion: () => void; conRed: boolean }>> = {
    por_contactar: { texto: d.marcarContactado, accion: () => void cambiarEtapa('contactado'), conRed: true },
    contactado: { texto: d.marcarRespondio, accion: () => void cambiarEtapa('respondio'), conRed: true },
    respondio: { texto: d.agendarReunion, accion: agendar, conRed: true },
  }
  if (reunion && sinTuNota) siguientes.reunion_hecha = { texto: d.escribirNota, accion: () => navigate(`/agenda/${reunion.id}`, { state: { desde: 'contactos', abrir: 'nota' } }), conRed: false }
  const siguiente = puede ? siguientes[contacto.etapa] : undefined
  let pie: ReactNode = null
  if (siguiente) {
    const apagado = sinRed && siguiente.conRed
    pie = (
      <>
        <BotonPrincipal apagado={apagado} ocupado={ocupado} onClick={siguiente.accion}>
          {siguiente.texto}
        </BotonPrincipal>
        {apagado && <p className={estilos.notaRed}>{d.sinRedEstado}</p>}
      </>
    )
  } else if (!puede && responsable) {
    pie = <div className={estilos.soloPuede}>{d.soloPuede(primerNombre(responsable))}</div>
  }

  // ---------- Partes ----------
  const Nombre = computador ? 'h2' : 'h1'
  const tarjeta = (
    <div className={estilos.tarjeta} data-cinta={Boolean(contacto.organizacion)}>
      {contacto.organizacion && <span className={estilos.cinta}>{contacto.organizacion}</span>}
      <Nombre className={estilos.nombre}>{contacto.nombre}</Nombre>
      {(contacto.personal || descartado) && (
        <div className={estilos.chips}>
          {contacto.personal && (
            <span className={estilos.chip}>
              <Icono nombre="candado" medida={12} trazo={2.25} />
              {t.personal}
            </span>
          )}
          {descartado && <span className={estilos.chip}>{t.etapas.descartado}</span>}
        </div>
      )}
      {contacto.canal && contacto.dato?.trim() && (
        <div className={estilos.canal}>
          <span className={estilos.canalIcono}>
            <Icono nombre={contacto.canal} medida={20} />
          </span>
          <span className={estilos.canalTexto}>
            <span className={estilos.canalNombre}>{t.canales[contacto.canal]}</span>
            <span className={estilos.canalDato}>{contacto.canal === 'linkedin' ? d.perfilLinkedin : contacto.dato}</span>
          </span>
          <a
            className={estilos.canalBoton}
            href={enlace(contacto.canal, contacto.dato)}
            target={contacto.canal === 'linkedin' ? '_blank' : undefined}
            rel={contacto.canal === 'linkedin' ? 'noreferrer' : undefined}
          >
            {d.acciones[contacto.canal]}
          </a>
        </div>
      )}
    </div>
  )

  const quien = (
    <>
      <span className={estilos.filaIcono}>
        <Icono nombre="perfil" medida={20} />
      </span>
      <span className={estilos.filaTexto}>
        <span className={estilos.filaEtiqueta}>{t.responsable}</span>
        <span className={estilos.filaValor} data-tu={tuyo}>{tuyo ? t.tu : responsable ? primerNombre(responsable) : ''}</span>
        {asignador && <span className={estilos.filaEtiqueta}>{d.teLoAsigno(primerNombre(asignador))}</span>}
      </span>
      {cambiaResponsable && (
        <span className={estilos.filaIcono}>
          <Icono nombre="derecha" medida={18} trazo={2} />
        </span>
      )}
    </>
  )

  const cuerpo = (
    <>
      {tarjeta}
      <DetalleEtapas etapa={contacto.etapa} etapaEn={contacto.etapa_en} activa={puede} apagada={sinRed} onElegir={elegirEtapa} />
      {cambiaResponsable ? (
        <button type="button" className={estilos.responsable} aria-haspopup="dialog" aria-disabled={sinRed} onClick={() => !sinRed && setEligiendo(true)}>
          {quien}
        </button>
      ) : (
        <div className={estilos.responsable}>{quien}</div>
      )}
      {reunion && <DetalleReunion reunion={reunion} hecha={contacto.etapa === 'reunion_hecha'} yo={yo.id} onAbrir={() => navigate(`/agenda/${reunion.id}`, { state: { desde: 'contactos' } })} />}
      <DetalleNotas key={contacto.id} contacto={contacto} yo={yo} aviso={aviso} />
      {puede && !descartado && (
        <button type="button" className={estilos.descartar} aria-disabled={sinRed} onClick={() => void cambiarEtapa('descartado')}>
          {d.descartar}
        </button>
      )}
      <ElegirPersona abierta={eligiendo} titulo={t.elegirResponsable} elegida={contacto.responsable} onElegir={(elegida) => void elegirResponsable(elegida)} onCerrar={() => setEligiendo(false)} />
    </>
  )

  const editar = (
    <button type="button" className={computador ? estilos.editarPc : estilos.editar} onClick={onEditar}>
      <Icono nombre="lapiz" medida={18} trazo={2} />
      {d.editar}
    </button>
  )

  // ---------- Computador ----------
  if (computador) {
    return (
      <PanelEncima
        etiqueta={contacto.nombre}
        onCerrar={onCerrar}
        cabecera={
          <div className={estilos.derecha}>
            {puede && !sinRed && editar}
            <SinConexion sobrePanel />
          </div>
        }
        pie={pie}
      >
        {cuerpo}
        <Aviso texto={aviso.texto} onDeshacer={aviso.deshacer} conPanel />
      </PanelEncima>
    )
  }

  // ---------- Celular ----------
  return (
    <PantallaConPie pie={pie}>
      <div className={estilos.cabecera}>
        <Atras texto={t.titulo} onClick={onCerrar} />
        <div className={estilos.derecha}>
          <SinConexion />
          {puede && !sinRed && editar}
        </div>
      </div>
      {cuerpo}
      <Aviso texto={aviso.texto} onDeshacer={aviso.deshacer} sobrePie={Boolean(pie)} />
    </PantallaConPie>
  )
}
