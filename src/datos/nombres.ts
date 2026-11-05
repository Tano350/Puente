import type { Persona } from './consultas.ts'

// "Ingeniería Comercial" y "Ingeniería Civil" se muestran "Comercial" y "Civil"; un texto viejo como "Ingeniería Civil Química" se muestra como "Química" en la cinta de la tarjeta
export function carreraCorta(carrera: string | null): string {
  if (!carrera) return ''
  if (carrera === 'Ingeniería Comercial') return 'Comercial'
  if (carrera === 'Ingeniería Civil') return 'Civil'
  const resto = carrera.replace(/^Ingeniería Civil\s*(en |de )?/i, '').trim()
  return resto ? resto[0].toUpperCase() + resto.slice(1) : 'Civil'
}

// Quien todavía no pone su nombre se muestra con uno sacado de su correo: "martin.ossa@…" → "Martin Ossa".
// Las tildes no se pueden adivinar; el nombre de verdad llega cuando la persona entra.
export function nombreDelCorreo(correo: string): string {
  const antes = correo.split('@')[0]
  const partes = antes
    .split(/[._+-]+/)
    .map((parte) => parte.replace(/\d+$/, ''))
    .filter(Boolean)
  if (partes.length === 0) return antes
  return partes.map((parte) => parte[0].toUpperCase() + parte.slice(1).toLowerCase()).join(' ')
}

// El nombre para mostrar: el que puso la persona (o el provisorio con que la invitaron) o, si no hay, el del correo
export function nombreCompleto(persona: Pick<Persona, 'nombre' | 'correo'>): string {
  return persona.nombre?.trim() || nombreDelCorreo(persona.correo)
}

export function primerNombre(persona: Pick<Persona, 'nombre' | 'correo'>): string {
  return nombreCompleto(persona).split(/\s+/)[0]
}
