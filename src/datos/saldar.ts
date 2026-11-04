// Las menos transferencias posibles para que todos queden en cero.
// Los saldos van en centavos de dólar: positivo es lo que le deben a esa persona; negativo, lo que debe.
// Un grupo de personas cuyos saldos suman cero se salda entre ellas con una transferencia menos que personas, así que
// lo mejor es partir al grupo en la mayor cantidad de grupos que sumen cero. Se prueban todos los subconjuntos
// (con 14 personas son 16.384). Dentro de cada grupo, quien más debe le paga a quien más le deben.
// Sin dependencias, para probarlo con node --test.

export type Transferencia = { de: string; a: string; monto: number }

export function transferencias(saldos: Record<string, number>): Transferencia[] {
  const gente = Object.keys(saldos)
    .filter((p) => saldos[p] !== 0)
    .sort()
  const n = gente.length
  if (n === 0) return []
  const todos = (1 << n) - 1
  const suma = new Float64Array(todos + 1)
  for (let m = 1; m <= todos; m++) {
    const bit = m & -m
    suma[m] = suma[m ^ bit] + saldos[gente[31 - Math.clz32(bit)]]
  }
  if (suma[todos] !== 0) throw new Error('Los saldos no suman cero')

  // grupos[m]: cuántos grupos que suman cero caben como máximo en las personas de m, sacándolas de a una
  const grupos = new Uint8Array(todos + 1)
  for (let m = 1; m <= todos; m++) {
    let mejor = 0
    for (let resto = m; resto; resto &= resto - 1) {
      const sin = grupos[m ^ (resto & -resto)]
      if (sin > mejor) mejor = sin
    }
    grupos[m] = mejor + (suma[m] === 0 ? 1 : 0)
  }

  // Se recorre el camino que da el máximo: cada vez que lo que queda suma cero, se cierra un grupo
  const partes: string[][] = []
  let actual: string[] = []
  for (let m = todos; m; ) {
    const cierra = suma[m] === 0 ? 1 : 0
    let elegido = 0
    for (let resto = m; resto; resto &= resto - 1) {
      const bit = resto & -resto
      if (grupos[m ^ bit] === grupos[m] - cierra) {
        elegido = bit
        break
      }
    }
    actual.push(gente[31 - Math.clz32(elegido)])
    m ^= elegido
    if (suma[m] === 0) {
      partes.push(actual)
      actual = []
    }
  }

  return partes.flatMap((grupo) => saldarGrupo(grupo.map((p) => ({ persona: p, saldo: saldos[p] }))))
}

// Dentro de un grupo que suma cero: quien más debe le paga a quien más le deben, hasta que todos quedan en cero
function saldarGrupo(grupo: { persona: string; saldo: number }[]): Transferencia[] {
  const orden = (a: { persona: string; saldo: number }, b: { persona: string; saldo: number }) =>
    Math.abs(b.saldo) - Math.abs(a.saldo) || a.persona.localeCompare(b.persona)
  const deben = grupo.filter((g) => g.saldo < 0).map((g) => ({ ...g }))
  const lesDeben = grupo.filter((g) => g.saldo > 0).map((g) => ({ ...g }))
  const salida: Transferencia[] = []
  while (deben.length && lesDeben.length) {
    deben.sort(orden)
    lesDeben.sort(orden)
    const d = deben[0]
    const c = lesDeben[0]
    const monto = Math.min(-d.saldo, c.saldo)
    salida.push({ de: d.persona, a: c.persona, monto })
    d.saldo += monto
    c.saldo -= monto
    if (d.saldo === 0) deben.shift()
    if (c.saldo === 0) lesDeben.shift()
  }
  return salida
}
