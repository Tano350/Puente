import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { test } from 'node:test'
import type { Evento } from '../../datos/eventos.ts'

// node --test src/pantallas/agenda/CrearBorrador.test.ts

registerHooks({
  load(url, contexto, siguiente) {
    const resultado = siguiente(url, contexto)
    if (url.includes('/src/') && resultado.source) resultado.source = String(resultado.source).replaceAll('import.meta.env', '({ DEV: false, VITE_SUPABASE_URL: "http://localhost", VITE_SUPABASE_PUBLISHABLE_KEY: "x" })')
    return resultado
  },
})
Object.assign(globalThis, { window: globalThis, addEventListener() {}, removeEventListener() {} })
const { cambiosDeTema } = await import('./CrearBorrador.ts')

const AHORA = '2027-01-12T10:00:00Z'
const solo = { modo: 'con_cupo', tema: 'fintech', abierto_en: null } as Evento
const abierto = { ...solo, abierto_en: '2027-01-11T00:00:00Z' } as Evento
const sinTema = { modo: 'para_todos', tema: null, abierto_en: null } as Evento

test('al editar, «Todos» abre el evento a todos', () => {
  assert.deepEqual(cambiosDeTema(solo, { modo: 'con_cupo', tema: null }, AHORA), { cambio: { abierto_en: AHORA }, antes: { abierto_en: null } })
})

test('al editar, otro tema lo cambia y el mismo no hace nada', () => {
  assert.deepEqual(cambiosDeTema(solo, { modo: 'con_cupo', tema: 'ia' }, AHORA), { cambio: { tema: 'ia' }, antes: { tema: 'fintech' } })
  assert.equal(cambiosDeTema(solo, { modo: 'con_cupo', tema: 'fintech' }, AHORA), null)
})

test('pasar a cerrado quita el tema en la misma actualización', () => {
  assert.deepEqual(cambiosDeTema(solo, { modo: 'cerrado', tema: null }, AHORA), { cambio: { tema: null }, antes: { tema: 'fintech' } })
  assert.deepEqual(cambiosDeTema(abierto, { modo: 'cerrado', tema: null }, AHORA), { cambio: { tema: null }, antes: { tema: 'fintech' } })
  assert.equal(cambiosDeTema(sinTema, { modo: 'cerrado', tema: null }, AHORA), null)
})

test('un evento ya abierto o sin tema no cambia de tema', () => {
  assert.equal(cambiosDeTema(abierto, { modo: 'con_cupo', tema: null }, AHORA), null)
  assert.equal(cambiosDeTema(sinTema, { modo: 'para_todos', tema: 'ia' }, AHORA), null)
})
