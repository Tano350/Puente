// node --test src/datos/saldar.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { transferencias, type Transferencia } from './saldar.ts'

// Aplica las transferencias y devuelve cómo quedan los saldos
function aplicar(saldos: Record<string, number>, lista: Transferencia[]): Record<string, number> {
  const quedan = { ...saldos }
  for (const t of lista) {
    assert.ok(t.monto > 0 && Number.isInteger(t.monto), `monto inválido ${t.monto}`)
    assert.notEqual(t.de, t.a)
    quedan[t.de] += t.monto
    quedan[t.a] -= t.monto
  }
  return quedan
}

// El mínimo por fuerza bruta: personas con saldo menos la mayor cantidad de grupos que suman cero
function minimo(saldos: Record<string, number>): number {
  const valores = Object.values(saldos).filter((v) => v !== 0)
  const mejor = (resto: number[]): number => {
    if (resto.length === 0) return 0
    const [primero, ...otros] = resto
    let maximo = 0
    // El primero va en algún grupo que suma cero: se prueban todas las compañías posibles
    for (let m = 0; m < 1 << otros.length; m++) {
      const dentro = otros.filter((_, i) => m & (1 << i))
      if (primero + dentro.reduce((a, b) => a + b, 0) !== 0) continue
      maximo = Math.max(maximo, 1 + mejor(otros.filter((_, i) => !(m & (1 << i)))))
    }
    return maximo
  }
  return valores.length - mejor(valores)
}

function azar(semilla: number) {
  let s = semilla
  return () => {
    s = (s * 1103515245 + 12345) % 2 ** 31
    return s / 2 ** 31
  }
}

test('sin saldos no hay transferencias', () => {
  assert.deepEqual(transferencias({}), [])
  assert.deepEqual(transferencias({ a: 0, b: 0 }), [])
})

test('una deuda se paga directo', () => {
  assert.deepEqual(transferencias({ ana: -8400, diego: 8400 }), [{ de: 'ana', a: 'diego', monto: 8400 }])
})

test('dos parejas que se saldan solas son dos transferencias, no tres', () => {
  const saldos = { a: -500, b: 500, c: -1234, d: 1234 }
  const lista = transferencias(saldos)
  assert.equal(lista.length, 2)
  assert.ok(Object.values(aplicar(saldos, lista)).every((v) => v === 0))
})

test('los saldos del diseño quedan en cero con lo mínimo', () => {
  const saldos = {
    diego: 17190, martina: 14720, catalina: 1240, benjamin: 0, josefa: 0, vicente: -940, joaquin: -1240, tomas: -1680,
    florencia: -1800, paula: -3390, sofia: -4420, andres: -5230, ignacio: -6050, tu: -8400,
  }
  const lista = transferencias(saldos)
  assert.ok(Object.values(aplicar(saldos, lista)).every((v) => v === 0))
  assert.equal(lista.length, minimo(saldos))
})

test('al azar: siempre salda exacto y con el mínimo (hasta 9 personas, contra fuerza bruta)', () => {
  const r = azar(7)
  for (let caso = 0; caso < 300; caso++) {
    const n = 2 + Math.floor(r() * 8)
    const saldos: Record<string, number> = {}
    let total = 0
    for (let i = 0; i < n - 1; i++) {
      // Montos chicos y repetidos para que aparezcan grupos que suman cero
      const v = Math.round((r() - 0.5) * 8) * 250
      saldos[`p${i}`] = v
      total += v
    }
    saldos[`p${n - 1}`] = -total
    const lista = transferencias(saldos)
    assert.ok(Object.values(aplicar(saldos, lista)).every((v) => v === 0), JSON.stringify(saldos))
    assert.equal(lista.length, minimo(saldos), JSON.stringify(saldos))
  }
})

test('14 personas se resuelven al tiro', () => {
  const r = azar(42)
  const saldos: Record<string, number> = {}
  let total = 0
  for (let i = 0; i < 13; i++) {
    const v = Math.round((r() - 0.5) * 20000)
    saldos[`p${i}`] = v
    total += v
  }
  saldos.p13 = -total
  const antes = performance.now()
  const lista = transferencias(saldos)
  assert.ok(performance.now() - antes < 2000)
  assert.ok(Object.values(aplicar(saldos, lista)).every((v) => v === 0))
  assert.ok(lista.length <= 13)
})

test('si los saldos no suman cero, avisa', () => {
  assert.throws(() => transferencias({ a: -100, b: 50 }))
})
