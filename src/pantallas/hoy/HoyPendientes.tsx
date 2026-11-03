import type { NavigateFunction } from 'react-router'
import { Hoja, TituloHoja } from '../../componentes/Controles.tsx'
import { Icono, type NombreIcono } from '../../componentes/Icono.tsx'
import type { Contacto } from '../../datos/contactos.ts'
import type { Evento } from '../../datos/eventos.ts'
import type { Persona } from '../../datos/sesion.tsx'
import { useTextos, type Textos } from '../../textos.ts'
import estilos from './Hoy.module.css'

export type Pendiente = { texto: string; icono: NombreIcono; ir: () => void }

// Tus pendientes: contactos que te asignaron por contactar, eventos para todos sin confirmar y lo que falta en tu perfil.
// Las notas de reunión y lo que debes no son pendientes.
export function pendientesDe(persona: Persona, contactos: Contacto[], sinConfirmar: Evento[], textos: Textos, navigate: NavigateFunction): { lista: Pendiente[]; resumen: string | null } {
  const t = textos.hoy
  const lista: Pendiente[] = []
  const porContactar = contactos.filter((c) => c.responsable === persona.id && c.etapa === 'por_contactar')
  if (porContactar.length === 1) lista.push({ texto: t.escribeA(porContactar[0].nombre), icono: 'contactos', ir: () => navigate(`/contactos/${porContactar[0].id}`) })
  if (porContactar.length > 1) lista.push({ texto: t.escribeAVarios(porContactar.length), icono: 'contactos', ir: () => navigate('/contactos') })
  if (sinConfirmar.length === 1) lista.push({ texto: t.viaje.confirmaSiVas(sinConfirmar[0].titulo), icono: 'agenda', ir: () => navigate(`/agenda/${sinConfirmar[0].id}`, { state: { desde: 'hoy' } }) })
  if (sinConfirmar.length > 1) lista.push({ texto: t.viaje.confirmaSiVasVarios(sinConfirmar.length), icono: 'agenda', ir: () => navigate('/agenda') })
  const editarPerfil = () => navigate('/perfil', { state: { abrir: 'editar' } })
  const perfil = [!persona.emprendimiento && t.agregaEmprendimiento, !persona.objetivos && t.agregaObjetivos, !persona.linkedin && t.agregaLinkedin].filter((x) => x !== false)
  for (const texto of perfil) lista.push({ texto, icono: 'perfil', ir: editarPerfil })

  // Durante el viaje van resumidos bajo la ficha: "Pendientes: 1 contacto, 1 evento y tu perfil"
  const partes = [porContactar.length > 0 && t.viaje.contactos(porContactar.length), sinConfirmar.length > 0 && t.viaje.eventos(sinConfirmar.length), perfil.length > 0 && t.viaje.tuPerfil].filter((x) => x !== false)
  return { lista, resumen: partes.length > 0 ? t.viaje.pendientesDe(textos.y(partes)) : null }
}

export function ListaPendientes({ pendientes }: { pendientes: Pendiente[] }) {
  const t = useTextos().hoy
  if (pendientes.length === 0) return <p className={estilos.sinPendientes}>{t.sinPendientes}</p>
  return (
    <ul className={estilos.lista}>
      {pendientes.map(({ texto, icono, ir }) => (
        <li key={texto}>
          <button type="button" className={estilos.pendiente} onClick={ir}>
            <Icono nombre={icono} medida={20} />
            <span className={estilos.pendienteTexto}>{texto}</span>
            <Icono nombre="derecha" medida={16} trazo={2} />
          </button>
        </li>
      ))}
    </ul>
  )
}

// En el celular, durante el viaje: la fila de la ficha abre la lista en una hoja
export function HojaPendientes({ abierta, pendientes, onCerrar }: { abierta: boolean; pendientes: Pendiente[]; onCerrar: () => void }) {
  const t = useTextos().hoy
  return (
    <Hoja abierta={abierta} etiqueta={t.pendientes} onCerrar={onCerrar}>
      <TituloHoja>{t.pendientes}</TituloHoja>
      <ListaPendientes pendientes={pendientes} />
    </Hoja>
  )
}
