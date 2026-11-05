// Pruebas de la ventana del viaje: node --test src/datos/fechas.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { indiceEnElViaje, mesesDe, VIAJE, ventanaDelViaje } from './fechas.ts'
import { cambiarIdioma } from './idioma.ts'

test('si nadie se sale, la ventana es enero y febrero', () => {
  assert.deepEqual(ventanaDelViaje([]), VIAJE)
  assert.deepEqual(ventanaDelViaje([{ llega: '2027-01-05', vuelve: '2027-02-10' }, { llega: null, vuelve: null }]), VIAJE)
})

test('se estira con quien llega antes o se va después', () => {
  const v = ventanaDelViaje([
    { llega: '2026-12-20', vuelve: '2027-01-30' },
    { llega: '2027-02-01', vuelve: '2027-03-15' },
  ])
  assert.deepEqual(v, { desde: '2026-12-20', hasta: '2027-03-15', dias: 86 })
  assert.equal(indiceEnElViaje('2026-12-20', v), 0)
  assert.equal(indiceEnElViaje('2027-01-01', v), 12)
  assert.equal(indiceEnElViaje('2027-01-01'), 0)
})

test('una estadía a medias también estira', () => {
  assert.equal(ventanaDelViaje([{ llega: '2027-04-02', vuelve: null }]).hasta, '2027-04-02')
  assert.equal(ventanaDelViaje([{ llega: null, vuelve: '2026-11-30' }]).desde, '2026-11-30')
})

test('los meses de la ventana, con sus días', () => {
  cambiarIdioma('es')
  assert.deepEqual(mesesDe(VIAJE), [
    { nombre: 'Enero', dias: 31 },
    { nombre: 'Febrero', dias: 28 },
  ])
  assert.deepEqual(mesesDe({ desde: '2026-12-20', hasta: '2027-03-15', dias: 86 }), [
    { nombre: 'Diciembre', dias: 12 },
    { nombre: 'Enero', dias: 31 },
    { nombre: 'Febrero', dias: 28 },
    { nombre: 'Marzo', dias: 15 },
  ])
  cambiarIdioma('en')
  assert.deepEqual(
    mesesDe(VIAJE).map((m) => m.nombre),
    ['January', 'February'],
  )
  cambiarIdioma('es')
})
