// Lo escrito sin señal que la base rechazó al subir (borraron el contacto, sacaron a la persona, falló una
// validación…). Se guarda qué era y su nombre, no el texto del aviso: así el aviso se lee en el idioma de la app.
// Son funciones puras (se prueban con node --test, en rechazos.test.ts).

export type TipoRechazo = 'gasto' | 'boleta' | 'rendicion' | 'nota' | 'reunion' | 'otro'
// clave: el mismo id de "sin subir" (el del gasto, "boleta:<gasto>", "reunion:<evento>"…); nombre: el título del
// gasto o del evento, o el nombre del contacto (null si no se encontró)
export type Rechazo = { clave: string; tipo: TipoRechazo; nombre: string | null }

// Dónde buscar los nombres: lo que ya está en las consultas del dispositivo
export type Nombres = {
  gasto: (id: string) => string | null
  contacto: (id: string) => string | null
  evento: (id: string) => string | null
}

function texto(valor: unknown): string | null {
  return typeof valor === 'string' && valor.trim() !== '' ? valor.trim() : null
}

function campo(objeto: unknown, nombre: string): unknown {
  return typeof objeto === 'object' && objeto !== null ? (objeto as Record<string, unknown>)[nombre] : undefined
}

// Qué no subió, a partir de la escritura (su nombre, sus variables y su id de "sin subir")
export function describirRechazo(escritura: string, variables: unknown, clave: string, nombres: Nombres): Rechazo {
  switch (escritura) {
    case 'anotarGasto': {
      const gasto = campo(variables, 'gasto')
      return { clave, tipo: 'gasto', nombre: texto(campo(gasto, 'titulo')) ?? nombres.gasto(String(campo(gasto, 'id'))) }
    }
    case 'subirBoleta':
      return { clave, tipo: 'boleta', nombre: nombres.gasto(String(campo(variables, 'gasto'))) }
    case 'rendir':
      return { clave, tipo: 'rendicion', nombre: nombres.gasto(String(campo(variables, 'gasto'))) }
    case 'agregarNota':
      return { clave, tipo: 'nota', nombre: nombres.contacto(String(campo(campo(variables, 'nota'), 'contacto'))) }
    case 'notaReunion':
      return { clave, tipo: 'reunion', nombre: nombres.evento(String(campo(variables, 'evento'))) }
    default:
      return { clave, tipo: 'otro', nombre: null }
  }
}

// Agrega uno nuevo; si ya estaba (la misma clave), queda el último
export function conRechazo(lista: Rechazo[], nuevo: Rechazo): Rechazo[] {
  return [...lista.filter((r) => r.clave !== nuevo.clave), nuevo]
}

// Lo guardado en el dispositivo puede venir de otra versión: solo se quedan los que tienen la forma de ahora
export function rechazosValidos(guardado: unknown): Rechazo[] {
  if (!Array.isArray(guardado)) return []
  const tipos: TipoRechazo[] = ['gasto', 'boleta', 'rendicion', 'nota', 'reunion', 'otro']
  return guardado.filter(
    (r): r is Rechazo =>
      typeof r === 'object' && r !== null && typeof r.clave === 'string' && tipos.includes(r.tipo) && (r.nombre === null || typeof r.nombre === 'string'),
  )
}

// Lo que se avisa: la foto o la rendición de un gasto que tampoco subió van con ese gasto (se anotan de nuevo juntos)
export function rechazosAAvisar(lista: Rechazo[]): Rechazo[] {
  const gastos = new Set(lista.filter((r) => r.tipo === 'gasto').map((r) => r.clave))
  return lista.filter((r) => !((r.tipo === 'boleta' || r.tipo === 'rendicion') && gastos.has(r.clave.slice(r.clave.indexOf(':') + 1))))
}

// Los textos del aviso (la sección "rechazos" de textos.ts)
export type TextosRechazos = {
  uno: Record<TipoRechazo, (nombre: string | null) => string>
  cosa: Record<TipoRechazo, (nombre: string | null) => string>
  varios: (cuantas: number, cosas: string) => string
  mas: (cuantas: number) => string
}

// Uno: dice qué y qué hacer. Varios: los nombra (hasta tres; si son más, "y N más").
export function textoRechazos(lista: Rechazo[], t: TextosRechazos, y: (partes: string[]) => string): string | null {
  const avisar = rechazosAAvisar(lista)
  const [primero] = avisar
  if (!primero) return null
  if (avisar.length === 1) return t.uno[primero.tipo](primero.nombre)
  const cosas = avisar.map((r) => t.cosa[r.tipo](r.nombre))
  return t.varios(avisar.length, y(cosas.length > 3 ? [...cosas.slice(0, 2), t.mas(cosas.length - 2)] : cosas))
}
