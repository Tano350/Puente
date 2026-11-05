// Pruebas del tope de fotos guardadas: node --test src/datos/boletasEnDispositivo.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { aBorrar } from './boletasEnDispositivo.ts'

const e = (ruta: string, bytes: number, guardada: number) => ({ ruta, bytes, guardada })

test('dentro del tope no se borra nada', () => {
  assert.deepEqual(aBorrar([e('a', 10, 1), e('b', 10, 2)], 5, 100), [])
})

test('pasado el máximo de fotos se borran las más viejas', () => {
  const lista = [e('b', 1, 2), e('a', 1, 1), e('c', 1, 3)]
  assert.deepEqual(aBorrar(lista, 2, 100).sort(), ['a'])
})

test('pasado el máximo de bytes se borran las más viejas', () => {
  const lista = [e('a', 40, 1), e('b', 40, 2), e('c', 40, 3)]
  assert.deepEqual(aBorrar(lista, 10, 100).sort(), ['a'])
})

test('la más nueva se queda aunque sola pase el tope', () => {
  assert.deepEqual(aBorrar([e('a', 500, 1), e('b', 500, 2)], 10, 100), ['a'])
})

test('lista vacía', () => {
  assert.deepEqual(aBorrar([]), [])
})
