import { useState, type ReactNode } from 'react'
import { Atras, Aviso, BotonPrincipal } from '../../componentes/Controles.tsx'
import { ElegirPersona } from '../../componentes/ElegirPersona.tsx'
import { Icono } from '../../componentes/Icono.tsx'
import { PanelEncima, PantallaConPie } from '../../componentes/Paneles.tsx'
import { useAviso } from '../../componentes/useAviso.ts'
import { usePersonas, type Persona } from '../../datos/consultas.ts'
import { cambiarContacto, puedeCambiar, type Canal, type Contacto, type Etapa } from '../../datos/contactos.ts'
import { primerNombre } from '../../datos/nombres.ts'
import { useSesion } from '../../datos/sesion.tsx'
import { useTextos } from '../../textos.ts'
import { DetalleEtapas } from './DetalleEtapas.tsx'
import { DetalleNotas } from './DetalleNotas.tsx'
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
  const { data: personas } = usePersonas()
  const aviso = useAviso()
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
    if (!puede || ocupado || etapa === contacto.etapa) return
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

  // El paso siguiente va abajo. "Agendar reunión" por ahora pasa directo a "Reunión agendada";
  // cuando exista la Agenda, abrirá "Crear evento" enlazado al contacto.
  const siguientes: Partial<Record<Etapa, { etapa: Etapa; texto: string }>> = {
    por_contactar: { etapa: 'contactado', texto: d.marcarContactado },
    contactado: { etapa: 'respondio', texto: d.marcarRespondio },
    respondio: { etapa: 'reunion_agendada', texto: d.agendarReunion },
  }
  const siguiente = puede ? siguientes[contacto.etapa] : undefined
  let pie: ReactNode = null
  if (siguiente) {
    pie = (
      <BotonPrincipal ocupado={ocupado} onClick={() => void cambiarEtapa(siguiente.etapa)}>
        {siguiente.texto}
      </BotonPrincipal>
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
      <DetalleEtapas etapa={contacto.etapa} etapaEn={contacto.etapa_en} activa={puede} onElegir={(etapa) => void cambiarEtapa(etapa)} />
      {cambiaResponsable ? (
        <button type="button" className={estilos.responsable} aria-haspopup="dialog" onClick={() => setEligiendo(true)}>
          {quien}
        </button>
      ) : (
        <div className={estilos.responsable}>{quien}</div>
      )}
      <DetalleNotas key={contacto.id} contacto={contacto} yo={yo} aviso={aviso} />
      {puede && !descartado && (
        <button type="button" className={estilos.descartar} onClick={() => void cambiarEtapa('descartado')}>
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
      <PanelEncima etiqueta={contacto.nombre} onCerrar={onCerrar} cabecera={puede ? editar : undefined} pie={pie}>
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
        {puede && editar}
      </div>
      {cuerpo}
      <Aviso texto={aviso.texto} onDeshacer={aviso.deshacer} sobrePie={Boolean(pie)} />
    </PantallaConPie>
  )
}
