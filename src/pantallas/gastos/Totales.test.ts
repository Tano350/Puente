// node --test src/pantallas/gastos/Totales.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { totales } from './TotalesDatos.ts'

const gastos = [
  { id: 'a', monto: 10000, pagado_por: 'yo', division: 'iguales' },
  { id: 'b', monto: 6000, pagado_por: 'otro', division: 'exactos' },
  { id: 'c', monto: 1450, pagado_por: 'yo', division: 'solo' },
  { id: 'd', monto: 900, pagado_por: 'otro', division: 'solo' },
]
const partes = [
  { gasto: 'a', persona: 'yo', monto: 5000 },
  { gasto: 'a', persona: 'otro', monto: 5000 },
  { gasto: 'b', persona: 'otro', monto: 6000 },
  { gasto: 'c', persona: 'yo', monto: 1450 },
  { gasto: 'd', persona: 'otro', monto: 900 },
]

test('mis gastos: mis partes de lo compartido más mis "Solo mío" enteros', () => {
  assert.equal(totales(gastos, partes, 'yo').mios, 5000 + 1450)
})

test('gastos totales: solo los compartidos; los "Solo mío" no entran', () => {
  assert.equal(totales(gastos, partes, 'yo').grupo, 16000)
  assert.equal(totales(gastos, partes, 'otro').grupo, 16000)
})

test('la parte de un "Solo mío" no se cuenta dos veces', () => {
  assert.equal(totales([gastos[2]], [partes[3]], 'yo').mios, 1450)
})

test('sin gastos, todo en cero', () => {
  assert.deepEqual(totales([], [], 'yo'), { mios: 0, grupo: 0 })
})

test('un gasto en que no participo no suma a los míos pero sí al grupo', () => {
  assert.deepEqual(totales([gastos[1]], [partes[2]], 'yo'), { mios: 0, grupo: 6000 })
})
