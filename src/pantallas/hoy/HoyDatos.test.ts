import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { test } from 'node:test'
import type { Persona } from '../../datos/consultas.ts'
import type { Evento } from '../../datos/eventos.ts'
import type { Interesado } from '../../datos/intereses.ts'

// node --test src/pantallas/hoy/HoyDatos.test.ts

// Los datos importan módulos que leen import.meta.env y window (solo existen en Vite y el navegador): en node, valores fijos
registerHooks({
  load(url, contexto, siguiente) {
    const resultado = siguiente(url, contexto)
    if (url.includes('/src/') && resultado.source) resultado.source = String(resultado.source).replaceAll('import.meta.env', '({ DEV: false, VITE_SUPABASE_URL: "http://localhost", VITE_SUPABASE_PUBLISHABLE_KEY: "x" })')
    return resultado
  },
})
Object.assign(globalThis, { window: globalThis, addEventListener() {}, removeEventListener() {} })
const { porConfirmar, tambienHoy } = await import('./HoyDatos.ts')

const HOY = '2027-01-12'
const AHORA = Date.parse('2027-01-12T17:00:00Z')
const josefa = { id: 'josefa', llega: '2027-01-10', vuelve: '2027-01-20' } as Persona

function evento(id: string, extra: Partial<Evento> = {}): Evento {
  return {
    id,
    titulo: id,
    tipo: 'otro',
    lugar: null,
    direccion: null,
    // 18:00 y 19:00 del 12 de enero en California
    inicio: '2027-01-13T02:00:00Z',
    fin: '2027-01-13T03:00:00Z',
    modo: 'para_todos',
    cupos: null,
    notas: null,
    contacto: null,
    organizador: 'diego',
    google_id: null,
    desde_google: false,
    cancelado_en: null,
    tema: null,
    abierto_en: null,
    creado_por: 'diego',
    creado_en: '2027-01-01T00:00:00Z',
    cambiado_en: '2027-01-01T00:00:00Z',
    ...extra,
  }
}

const interesados: Interesado[] = [{ tema: 'ia', persona: 'josefa', desde: '2027-01-02T00:00:00Z' }]

const normal = evento('normal')
const deIA = evento('ia', { tema: 'ia' })
const deFintech = evento('fintech', { tema: 'fintech' })
const abierto = evento('abierto', { tema: 'fintech', abierto_en: '2027-01-05T00:00:00Z' })
const lasMias = evento('mio', { tema: 'fintech', organizador: 'josefa' })
const todos = [normal, deIA, deFintech, abierto, lasMias]

test('También hoy deja fuera lo que todavía es solo para un tema que no es tuyo', () => {
  const ids = tambienHoy(todos, [], 'josefa', HOY, AHORA, interesados).map((e) => e.id)
  assert.deepEqual(ids.sort(), ['abierto', 'ia', 'mio', 'normal'])
})

test('También hoy: con otro tema, o sin intereses, cambia lo que ves', () => {
  assert.deepEqual(tambienHoy([deIA, deFintech], [], 'josefa', HOY, AHORA, []).map((e) => e.id), [])
  const deFintechTambien: Interesado[] = [...interesados, { tema: 'fintech', persona: 'josefa', desde: '2027-01-03T00:00:00Z' }]
  assert.deepEqual(tambienHoy([deIA, deFintech], [], 'josefa', HOY, AHORA, deFintechTambien).map((e) => e.id).sort(), ['fintech', 'ia'])
})

test('Por confirmar deja fuera lo que todavía es solo para un tema que no es tuyo', () => {
  const ids = porConfirmar(todos, [], josefa, AHORA, null, interesados).map((e) => e.id)
  assert.deepEqual(ids.sort(), ['abierto', 'ia', 'mio', 'normal'])
})

test('Por confirmar sigue sin traer lo cerrado ni lo que ya confirmaste', () => {
  const cerrado = evento('cerrado', { modo: 'cerrado' })
  const voy = [{ evento: 'normal', persona: 'josefa', estado: 'va', desde: '2027-01-02T00:00:00Z' }] as Parameters<typeof porConfirmar>[1]
  const ids = porConfirmar([normal, cerrado, deIA], voy, josefa, AHORA, null, interesados).map((e) => e.id)
  assert.deepEqual(ids, ['ia'])
})
