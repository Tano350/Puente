import { grupoDe, GRUPOS, porFecha, vaEnHechas, type EstadoTarea, type Grupo, type Tarea } from '../../datos/estadoTareas.ts'

export type OrdenLista = { grupos: { grupo: Grupo; lista: Tarea[] }[]; hechas: Tarea[] }

// Cómo se reparte la lista "Por fecha": los grupos en orden (solo los que tienen tareas) y las hechas al final.
// "Mías" deja solo las que tienen tu parte; "quedan" son las que acabas de marcar y siguen en su lugar un momento.
export function ordenarLista(tareas: readonly Tarea[], estados: ReadonlyMap<string, EstadoTarea>, soloMias: boolean, hoy: string, quedan: ReadonlySet<string> = new Set()): OrdenLista {
  const visibles = tareas.filter((t) => !soloMias || estados.get(t.id)?.mia).sort(porFecha)
  const hechas: Tarea[] = []
  const pendientes: Tarea[] = []
  for (const t of visibles) {
    const e = estados.get(t.id)
    if (e && vaEnHechas(e, soloMias) && !quedan.has(t.id)) hechas.push(t)
    else pendientes.push(t)
  }
  const grupos = GRUPOS.map((grupo) => ({ grupo, lista: pendientes.filter((t) => grupoDe(t.para, hoy) === grupo) })).filter((g) => g.lista.length > 0)
  return { grupos, hechas }
}

// Las tareas en el orden en que se ven, para elegir la primera o la que sigue
export function enOrden(orden: OrdenLista): Tarea[] {
  return [...orden.grupos.flatMap((g) => g.lista), ...orden.hechas]
}
