// Pruebas de los montos: node --test src/datos/plata.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cambiarIdioma } from './idioma.ts'
import { aCentavos, plata } from './plata.ts'

test('plata en español y en inglés', () => {
  cambiarIdioma('es')
  assert.equal(plata(8400), 'US$ 84,00')
  assert.equal(plata(123456), 'US$ 1.234,56')
  assert.equal(plata(-5), '-US$ 0,05')
  cambiarIdioma('en')
  assert.equal(plata(8400), 'US$84.00')
  assert.equal(plata(123456789), 'US$1,234,567.89')
  assert.equal(plata(-5), '-US$0.05')
  cambiarIdioma('es')
})

test('montos escritos de distintas formas', () => {
  const casos: [string, number | null][] = [
    ['84', 8400],
    ['84,5', 8450],
    ['84,50', 8450],
    ['84.50', 8450],
    ['84.5', 8450],
    ['1.234', 123400],
    ['1,234', 123400],
    ['1.234.567', 123456700],
    ['1.234,56', 123456],
    ['1,234.56', 123456],
    ['US$ 12,30', 1230],
    [' 7 ', 700],
    ['', null],
    ['abc', null],
    ['1,2345', null],
    ['1.23.45', null],
    ['1.234,56,7', null],
    ['-5', null],
  ]
  for (const [texto, esperado] of casos) assert.equal(aCentavos(texto), esperado, `"${texto}"`)
})

test('se lee igual en los dos idiomas', () => {
  for (const idioma of ['es', 'en'] as const) {
    cambiarIdioma(idioma)
    assert.equal(aCentavos('84,50'), 8450)
    assert.equal(aCentavos('84.50'), 8450)
  }
  cambiarIdioma('es')
})
