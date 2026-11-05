import type { Persona } from '../../datos/consultas.ts'
import { hoyEnCalifornia } from '../../datos/fechas.ts'
import { aCentavos, CATEGORIAS, categoriaDe, plata, repartirIguales, type Categoria, type DatosGasto, type Division, type Gasto, type Parte } from '../../datos/gastos.ts'
import { estaAlla, tieneFechas } from '../../datos/grupo.ts'
import { primerNombre } from '../../datos/nombres.ts'
import type { Textos } from '../../textos.ts'

// Lo que se va llenando en "Nuevo gasto" o al editar uno. Los montos van como se escriben y pasan a centavos al anotar.

export type Borrador = {
  titulo: string
  categoria: Categoria
  // Elegida a mano: ya no cambia con lo que se escribe
  categoriaFija: boolean
  monto: string
  fecha: string
  pagadoPor: string
  division: Division
  elegidos: string[]
  // Elegidos a mano: ya no cambian con la fecha
  elegidosFijos: boolean
  // Lo que se escribió para cada uno en montos exactos; queda aunque lo desmarquen
  exactos: Record<string, string>
}

export type Errores = { titulo?: string; monto?: string; personas?: string; partes?: string[]; cuadra?: boolean }

// Lo que sale del borrador: el total (si es un monto), los marcados en el orden de la lista y la parte de cada uno
export type Cuenta = { total: number | null; marcados: string[]; pagador: string; partes: { persona: string; monto: number }[]; suma: number }

const DIVISIONES = ['iguales', 'exactos', 'solo'] as const satisfies readonly Division[]
// Lo más que cabe en la base (centavos en un entero)
const MAXIMO = 2_147_483_647

// "US$ 1.234,56" sin "US$", como va en los campos
export const sinMoneda = (centavos: number) => plata(centavos).replace('US$ ', '')

// En los campos de monto solo caben cifras, puntos y comas
export const soloMonto = (texto: string) => texto.replace(/[^\d.,]/g, '')

// Al salir del campo, el monto queda como "38,40"
export function ordenarMonto(texto: string): string {
  const centavos = aCentavos(texto)
  return centavos === null || centavos > MAXIMO ? texto : sinMoneda(centavos)
}

const montoDe = (texto: string): number | null => {
  const centavos = aCentavos(texto)
  return centavos !== null && centavos <= MAXIMO ? centavos : null
}

// "gente": las personas de la lista, en orden. Parte con quienes están allá hoy.
export function borradorNuevo(yo: string, gente: Persona[]): Borrador {
  const fecha = hoyEnCalifornia()
  return { titulo: '', categoria: 'otro', categoriaFija: false, monto: '', fecha, pagadoPor: yo, division: 'iguales', elegidos: presentes(gente, fecha), elegidosFijos: false, exactos: {} }
}

// Quienes están allá ese día según sus fechas de estadía. Quien no puso fechas cuenta (no se sabe que no esté);
// si así no queda nadie (un gasto de antes o después del viaje), son todos.
export function presentes(gente: Persona[], fecha: string): string[] {
  const alla = gente.filter((p) => !tieneFechas(p) || estaAlla(p, fecha)).map((p) => p.id)
  return alla.length ? alla : gente.map((p) => p.id)
}

// Los de tu último gasto compartido (el último que anotaste), en el orden de la lista; null si no hay
export function ultimoGrupo(gastos: Gasto[], partes: Parte[], yo: string, orden: string[]): string[] | null {
  const ultimo = gastos.filter((g) => g.creado_por === yo && g.division !== 'solo').reduce<Gasto | null>((a, g) => (!a || g.creado_en > a.creado_en ? g : a), null)
  if (!ultimo) return null
  const suyas = new Set(partes.filter((p) => p.gasto === ultimo.id).map((p) => p.persona))
  const grupo = orden.filter((id) => suyas.has(id))
  return grupo.length ? grupo : null
}

// Al editar parte con lo que tiene el gasto. Si la categoría no es la que se adivina del título, la eligieron a mano.
export function borradorDe(gasto: Gasto, partes: Parte[]): Borrador {
  const categoria = CATEGORIAS.find((c) => c === gasto.categoria) ?? 'otro'
  const division = DIVISIONES.find((d) => d === gasto.division) ?? 'iguales'
  return {
    titulo: gasto.titulo,
    categoria,
    categoriaFija: categoria !== categoriaDe(gasto.titulo),
    monto: sinMoneda(gasto.monto),
    fecha: gasto.fecha,
    pagadoPor: gasto.pagado_por,
    division,
    elegidos: partes.map((p) => p.persona),
    elegidosFijos: true,
    exactos: division === 'exactos' ? Object.fromEntries(partes.map((p) => [p.persona, sinMoneda(p.monto)])) : {},
  }
}

// Lo que el gasto tenía guardado, para ver si cambió algo
export function datosGuardados(gasto: Gasto, partes: Parte[]): DatosGasto {
  return {
    titulo: gasto.titulo,
    categoria: CATEGORIAS.find((c) => c === gasto.categoria) ?? 'otro',
    monto: gasto.monto,
    fecha: gasto.fecha,
    pagado_por: gasto.pagado_por,
    division: DIVISIONES.find((d) => d === gasto.division) ?? 'iguales',
    partes: partes.map(({ persona, monto }) => ({ persona, monto })),
  }
}

// "orden": los ids de la lista. Al editar, si siguen las mismas personas y el mismo total en partes iguales,
// cada uno conserva su parte (los centavos sobrantes no se cambian de dueño).
export function cuentaDe(b: Borrador, orden: string[], yo: string, antes?: DatosGasto): Cuenta {
  const total = montoDe(b.monto)
  const marcados = orden.filter((id) => b.elegidos.includes(id))
  const pagador = b.division === 'solo' ? yo : b.pagadoPor
  const suma = marcados.reduce((s, id) => s + (montoDe(b.exactos[id] ?? '') ?? 0), 0)
  let partes: Cuenta['partes'] = []
  if (b.division === 'solo') partes = [{ persona: yo, monto: total ?? 0 }]
  else if (b.division === 'exactos') partes = marcados.map((persona) => ({ persona, monto: montoDe(b.exactos[persona] ?? '') ?? 0 }))
  else if (marcados.length > 0) {
    const mismas = antes?.division === 'iguales' && antes.monto === total && antes.partes.length === marcados.length && antes.partes.every((p) => marcados.includes(p.persona))
    partes = mismas ? marcados.map((persona) => ({ persona, monto: antes.partes.find((p) => p.persona === persona)?.monto ?? 0 })) : repartirIguales(total ?? 0, marcados)
  }
  return { total, marcados, pagador, partes, suma }
}

export function validar(b: Borrador, c: Cuenta, t: Textos['gastos']['anotar']): Errores {
  const sinMonto = !b.monto.trim() || c.total === 0
  const exactos = b.division === 'exactos'
  return {
    titulo: b.titulo.trim() ? undefined : t.faltaQue,
    monto: sinMonto ? t.faltaMonto : c.total === null ? t.montoRaro : undefined,
    personas: b.division !== 'solo' && c.marcados.length === 0 ? t.faltaPersona : undefined,
    partes: exactos ? c.marcados.filter((id) => (b.exactos[id] ?? '').trim() && montoDe(b.exactos[id] ?? '') === null) : undefined,
    cuadra: exactos && c.total !== null && c.marcados.length > 0 && c.suma !== c.total,
  }
}

export const hayErrores = (e: Errores) => Boolean(e.titulo || e.monto || e.personas || e.partes?.length || e.cuadra)

// Lo que se anota; solo con un borrador sin errores
export function datosDe(b: Borrador, c: Cuenta): DatosGasto {
  return { titulo: b.titulo.trim(), categoria: b.categoria, monto: c.total ?? 0, fecha: b.fecha, pagado_por: c.pagador, division: b.division, partes: c.partes }
}

export function mismosDatos(a: DatosGasto, b: DatosGasto): boolean {
  const clave = ({ partes, ...resto }: DatosGasto) =>
    JSON.stringify([resto.titulo, resto.categoria, resto.monto, resto.fecha, resto.pagado_por, resto.division, [...partes].sort((x, y) => x.persona.localeCompare(y.persona))])
  return clave(a) === clave(b)
}

// El primer nombre de cada uno; con dos del mismo nombre, va también la inicial del apellido
export function nombresCortos(personas: Persona[]): Map<string, string> {
  const primeros = personas.map((p) => primerNombre(p))
  return new Map(
    personas.map((p, i) => {
      const apellido = p.nombre?.trim().split(/\s+/).slice(1).pop()
      const repetido = primeros.indexOf(primeros[i]) !== primeros.lastIndexOf(primeros[i])
      return [p.id, apellido && repetido ? `${primeros[i]} ${apellido[0]}.` : primeros[i]]
    }),
  )
}
