import type { Persona } from '../../datos/consultas.ts'
import { diaCorto } from '../../datos/fechas.ts'
import { tieneFechas } from '../../datos/grupo.ts'
import type { Textos } from '../../textos.ts'

// Cómo está cada uno hoy: "Allá", "Llega el 15 ene", "Último día", "Volvió"…
export function estadoDe(p: Persona, yo: string, hoy: string, textos: Textos): string {
  const t = textos.grupo
  if (!p.entro_en) return t.sinEntrar
  if (!tieneFechas(p)) return t.sinFechas
  const tuyo = p.id === yo
  if (hoy < p.llega) return tuyo ? t.llegasCorto(diaCorto(p.llega)) : t.llega(diaCorto(p.llega))
  if (hoy > p.vuelve) return tuyo ? t.volviste : t.volvio
  return hoy === p.vuelve ? t.ultimoDia : t.alla
}
