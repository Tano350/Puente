import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Tables } from './base.ts'
import { aplicarPendientes, conBoleta, conGasto, conNota, conNotaReunion, conPartes, conRendicion, esErrorDeRed, sinNota, type Sobre } from './enEspera.ts'

// node --test src/datos/enEspera.test.ts

type Gasto = Tables<'gastos'>

function gasto(id: string, fecha: string, creado: string, extra: Partial<Gasto> = {}): Gasto {
  return { id, titulo: id, categoria: 'otro', monto: 1000, fecha, pagado_por: 'josefa', division: 'iguales', boleta: null, creado_por: 'josefa', creado_en: creado, cambiado_en: creado, borrado_en: null, ...extra }
}

test('un error de red se reintenta; uno de la base, no', () => {
  assert.equal(esErrorDeRed(new TypeError('Failed to fetch')), true)
  // Así llegan de supabase-js cuando no hay red: sin código y con el mensaje del fetch
  assert.equal(esErrorDeRed({ message: 'TypeError: Failed to fetch', code: '', details: '', hint: '' }), true)
  assert.equal(esErrorDeRed({ name: 'StorageUnknownError', message: 'Load failed' }), true)
  assert.equal(esErrorDeRed(Object.assign(new Error('Todavía sin sesión'), { name: 'SinSesion' })), true)
  assert.equal(esErrorDeRed({ message: 'duplicate key value violates unique constraint', code: '23505' }), false)
  assert.equal(esErrorDeRed({ message: 'Las partes suman 600 centavos y el gasto es de 1000.', code: '22023' }), false)
  assert.equal(esErrorDeRed({ message: 'permission denied', code: '42501' }), false)
  assert.equal(esErrorDeRed(new Error('Otra cosa')), false)
  assert.equal(esErrorDeRed(null), false)
})

test('el gasto anotado sin señal aparece una vez y en su lugar', () => {
  const lista = [gasto('cena', '2027-01-12', '2027-01-12T20:00:00Z'), gasto('uber', '2027-01-10', '2027-01-10T20:00:00Z')]
  const nuevo = gasto('cafe', '2027-01-11', '2027-01-11T15:00:00Z')
  const con = conGasto(lista, nuevo)
  assert.deepEqual(con.map((g) => g.id), ['cena', 'cafe', 'uber'])
  // Si la base ya lo trae, no se repite
  assert.deepEqual(conGasto(con, { ...nuevo, titulo: 'otro título' }).map((g) => g.id), ['cena', 'cafe', 'uber'])
  assert.equal(conGasto(con, nuevo).find((g) => g.id === 'cafe')?.titulo, 'cafe')
})

test('las partes del gasto anotado se agregan una sola vez', () => {
  const lista = [{ gasto: 'cena', persona: 'josefa', monto: 500 }]
  const nuevas = [
    { gasto: 'cafe', persona: 'josefa', monto: 300 },
    { gasto: 'cafe', persona: 'diego', monto: 300 },
  ]
  const con = conPartes(lista, nuevas)
  assert.equal(con.length, 3)
  assert.equal(conPartes(con, nuevas).length, 3)
  assert.equal(conPartes(lista, []), lista)
})

test('la boleta que espera se ve en su gasto', () => {
  const lista = [gasto('cena', '2027-01-12', '2027-01-12T20:00:00Z'), gasto('uber', '2027-01-10', '2027-01-10T20:00:00Z')]
  const con = conBoleta(lista, 'cena', 'cena/foto.jpg')
  assert.equal(con[0]?.boleta, 'cena/foto.jpg')
  assert.equal(con[1], lista[1])
  assert.equal(conBoleta(con, 'cena', null)[0]?.boleta, null)
})

test('marcar y desmarcar lo que rindes, repetido, deja lo último', () => {
  const marcar = { gasto: 'cafe', si: true, persona: 'josefa', marcado_en: '2027-01-12T21:00:00Z' }
  const una = conRendicion([], marcar)
  assert.deepEqual(una, [{ gasto: 'cafe', persona: 'josefa', marcado_en: '2027-01-12T21:00:00Z' }])
  // Marcar de nuevo no duplica ni cambia la fecha
  assert.deepEqual(conRendicion(una, { ...marcar, marcado_en: '2027-01-13T10:00:00Z' }), una)
  assert.deepEqual(conRendicion(una, { ...marcar, si: false }), [])
  assert.deepEqual(conRendicion([], { ...marcar, si: false }), [])
})

test('una nota sin señal aparece una vez, en orden; deshacerla la saca', () => {
  const vieja = { id: 'n1', contacto: 'laura', autor: 'diego', texto: 'Hola', personal: false, creada_en: '2027-01-10T10:00:00Z' }
  const nueva = { id: 'n2', contacto: 'laura', autor: 'josefa', texto: 'Le mando el deck', personal: false, creada_en: '2027-01-12T10:00:00Z' }
  const con = conNota([vieja], nueva)
  assert.deepEqual(con.map((n) => n.id), ['n1', 'n2'])
  assert.equal(conNota(con, nueva).length, 2)
  assert.deepEqual(sinNota(con, 'n2'), [vieja])
})

test('la nota de reunión reemplaza la tuya y deja la de los demás', () => {
  const tuya = { evento: 'cafe-laura', autor: 'josefa', aprendi: 'Algo', sigue: null, escrita_en: '2027-01-12T19:00:00Z' }
  const otra = { evento: 'cafe-laura', autor: 'diego', aprendi: 'Otra cosa', sigue: null, escrita_en: '2027-01-12T19:30:00Z' }
  const cambiada = { ...tuya, sigue: 'Mandar el deck', escrita_en: '2027-01-12T20:00:00Z' }
  const con = conNotaReunion([tuya, otra], cambiada)
  assert.equal(con.length, 2)
  assert.equal(con.find((n) => n.autor === 'josefa')?.sigue, 'Mandar el deck')
  assert.deepEqual(conNotaReunion(con, cambiada), con)
})

test('lo que espera se pone en orden sobre cada consulta, sin tocar las demás', () => {
  const sobre: Record<string, Record<string, Sobre>> = {
    rendir: { rendiciones: conRendicion as Sobre },
    otra: { gastos: (() => []) as Sobre },
  }
  const pendientes = [
    { nombre: 'rendir', variables: { gasto: 'cafe', si: true, persona: 'josefa', marcado_en: '2027-01-12T21:00:00Z' } },
    { nombre: 'rendir', variables: { gasto: 'cafe', si: false, persona: 'josefa', marcado_en: '2027-01-12T21:01:00Z' } },
    { nombre: 'rendir', variables: { gasto: 'uber', si: true, persona: 'josefa', marcado_en: '2027-01-12T21:02:00Z' } },
  ]
  const buscar = (nombre: string, clave: string) => sobre[nombre]?.[clave]
  assert.deepEqual(
    aplicarPendientes('rendiciones', [], pendientes, buscar).map((r: { gasto: string }) => r.gasto),
    ['uber'],
  )
  const notas = [{ id: 'n1' }]
  assert.equal(aplicarPendientes('notas', notas, pendientes, buscar), notas)
  // Sin datos todavía (la consulta no se ha traído) no se inventa nada
  assert.equal(aplicarPendientes('rendiciones', undefined, pendientes, buscar), undefined)
})
