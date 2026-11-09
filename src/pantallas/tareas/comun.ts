import { useMemo } from 'react'
import { usePersonas, type Persona } from '../../datos/consultas.ts'
import { estadoDe, type Asignado, type EstadoTarea, type Tarea } from '../../datos/estadoTareas.ts'
import { diaDeLaSemana, diaLargo, diasEntre } from '../../datos/fechas.ts'
import { idiomaActual, type Idioma } from '../../datos/idioma.ts'
import { primerNombre } from '../../datos/nombres.ts'
import type { Textos } from '../../textos.ts'

// Lo que comparten la lista, el detalle y crear una tarea: quiénes siguen en Puente, el estado de cada tarea,
// cómo se nombra a quién le toca y cómo se ven las fechas.

// Ids de quienes siguen en Puente: quien salió no cuenta en "9 de 14" ni en "Faltan"
export function activosDe(personas: readonly Persona[] | undefined): ReadonlySet<string> {
  return new Set((personas ?? []).filter((p) => !p.sacada_en).map((p) => p.id))
}

// El estado de cada tarea, por id
export function useEstados(tareas: readonly Tarea[] | undefined, asignados: readonly Asignado[] | undefined, yo: string): Map<string, EstadoTarea> {
  const { data: personas } = usePersonas()
  return useMemo(() => {
    const activos = activosDe(personas)
    return new Map((tareas ?? []).map((t) => [t.id, estadoDe(t, asignados ?? [], yo, activos)]))
  }, [tareas, asignados, personas, yo])
}

// "Tú" o el primer nombre ("Diego"); si la persona no está en la lista (ya salió), su id no se muestra: queda "Alguien"
export function nombreDe(id: string, personas: readonly Persona[] | undefined, yo: string, textos: Textos): string {
  if (id === yo) return textos.tareas.comun.tu
  const persona = personas?.find((p) => p.id === id)
  return persona ? primerNombre(persona) : textos.tareas.comun.alguien
}

// Nombres con "Tú" primero: ["Tú", "Diego"]
export function nombresDe(ids: readonly string[], personas: readonly Persona[] | undefined, yo: string, textos: Textos): string[] {
  const orden = [...ids].sort((a, b) => Number(b === yo) - Number(a === yo))
  return orden.map((id) => nombreDe(id, personas, yo, textos))
}

// La línea de quién en la lista y en el detalle: "Tú o Diego", "Catalina", "9 de 14 ya la hicieron", "Sin asignar",
// "Personal". La "o" dice que basta con que uno la haga.
export function quien(estado: EstadoTarea, personas: readonly Persona[] | undefined, yo: string, textos: Textos): string {
  const t = textos.tareas.comun
  switch (estado.modo) {
    case 'personal':
      return t.personal
    case 'sin':
      return t.sinAsignar
    case 'cada':
      return t.yaLaHicieron(estado.hechas, estado.total)
    case 'uno':
      return textos.o(nombresDe(estado.personas, personas, yo, textos))
  }
}

// Las partes del bloque de fecha grande: "vie" / "13" / "nov" ("Fri" / "13" / "Nov" en inglés)
export function partesDeFecha(iso: string, idioma: Idioma = idiomaActual()): { semana: string; dia: string; mes: string } {
  const d = new Date(`${iso}T12:00:00Z`)
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(idioma === 'en' ? 'en-US' : 'es-CL', { timeZone: 'UTC', ...o }).format(d).replace('.', '')
  return { semana: f({ weekday: 'short' }), dia: String(d.getUTCDate()), mes: f({ month: 'short' }) }
}

// El día en palabras para "Para el …" y "Venció el …": cerca de hoy basta "viernes 13"; más lejos va con el mes,
// "martes 1 de diciembre"
export function diaDeTarea(iso: string, hoy: string, idioma: Idioma = idiomaActual()): string {
  const distancia = Math.abs(diasEntre(hoy, iso) - 1)
  return distancia <= 6 ? diaDeLaSemana(iso, idioma) : diaLargo(iso, idioma)
}
