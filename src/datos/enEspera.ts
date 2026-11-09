import type { Tables } from './base.ts'

// Sin señal, lo escrito queda en espera y se ve igual en las listas: estas funciones ponen lo que todavía no sube
// sobre lo que trae la base. Son puras (se prueban con node --test) y se pueden repetir sin duplicar nada:
// si la base ya lo tiene, no se agrega otra vez.

type Gasto = Tables<'gastos'>
type Parte = Tables<'partes'>
type Rendicion = Tables<'rendiciones'>
type Nota = Tables<'notas'>
type NotaReunion = Tables<'notas_reunion'>
type Asignado = Tables<'asignados'>

// ¿Falló por la red (sin señal, señal mala, sin sesión todavía) y no porque la base lo rechazó? Lo primero se reintenta.
export function esErrorDeRed(error: unknown): boolean {
  if (error instanceof TypeError) return true
  if (typeof error !== 'object' || error === null) return false
  const { code, name, message } = error as { code?: unknown; name?: unknown; message?: unknown }
  if (name === 'SinSesion') return true
  // Los errores de la base traen su código (23505, 42501, PGRST…); los de la red llegan sin código
  if (typeof code === 'string' && code !== '') return false
  return /fetch|network|load failed|timed? ?out|abort|StorageUnknownError/i.test(`${String(name ?? '')} ${String(message ?? '')}`)
}

// Como en la lista: del día más nuevo al más viejo y, dentro del día, el último anotado primero
export function ordenDeGastos(a: Gasto, b: Gasto): number {
  return b.fecha.localeCompare(a.fecha) || b.creado_en.localeCompare(a.creado_en)
}

export function conGasto(lista: Gasto[], gasto: Gasto): Gasto[] {
  return lista.some((g) => g.id === gasto.id) ? lista : [gasto, ...lista].sort(ordenDeGastos)
}

export function conPartes(lista: Parte[], partes: Parte[]): Parte[] {
  const gasto = partes[0]?.gasto
  return !gasto || lista.some((p) => p.gasto === gasto) ? lista : [...lista, ...partes]
}

// "por" es quién puso la foto: sin foto no hay quien la puso, así que quitarla lo deja en null
export function conBoleta(lista: Gasto[], gasto: string, ruta: string | null, por: string | null = null): Gasto[] {
  const quien = ruta ? por : null
  return lista.map((g) => (g.id === gasto && (g.boleta !== ruta || (g.boleta_por ?? null) !== quien) ? { ...g, boleta: ruta, boleta_por: quien } : g))
}

export function conRendicion(lista: Rendicion[], cambio: { gasto: string; si: boolean; persona: string; marcado_en: string }): Rendicion[] {
  const sin = lista.filter((r) => r.gasto !== cambio.gasto)
  if (!cambio.si) return sin
  const antes = lista.find((r) => r.gasto === cambio.gasto)
  return [...sin, antes ?? { gasto: cambio.gasto, persona: cambio.persona, marcado_en: cambio.marcado_en }]
}

export function conNota(lista: Nota[], nota: Nota): Nota[] {
  return lista.some((n) => n.id === nota.id) ? lista : [...lista, nota].sort((a, b) => a.creada_en.localeCompare(b.creada_en))
}

export function sinNota(lista: Nota[], id: string): Nota[] {
  return lista.filter((n) => n.id !== id)
}

// Una nota por persona y evento: la escrita reemplaza a la que hubiera
export function conNotaReunion(lista: NotaReunion[], nota: NotaReunion): NotaReunion[] {
  return [...lista.filter((n) => !(n.evento === nota.evento && n.autor === nota.autor)), nota]
}

// Marcar o desmarcar una tarea: lleva el estado al que queda, con las mismas reglas que marcar_tarea en la base
// (20261110000000_tareas.sql). "cadaUno": cada uno marca la suya. Si no, marcar pone la tuya solo si nadie la marcó
// y desmarcar la deja por hacer para todos. Si no la tienes, no cambia nada (la base lo va a rechazar).
export type Marca = { tarea: string; hecha: boolean; persona: string; cadaUno: boolean; en: string }

export function conMarca(lista: Asignado[], marca: Marca): Asignado[] {
  const filas = lista.filter((a) => a.tarea === marca.tarea)
  if (!filas.some((a) => a.persona === marca.persona)) return lista
  const yaMarcada = filas.some((a) => a.hecha_en !== null)
  const nueva = lista.map((a) => {
    if (a.tarea !== marca.tarea) return a
    const mia = a.persona === marca.persona
    let hecha_en = a.hecha_en
    if (marca.cadaUno) hecha_en = mia ? (marca.hecha ? (a.hecha_en ?? marca.en) : null) : a.hecha_en
    else if (!marca.hecha) hecha_en = null
    else if (mia && !yaMarcada) hecha_en = marca.en
    return hecha_en === a.hecha_en ? a : { ...a, hecha_en }
  })
  return nueva.every((a, i) => a === lista[i]) ? lista : nueva
}

// Lo que espera, en el orden en que se escribió, puesto sobre los datos de una consulta
export type Pendiente = { nombre: string; variables: unknown }
export type Sobre = (datos: never, variables: never) => unknown
export function aplicarPendientes<T>(clave: string, datos: T, pendientes: Pendiente[], sobre: (nombre: string, clave: string) => Sobre | undefined): T {
  let resultado: unknown = datos
  for (const { nombre, variables } of pendientes) {
    const poner = sobre(nombre, clave) as ((datos: unknown, variables: unknown) => unknown) | undefined
    if (poner && resultado !== undefined) resultado = poner(resultado, variables)
  }
  return resultado as T
}
