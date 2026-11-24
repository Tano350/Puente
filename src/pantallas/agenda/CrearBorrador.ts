import type { Contacto } from '../../datos/contactos.ts'
import { soloParaTema, type Evento, type ModoEvento, type TipoEvento } from '../../datos/eventos.ts'
import { diaEn, hora, momento } from '../../datos/fechas.ts'
import type { Textos } from '../../textos.ts'

// Lo que se va llenando en "Nuevo" (un evento o un rato ocupado) o al editar un evento. Las horas son de California.

export type Clase = 'evento' | 'ocupado'

export type Borrador = {
  clase: Clase
  tipo: TipoEvento | null
  titulo: string
  dia: string | null
  empieza: string | null
  termina: string | null
  lugar: string
  direccion: string
  modo: ModoEvento
  cupos: number
  // El tema al que va primero (solo en para todos o con cupo); null si es para todos desde el inicio
  tema: string | null
  elegidos: string[]
  notas: string
}

export type Errores = { titulo?: string; dia?: string; hora?: string }

type TextosCrear = Textos['agenda']['crear']

// Los cupos van de 1 a los 14 del grupo
export const CUPOS = { min: 1, max: 14 }

// La reunión con un contacto parte con su nombre, tipo Reunión y 4 cupos. Lo demás parte en el día que se miraba.
export function borradorInicial(t: TextosCrear, desdeContacto?: Contacto, dia?: string): Borrador {
  return {
    clase: 'evento',
    tipo: desdeContacto ? 'reunion' : null,
    titulo: desdeContacto ? t.reunionCon(desdeContacto.nombre) : '',
    dia: dia ?? null,
    empieza: null,
    termina: null,
    lugar: '',
    direccion: '',
    modo: desdeContacto ? 'con_cupo' : 'para_todos',
    cupos: desdeContacto ? 4 : 8,
    tema: null,
    elegidos: [],
    notas: '',
  }
}

// Al editar, el borrador parte con lo que tiene el evento; sin cupos, los 8 de "Nuevo" por si pasa a "Con cupo".
// Las personas de uno cerrado se cambian en el evento, no aquí.
export function borradorDe(evento: Evento): Borrador {
  return {
    clase: 'evento',
    tipo: evento.tipo,
    titulo: evento.titulo,
    dia: diaEn(evento.inicio),
    empieza: hora(evento.inicio),
    termina: hora(evento.fin),
    lugar: evento.lugar ?? '',
    direccion: evento.direccion ?? '',
    modo: evento.modo,
    cupos: evento.cupos ?? 8,
    tema: soloParaTema(evento) ? evento.tema : null,
    elegidos: [],
    notas: evento.notas ?? '',
  }
}

const aMinutos = (hora: string) => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5))
const aHora = (minutos: number) => `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`

// Al cambiar el inicio, el término se corre con él (dura lo mismo o, si no había, una hora), sin pasar de medianoche
export function conInicio(b: Borrador, empieza: string | null): Partial<Borrador> {
  if (!empieza) return { empieza: null, termina: null }
  const dura = b.empieza && b.termina && b.termina > b.empieza ? aMinutos(b.termina) - aMinutos(b.empieza) : 60
  return { empieza, termina: aHora(Math.min(aMinutos(empieza) + dura, 24 * 60 - 1)) }
}

export const alReves = (b: Pick<Borrador, 'empieza' | 'termina'>) => Boolean(b.empieza && b.termina && b.termina <= b.empieza)

// Cualquier día sirve: antes, durante o después del viaje
export function validar(b: Borrador, t: TextosCrear): Errores {
  return {
    titulo: b.titulo.trim() ? undefined : b.clase === 'evento' ? t.faltaNombre : t.faltaQue,
    dia: b.dia ? undefined : t.faltaDia,
    hora: !b.empieza ? t.faltaInicio : !b.termina ? t.faltaFin : alReves(b) ? t.alReves : undefined,
  }
}

// Inicio y fin guardables (en UTC), si el día y las horas están completos y en orden
export function rangoDe(b: Borrador): { inicio: string; fin: string } | null {
  if (!b.dia || !b.empieza || !b.termina || alReves(b)) return null
  return { inicio: momento(b.dia, b.empieza), fin: momento(b.dia, b.termina) }
}

// Lo que se guarda del evento. Al editar se compara con lo del borrador inicial, para mandar solo lo que cambió.
export function datosDe(b: Borrador, horas: { inicio: string; fin: string }) {
  return {
    titulo: b.titulo.trim(),
    tipo: b.tipo ?? 'otro',
    lugar: b.lugar.trim() || null,
    direccion: b.direccion.trim() || null,
    ...horas,
    modo: b.modo,
    cupos: b.modo === 'con_cupo' ? b.cupos : null,
    tema: b.modo === 'cerrado' ? null : b.tema,
    notas: b.notas.trim() || null,
  }
}

// El tema no está: al editar se cambia aparte (cambiosDeTema)
export const CAMBIABLES = ['titulo', 'tipo', 'lugar', 'direccion', 'inicio', 'fin', 'modo', 'cupos', 'notas'] as const satisfies readonly (keyof ReturnType<typeof datosDe>)[]

// Al editar, el tema se cambia con reglas propias: cerrado no lleva tema, «Todos» abre el evento a todos (abierto_en) y
// otro tema lo cambia. Devuelve lo que se manda y lo que lo deshace, o null si el tema queda igual.
export function cambiosDeTema(original: Evento, datos: { modo: ModoEvento; tema: string | null }, abiertoEn: string): { cambio: Partial<Pick<Evento, 'tema' | 'abierto_en'>>; antes: Partial<Pick<Evento, 'tema' | 'abierto_en'>> } | null {
  if (datos.modo === 'cerrado') return original.tema === null ? null : { cambio: { tema: null }, antes: { tema: original.tema } }
  if (!soloParaTema(original) || datos.tema === original.tema) return null
  if (datos.tema === null) return { cambio: { abierto_en: abiertoEn }, antes: { abierto_en: null } }
  return { cambio: { tema: datos.tema }, antes: { tema: original.tema } }
}
