import type { Tables } from './base.ts'
import { sumarDias } from './fechas.ts'

// En qué está cada tarea, a partir de sus filas de "asignados". Son funciones puras: se prueban con
// node --test src/datos/estadoTareas.test.ts y las usan la lista, el detalle, Hoy y los avisos de la app.

export type Tarea = Tables<'tareas'>
export type Asignado = Tables<'asignados'>

// Cómo se hace: sin asignar, basta con que uno la haga, cada uno la suya, o personal
export type Modo = 'sin' | 'uno' | 'cada' | 'personal'

export type EstadoTarea = {
  modo: Modo
  // Quiénes la tienen (ids), sin quienes ya no están en Puente, en el orden en que se asignaron
  personas: string[]
  // La tengo yo (me la asignaron, me la tomé o es mía por personal)
  mia: boolean
  // Me la tomé con "Me la tomo": la puedo soltar
  tomadaPorMi: boolean
  // Basta con uno y personal: quién la marcó y cuándo
  hechaPor: { persona: string; en: string } | null
  // Cada uno: cuántos la hicieron, de cuántos
  hechas: number
  total: number
  // Cada uno: quiénes faltan
  faltan: string[]
  // Mi parte está hecha (en "basta con uno", la tarea entera)
  miParteHecha: boolean
  // Está hecha del todo
  completa: boolean
}

// "activos" son las personas que siguen en Puente: quien salió no cuenta para "9 de 14" ni para "Faltan"
export function estadoDe(tarea: Tarea, asignados: readonly Asignado[], yo: string, activos: ReadonlySet<string>): EstadoTarea {
  const todas = asignados.filter((a) => a.tarea === tarea.id).sort((a, b) => a.asignado_en.localeCompare(b.asignado_en))
  const filas = todas.filter((a) => activos.has(a.persona))
  const mia = filas.find((a) => a.persona === yo)
  const modo: Modo = tarea.personal ? 'personal' : todas.length === 0 ? 'sin' : tarea.cada_uno ? 'cada' : 'uno'
  // En "basta con uno" vale la primera marca, aunque quien la hizo ya no esté en Puente
  const marcadas = todas.filter((a) => a.hecha_en !== null).sort((a, b) => a.hecha_en!.localeCompare(b.hecha_en!))
  const hechaPor = modo === 'uno' || modo === 'personal' ? (marcadas[0] ? { persona: marcadas[0].persona, en: marcadas[0].hecha_en! } : null) : null
  const hechas = modo === 'cada' ? filas.filter((a) => a.hecha_en !== null).length : 0
  const total = modo === 'cada' ? filas.length : 0
  return {
    modo,
    personas: filas.map((a) => a.persona),
    mia: Boolean(mia),
    tomadaPorMi: Boolean(mia?.tomada),
    hechaPor,
    hechas,
    total,
    faltan: modo === 'cada' ? filas.filter((a) => a.hecha_en === null).map((a) => a.persona) : [],
    miParteHecha: modo === 'cada' ? Boolean(mia?.hecha_en) : hechaPor !== null,
    completa: modo === 'cada' ? total > 0 && hechas === total : hechaPor !== null,
  }
}

// Los grupos de la lista "Por fecha", en orden
export type Grupo = 'atrasadas' | 'semana' | 'adelante' | 'sinFecha'
export const GRUPOS: readonly Grupo[] = ['atrasadas', 'semana', 'adelante', 'sinFecha']

// El domingo de la semana de hoy: las semanas van de lunes a domingo
export function finDeSemana(hoy: string): string {
  const dia = new Date(`${hoy}T00:00:00Z`).getUTCDay()
  return sumarDias(hoy, dia === 0 ? 0 : 7 - dia)
}

// "hoy" es el día de California (hoyEnCalifornia), como en el resto de Puente
export function grupoDe(para: string | null, hoy: string): Grupo {
  if (!para) return 'sinFecha'
  if (para < hoy) return 'atrasadas'
  if (para <= finDeSemana(hoy)) return 'semana'
  return 'adelante'
}

export function atrasada(tarea: Pick<Tarea, 'para'>, estado: Pick<EstadoTarea, 'completa'>, hoy: string): boolean {
  return tarea.para !== null && tarea.para < hoy && !estado.completa
}

// De la que vence antes a la que no tiene fecha; con la misma fecha, la más vieja primero
export function porFecha(a: Pick<Tarea, 'para' | 'creada_en'>, b: Pick<Tarea, 'para' | 'creada_en'>): number {
  if (a.para !== b.para) {
    if (a.para === null) return 1
    if (b.para === null) return -1
    return a.para.localeCompare(b.para)
  }
  return a.creada_en.localeCompare(b.creada_en)
}

// En "Todas" una tarea pasa a Hechas cuando está completa; en "Mías", cuando tu parte está hecha
export function vaEnHechas(estado: Pick<EstadoTarea, 'completa' | 'miParteHecha'>, soloMias: boolean): boolean {
  return soloMias ? estado.miParteHecha : estado.completa
}

// Tus tareas por hacer, para "Tus pendientes" de Hoy: las tuyas donde tu parte falta, de la que vence antes a la
// que no tiene fecha. Las sin asignar no son de nadie todavía, así que no cuentan.
export function misPorHacer(tareas: readonly Tarea[], asignados: readonly Asignado[], yo: string, activos: ReadonlySet<string>): Tarea[] {
  return tareas
    .filter((t) => t.borrada_en === null)
    .filter((t) => {
      const e = estadoDe(t, asignados, yo, activos)
      return e.mia && !e.miParteHecha
    })
    .sort(porFecha)
}
