import { useMemo } from 'react'
import { usePersonas, type Persona } from './consultas.ts'
import { ventanaDelViaje, type Ventana } from './fechas.ts'
import { useSesion } from './sesion.tsx'

// Lo que comparten Grupo e Invitados: quiénes siguen en Puente, en qué orden y cómo se buscan.

// La ventana del viaje según las estadías de quienes siguen en Puente: enero y febrero, estirada si alguien llega
// antes o se va después. La usan los gráficos de Grupo y la Agenda. Tus fechas salen de la sesión, que tiene las
// recién guardadas aunque la lista del grupo todavía no se recargue.
export function useViaje(): Ventana {
  const { data: personas } = usePersonas()
  const sesion = useSesion()
  const yo = sesion.tipo === 'dentro' ? sesion.persona : null
  return useMemo(() => ventanaDelViaje([...(personas ?? []).filter((p) => !p.sacada_en), ...(yo ? [yo] : [])]), [personas, yo])
}

export type ConFechas = Persona & { llega: string; vuelve: string }

export function tieneFechas(persona: Persona): persona is ConFechas {
  return Boolean(persona.llega && persona.vuelve)
}

export function estaAlla(persona: Persona, dia: string): boolean {
  return tieneFechas(persona) && persona.llega <= dia && dia <= persona.vuelve
}

export const porNombre = (a: Persona, b: Persona) => (a.nombre ?? a.correo).localeCompare(b.nombre ?? b.correo, 'es')

// Quien mira va primero; después los que entraron, por nombre, y al final los que todavía no entran
export function integrantes(personas: Persona[], yo: string): Persona[] {
  return personas
    .filter((p) => !p.sacada_en)
    .sort((a, b) => {
      if (a.id === yo || b.id === yo) return a.id === yo ? -1 : 1
      if (Boolean(a.entro_en) !== Boolean(b.entro_en)) return a.entro_en ? -1 : 1
      return a.entro_en ? porNombre(a, b) : a.correo.localeCompare(b.correo)
    })
}

// Para buscar sin fijarse en tildes ni mayúsculas
export function plano(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

// Busca en el nombre y en el correo antes de la @ (después de la @ casi todos dicen "gmail")
export function coincide(persona: Persona, busqueda: string): boolean {
  const buscado = plano(busqueda.trim())
  return !buscado || plano(`${persona.nombre ?? ''} ${persona.correo.split('@')[0]}`).includes(buscado)
}

export function porLlegada(a: ConFechas, b: ConFechas): number {
  return a.llega.localeCompare(b.llega)
}
