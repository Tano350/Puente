import { secciones } from './secciones.ts'

export type Seccion = (typeof secciones)[number]['clave']

// La última sección donde estuvo la persona (Hoy, Agenda…): Tu perfil se abre desde varias y "volver" regresa a esa.
// Si la app se abre directo en Tu perfil, vale Hoy.
let ultima: Seccion = 'hoy'

export function recordarSeccion(ruta: string): void {
  const encontrada = secciones.find((s) => ruta === s.ruta || ruta.startsWith(`${s.ruta}/`))
  if (encontrada) ultima = encontrada.clave
}

export const seccionPrevia = (): Seccion => ultima
