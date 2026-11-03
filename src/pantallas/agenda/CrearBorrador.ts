import type { Contacto } from '../../datos/contactos.ts'
import type { ModoEvento, TipoEvento } from '../../datos/eventos.ts'
import { momento, rango, VIAJE } from '../../datos/fechas.ts'
import type { Textos } from '../../textos.ts'

// Lo que se va llenando en "Nuevo": un evento o un rato ocupado. Las horas son de California.

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
    elegidos: [],
    notas: '',
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

export function validar(b: Borrador, t: TextosCrear): Errores {
  // Escribiendo con el teclado se puede salir del viaje, aunque el calendario no lo deje
  const fuera = b.dia && (b.dia < VIAJE.desde || b.dia > VIAJE.hasta)
  return {
    titulo: b.titulo.trim() ? undefined : b.clase === 'evento' ? t.faltaNombre : t.faltaQue,
    dia: !b.dia ? t.faltaDia : fuera ? t.fueraDelViaje(rango(VIAJE.desde, VIAJE.hasta)) : undefined,
    hora: !b.empieza ? t.faltaInicio : !b.termina ? t.faltaFin : alReves(b) ? t.alReves : undefined,
  }
}

// Inicio y fin guardables (en UTC), si el día y las horas están completos y en orden
export function rangoDe(b: Borrador): { inicio: string; fin: string } | null {
  if (!b.dia || !b.empieza || !b.termina || alReves(b)) return null
  return { inicio: momento(b.dia, b.empieza), fin: momento(b.dia, b.termina) }
}
