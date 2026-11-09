import type { NavigateFunction } from 'react-router'
import { Hoja, TituloHoja } from '../../componentes/Controles.tsx'
import { Icono, type NombreIcono } from '../../componentes/Icono.tsx'
import type { Contacto } from '../../datos/contactos.ts'
import type { Evento } from '../../datos/eventos.ts'
import { hoyEnCalifornia } from '../../datos/fechas.ts'
import type { Persona } from '../../datos/sesion.tsx'
import type { Tarea } from '../../datos/tareas.ts'
import { useTextos, type Textos } from '../../textos.ts'
import { diaDeTarea } from '../tareas/comun.ts'
import estilos from './Hoy.module.css'

// "detalle" es una segunda línea, como "Para el viernes 13"; "atrasada" la pinta de naranjo ("Venció el domingo 8").
// "clave" distingue filas con el mismo texto (dos tareas pueden llamarse igual).
export type Pendiente = { texto: string; icono: NombreIcono; ir: () => void; detalle?: string; atrasada?: boolean; clave?: string }

// Las tareas que se ven en la lista; las demás van en una fila "N tareas más"
const TAREAS_A_LA_VISTA = 3

// Tus pendientes: primero tus tareas por hacer (misTareas, de misPorHacer: ya vienen de la que vence antes a la sin
// fecha), después contactos que te asignaron por contactar, eventos para todos sin confirmar y lo que falta en tu
// perfil. Las notas de reunión y lo que debes no son pendientes.
export function pendientesDe(persona: Persona, contactos: Contacto[], sinConfirmar: Evento[], misTareas: Tarea[], textos: Textos, navigate: NavigateFunction): { lista: Pendiente[]; resumen: string | null } {
  const t = textos.hoy
  const lista: Pendiente[] = []
  // Las fechas de las tareas son días de California, como en Tareas
  const hoyAlla = hoyEnCalifornia()
  for (const tarea of misTareas.slice(0, TAREAS_A_LA_VISTA)) {
    const atrasada = tarea.para !== null && tarea.para < hoyAlla
    const detalle = tarea.para === null ? undefined : (atrasada ? textos.tareas.comun.vencio : textos.tareas.comun.paraEl)(diaDeTarea(tarea.para, hoyAlla))
    lista.push({ clave: `tarea:${tarea.id}`, texto: tarea.titulo, icono: 'tareas', detalle, atrasada, ir: () => navigate(`/tareas/${tarea.id}`, { state: { desde: 'hoy' } }) })
  }
  if (misTareas.length > TAREAS_A_LA_VISTA) lista.push({ texto: t.tareasMas(misTareas.length - TAREAS_A_LA_VISTA), icono: 'tareas', ir: () => navigate('/tareas', { state: { ver: 'mias' } }) })
  const porContactar = contactos.filter((c) => c.responsable === persona.id && c.etapa === 'por_contactar')
  if (porContactar.length === 1) lista.push({ texto: t.escribeA(porContactar[0].nombre), icono: 'contactos', ir: () => navigate(`/contactos/${porContactar[0].id}`) })
  if (porContactar.length > 1) lista.push({ texto: t.escribeAVarios(porContactar.length), icono: 'contactos', ir: () => navigate('/contactos') })
  if (sinConfirmar.length === 1) lista.push({ texto: t.viaje.confirmaSiVas(sinConfirmar[0].titulo), icono: 'agenda', ir: () => navigate(`/agenda/${sinConfirmar[0].id}`, { state: { desde: 'hoy' } }) })
  if (sinConfirmar.length > 1) lista.push({ texto: t.viaje.confirmaSiVasVarios(sinConfirmar.length), icono: 'agenda', ir: () => navigate('/agenda') })
  const editarPerfil = () => navigate('/perfil', { state: { abrir: 'editar' } })
  const perfil = [!persona.emprendimiento && t.agregaEmprendimiento, !persona.objetivos && t.agregaObjetivos, !persona.linkedin && t.agregaLinkedin].filter((x) => x !== false)
  for (const texto of perfil) lista.push({ texto, icono: 'perfil', ir: editarPerfil })

  // Durante el viaje van resumidos bajo la ficha: "Pendientes: 1 contacto, 1 evento, 2 tareas y tu perfil"
  const partes = [
    porContactar.length > 0 && t.viaje.contactos(porContactar.length),
    sinConfirmar.length > 0 && t.viaje.eventos(sinConfirmar.length),
    misTareas.length > 0 && t.viaje.tareas(misTareas.length),
    perfil.length > 0 && t.viaje.tuPerfil,
  ].filter((x) => x !== false)
  return { lista, resumen: partes.length > 0 ? t.viaje.pendientesDe(textos.y(partes)) : null }
}

export function ListaPendientes({ pendientes }: { pendientes: Pendiente[] }) {
  const t = useTextos().hoy
  if (pendientes.length === 0) return <p className={estilos.sinPendientes}>{t.sinPendientes}</p>
  return (
    <ul className={estilos.lista}>
      {pendientes.map(({ texto, icono, ir, detalle, atrasada, clave }) => (
        <li key={clave ?? texto}>
          <button type="button" className={estilos.pendiente} onClick={ir}>
            <Icono nombre={icono} medida={20} />
            <span className={estilos.pendienteTexto} data-detalle={Boolean(detalle) || undefined}>
              {texto}
              {detalle && (
                <span className={estilos.pendienteDetalle} data-atrasada={atrasada || undefined}>
                  {detalle}
                </span>
              )}
            </span>
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
