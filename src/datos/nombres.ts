import type { Persona } from './consultas.ts'

// "Ingeniería Civil Química" se muestra como "Química" en la cinta de la tarjeta
export function carreraCorta(carrera: string | null): string {
  if (!carrera) return ''
  const resto = carrera.replace(/^Ingeniería Civil\s*(en |de )?/i, '').trim()
  return resto ? resto[0].toUpperCase() + resto.slice(1) : 'Civil'
}

export function primerNombre(persona: Pick<Persona, 'nombre' | 'correo'>): string {
  return persona.nombre?.trim().split(/\s+/)[0] || persona.correo.split('@')[0]
}
