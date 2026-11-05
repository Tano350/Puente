// Los totales de Gastos, en centavos. Solo lo que hace falta de un gasto y de una parte, para poder probarlos sin la base.
type GastoTotal = { id: string; monto: number; pagado_por: string; division: string }
type ParteTotal = { gasto: string; persona: string; monto: number }

export type Totales = {
  // Lo que gastaste tú: tus partes de los gastos compartidos más tus gastos "Solo mío" enteros
  mios: number
  // Lo que gastó el grupo: la suma de los gastos compartidos (los "Solo mío" de cada uno no entran)
  grupo: number
}

export function totales(gastos: GastoTotal[], partes: ParteTotal[], yo: string): Totales {
  const compartidos = new Set<string>()
  let mios = 0
  let grupo = 0
  for (const g of gastos) {
    if (g.division === 'solo') {
      if (g.pagado_por === yo) mios += g.monto
      continue
    }
    compartidos.add(g.id)
    grupo += g.monto
  }
  for (const p of partes) if (p.persona === yo && compartidos.has(p.gasto)) mios += p.monto
  return { mios, grupo }
}
