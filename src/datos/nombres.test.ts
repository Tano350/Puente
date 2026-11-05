// node --test src/datos/nombres.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { nombreCompleto, nombreDelCorreo, primerNombre } from './nombres.ts'

test('el nombre sale de lo que va antes de la @', () => {
  assert.equal(nombreDelCorreo('martin.ossa@example.com'), 'Martin Ossa')
  assert.equal(nombreDelCorreo('tomas_fuenzalida@example.com'), 'Tomas Fuenzalida')
  assert.equal(nombreDelCorreo('PAULA-TORRES@example.com'), 'Paula Torres')
  assert.equal(nombreDelCorreo('josefa.contreras92@example.com'), 'Josefa Contreras')
  assert.equal(nombreDelCorreo('diego@example.com'), 'Diego')
  assert.equal(nombreDelCorreo('1234@example.com'), '1234')
})

test('si hay nombre se usa; si no, el del correo', () => {
  assert.equal(nombreCompleto({ nombre: ' Martín ', correo: 'martin.ossa@example.com' }), 'Martín')
  assert.equal(nombreCompleto({ nombre: null, correo: 'martin.ossa@example.com' }), 'Martin Ossa')
  assert.equal(nombreCompleto({ nombre: '  ', correo: 'martin.ossa@example.com' }), 'Martin Ossa')
  assert.equal(primerNombre({ nombre: null, correo: 'martin.ossa@example.com' }), 'Martin')
  assert.equal(primerNombre({ nombre: 'Andrés Cifuentes', correo: 'andres.cifuentes@example.com' }), 'Andrés')
})
