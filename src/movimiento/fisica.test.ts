// Pruebas de las cuentas del movimiento: node --test src/movimiento/fisica.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  asentarGiro,
  cierraLaHoja,
  deslizoLoSuficiente,
  diaBajo,
  escalaSegunAncho,
  giroAlRodar,
  ladeo,
  llego,
  masCercana,
  NIVEL,
  PASO,
  pasoResorte,
  rodado,
  seVaElAviso,
  zonaBajo,
} from './fisica.ts'

// Simula un resorte que parte en 0 y va a 100; devuelve cuánto se pasó como máximo y cuánto tardó en llegar
function simular(k: number, c: number) {
  let x = 0
  let v = 0
  let maximo = 0
  for (let i = 1; i <= 600; i++) {
    ;[x, v] = pasoResorte(x, v, 100, k, c, PASO)
    maximo = Math.max(maximo, x)
    if (llego(x, v, 100, 0.03)) return { pasado: maximo - 100, segundos: i * PASO }
  }
  return { pasado: maximo - 100, segundos: Infinity }
}

test('el resorte de B llega en menos de un segundo y rebota un poco', () => {
  const { pasado, segundos } = simular(NIVEL.rigidez, NIVEL.amortiguacion)
  assert.ok(segundos < 1, `tardó ${segundos} s`)
  assert.ok(pasado > 2 && pasado < 20, `se pasó ${pasado}`)
})

test('con amortiguación crítica el resorte no se pasa', () => {
  const { pasado, segundos } = simular(NIVEL.rigidez, 2 * Math.sqrt(NIVEL.rigidez))
  assert.ok(pasado <= 0.01, `se pasó ${pasado}`)
  assert.ok(segundos < 1.2)
})

test('lo ancho se agranda menos que un botón', () => {
  assert.equal(escalaSegunAncho(1.05, 100), 1.05)
  assert.ok(Math.abs(escalaSegunAncho(1.05, 350) - 1.02) < 1e-9)
  assert.ok(Math.abs(escalaSegunAncho(0.95, 280) - 0.975) < 1e-9)
})

test('la tuerca se asienta cada 60 grados, en el sentido en que giraba', () => {
  assert.equal(asentarGiro(125, 300), 180)
  assert.equal(asentarGiro(125, -300), 120)
  assert.equal(asentarGiro(120, 50), 120)
  assert.equal(asentarGiro(-10, -50), -60)
  assert.equal(asentarGiro(-10, 50), -0)
})

test('el día bajo el dedo', () => {
  assert.equal(diaBajo(0, 0, 590, 59), 0)
  assert.equal(diaBajo(115, 0, 590, 59), 11)
  assert.equal(diaBajo(-40, 0, 590, 59), 0)
  assert.equal(diaBajo(9999, 0, 590, 59), 58)
  assert.equal(diaBajo(50, 0, 0, 59), 0)
})

test('dónde cae lo que se suelta', () => {
  const zonas = [
    { arriba: 0, abajo: 100 },
    { arriba: 101, abajo: 250 },
  ]
  assert.equal(zonaBajo(50, zonas), 0)
  assert.equal(zonaBajo(180, zonas), 1)
  assert.equal(zonaBajo(300, zonas), -1)
})

test('la parada más cercana y el giro al rodar', () => {
  assert.equal(masCercana(10, [0, 80, 160]), 0)
  assert.equal(masCercana(130, [0, 80, 160]), 2)
  assert.ok(Math.abs(giroAlRodar(Math.PI * 30, 30) - 360) < 1e-9)
})

test('deslizar, bajar la hoja y tirar el aviso', () => {
  assert.equal(deslizoLoSuficiente(130, 350, 0), true)
  assert.equal(deslizoLoSuficiente(100, 350, 0), false)
  assert.equal(deslizoLoSuficiente(40, 350, 1200), true)
  assert.equal(cierraLaHoja(150, 500, 0), true)
  assert.equal(cierraLaHoja(80, 500, 0), false)
  assert.equal(cierraLaHoja(30, 500, 900), true)
  assert.equal(seVaElAviso(-140, 360, 0), true)
  assert.equal(seVaElAviso(60, 360, 0), false)
  assert.equal(seVaElAviso(-30, 360, -900), true)
})

test('el ladeo tiene tope', () => {
  assert.equal(ladeo(0, 13), 0)
  assert.equal(ladeo(500, 13), 6.5)
  assert.equal(ladeo(-5000, 13), -13)
})

test('los números corren y llegan exactos', () => {
  assert.equal(rodado(84, 0, 0), 84)
  assert.equal(rodado(84, 0, 1), 0)
  assert.equal(rodado(84, 0, 2), 0)
  let antes = 84
  for (let t = 0.1; t <= 1; t += 0.1) {
    const ahora = rodado(84, 0, t)
    assert.ok(ahora <= antes)
    antes = ahora
  }
})
