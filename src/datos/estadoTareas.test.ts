import assert from 'node:assert/strict'
import { test } from 'node:test'
import { atrasada, estadoDe, finDeSemana, grupoDe, misPorHacer, porFecha, vaEnHechas, type Asignado, type Tarea } from './estadoTareas.ts'

const YO = 'yo'
const activos = new Set([YO, 'diego', 'cata', 'tomas'])

function tarea(id: string, extra: Partial<Tarea> = {}): Tarea {
  return { id, titulo: id, notas: null, para: null, cada_uno: false, personal: false, creada_por: 'diego', creada_en: '2026-11-01T12:00:00Z', borrada_en: null, ...extra }
}
function fila(t: string, persona: string, extra: Partial<Asignado> = {}): Asignado {
  return { tarea: t, persona, tomada: false, hecha_en: null, asignado_en: '2026-11-01T12:00:00Z', ...extra }
}

test('sin filas es sin asignar y no es de nadie', () => {
  const e = estadoDe(tarea('a'), [], YO, activos)
  assert.equal(e.modo, 'sin')
  assert.equal(e.mia, false)
  assert.equal(e.completa, false)
})

test('basta con uno: la marca de otro la completa y es mi parte también', () => {
  const t = tarea('auto')
  const filas = [fila('auto', YO), fila('auto', 'diego', { hecha_en: '2026-11-09T15:00:00Z' })]
  const e = estadoDe(t, filas, YO, activos)
  assert.equal(e.modo, 'uno')
  assert.deepEqual(e.hechaPor, { persona: 'diego', en: '2026-11-09T15:00:00Z' })
  assert.equal(e.miParteHecha, true)
  assert.equal(e.completa, true)
  assert.deepEqual(e.personas, [YO, 'diego'])
})

test('cada uno: cuenta solo a quienes siguen en Puente', () => {
  const t = tarea('seguro', { cada_uno: true })
  const filas = [fila('seguro', YO), fila('seguro', 'diego', { hecha_en: '2026-11-05T10:00:00Z' }), fila('seguro', 'cata', { hecha_en: '2026-11-06T10:00:00Z' }), fila('seguro', 'sacado')]
  const e = estadoDe(t, filas, YO, activos)
  assert.equal(e.modo, 'cada')
  assert.equal(e.hechas, 2)
  assert.equal(e.total, 3)
  assert.deepEqual(e.faltan, [YO])
  assert.equal(e.miParteHecha, false)
  assert.equal(e.completa, false)
})

test('cada uno queda completa cuando todos la marcan', () => {
  const t = tarea('foto', { cada_uno: true })
  const filas = [fila('foto', YO, { hecha_en: '2026-11-07T10:00:00Z' }), fila('foto', 'diego', { hecha_en: '2026-11-07T11:00:00Z' })]
  assert.equal(estadoDe(t, filas, YO, activos).completa, true)
})

test('tomada por mí y personal', () => {
  const tomada = estadoDe(tarea('regalos'), [fila('regalos', YO, { tomada: true })], YO, activos)
  assert.equal(tomada.modo, 'uno')
  assert.equal(tomada.tomadaPorMi, true)
  const personal = estadoDe(tarea('enchufes', { personal: true, creada_por: YO }), [fila('enchufes', YO)], YO, activos)
  assert.equal(personal.modo, 'personal')
  assert.equal(personal.mia, true)
})

test('grupos por fecha, con semanas de lunes a domingo', () => {
  // Martes 10 de noviembre de 2026
  const hoy = '2026-11-10'
  assert.equal(finDeSemana(hoy), '2026-11-15')
  assert.equal(finDeSemana('2026-11-15'), '2026-11-15')
  assert.equal(finDeSemana('2026-11-16'), '2026-11-22')
  assert.equal(grupoDe('2026-11-08', hoy), 'atrasadas')
  assert.equal(grupoDe('2026-11-10', hoy), 'semana')
  assert.equal(grupoDe('2026-11-15', hoy), 'semana')
  assert.equal(grupoDe('2026-11-16', hoy), 'adelante')
  assert.equal(grupoDe(null, hoy), 'sinFecha')
})

test('atrasada solo si no está completa', () => {
  assert.equal(atrasada({ para: '2026-11-08' }, { completa: false }, '2026-11-10'), true)
  assert.equal(atrasada({ para: '2026-11-08' }, { completa: true }, '2026-11-10'), false)
  assert.equal(atrasada({ para: null }, { completa: false }, '2026-11-10'), false)
})

test('orden: por fecha, sin fecha al final', () => {
  const lista = [tarea('c'), tarea('b', { para: '2026-11-13' }), tarea('a', { para: '2026-11-08' })].sort(porFecha)
  assert.deepEqual(lista.map((t) => t.id), ['a', 'b', 'c'])
})

test('Hechas depende de si miras todas o las tuyas', () => {
  assert.equal(vaEnHechas({ completa: false, miParteHecha: true }, true), true)
  assert.equal(vaEnHechas({ completa: false, miParteHecha: true }, false), false)
})

test('mis tareas por hacer: sin las hechas, las borradas ni las sin asignar', () => {
  const tareas = [
    tarea('carta', { para: '2026-11-08' }),
    tarea('seguro', { para: '2026-11-13', cada_uno: true }),
    tarea('auto', { para: '2026-11-16' }),
    tarea('lista'),
    tarea('borrada', { borrada_en: '2026-11-09T10:00:00Z' }),
    tarea('regalos'),
  ]
  const filas = [
    fila('carta', YO),
    fila('seguro', YO),
    fila('seguro', 'diego', { hecha_en: '2026-11-05T10:00:00Z' }),
    fila('auto', YO),
    fila('auto', 'diego', { hecha_en: '2026-11-09T10:00:00Z' }),
    fila('lista', YO),
    fila('borrada', YO),
  ]
  assert.deepEqual(misPorHacer(tareas, filas, YO, activos).map((t) => t.id), ['carta', 'seguro', 'lista'])
})
