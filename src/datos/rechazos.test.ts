import assert from 'node:assert/strict'
import { test } from 'node:test'
import { conRechazo, describirRechazo, rechazosAAvisar, rechazosValidos, textoRechazos, type Nombres, type Rechazo } from './rechazos.ts'
import { es } from '../textos.ts'
import { en } from '../textos.en.ts'

// node --test src/datos/rechazos.test.ts

const nombres: Nombres = {
  gasto: (id) => ({ cena: 'Cena en Palo Alto' })[id] ?? null,
  contacto: (id) => ({ ana: 'Ana Rojas' })[id] ?? null,
  evento: (id) => ({ cafe: 'Café con Laura' })[id] ?? null,
  tarea: (id) => ({ carta: 'Mandar la carta a la Escuela' })[id] ?? null,
}

test('cada escritura dice qué era, con su nombre', () => {
  assert.deepEqual(describirRechazo('anotarGasto', { gasto: { id: 'g1', titulo: 'Taxi al aeropuerto' }, partes: [] }, 'g1', nombres), { clave: 'g1', tipo: 'gasto', nombre: 'Taxi al aeropuerto' })
  assert.deepEqual(describirRechazo('subirBoleta', { gasto: 'cena', ruta: 'cena/f.jpg', anterior: null }, 'boleta:cena', nombres), { clave: 'boleta:cena', tipo: 'boleta', nombre: 'Cena en Palo Alto' })
  assert.deepEqual(describirRechazo('rendir', { gasto: 'otro', si: true }, 'rendicion:otro', nombres), { clave: 'rendicion:otro', tipo: 'rendicion', nombre: null })
  assert.deepEqual(describirRechazo('agregarNota', { nota: { id: 'n1', contacto: 'ana' } }, 'n1', nombres), { clave: 'n1', tipo: 'nota', nombre: 'Ana Rojas' })
  assert.deepEqual(describirRechazo('notaReunion', { evento: 'cafe', autor: 'josefa' }, 'reunion:cafe', nombres), { clave: 'reunion:cafe', tipo: 'reunion', nombre: 'Café con Laura' })
  assert.deepEqual(describirRechazo('otraCosa', null, 'x', nombres), { clave: 'x', tipo: 'otro', nombre: null })
})

test('la misma escritura rechazada dos veces se avisa una vez', () => {
  const uno: Rechazo = { clave: 'n1', tipo: 'nota', nombre: 'Ana Rojas' }
  assert.deepEqual(conRechazo(conRechazo([], uno), uno), [uno])
})

test('lo guardado con otra forma se descarta', () => {
  assert.deepEqual(rechazosValidos(null), [])
  assert.deepEqual(rechazosValidos([{ clave: 'n1', tipo: 'nota', nombre: null }, { clave: 1 }, { clave: 'x', tipo: 'raro', nombre: null }]), [{ clave: 'n1', tipo: 'nota', nombre: null }])
})

test('la foto y la rendición de un gasto que tampoco subió van con el gasto', () => {
  const lista: Rechazo[] = [
    { clave: 'g1', tipo: 'gasto', nombre: 'Taxi' },
    { clave: 'boleta:g1', tipo: 'boleta', nombre: 'Taxi' },
    { clave: 'rendicion:g1', tipo: 'rendicion', nombre: 'Taxi' },
    { clave: 'boleta:cena', tipo: 'boleta', nombre: 'Cena' },
  ]
  assert.deepEqual(rechazosAAvisar(lista).map((r) => r.clave), ['g1', 'boleta:cena'])
})

test('el aviso dice qué no subió y qué hacer, en los dos idiomas', () => {
  const gasto: Rechazo = { clave: 'g1', tipo: 'gasto', nombre: 'Taxi al aeropuerto' }
  const nota: Rechazo = { clave: 'n1', tipo: 'nota', nombre: 'Ana Rojas' }
  assert.equal(textoRechazos([], es.rechazos, es.y), null)
  assert.equal(textoRechazos([gasto], es.rechazos, es.y), 'No se pudo subir el gasto «Taxi al aeropuerto». Vuelve a anotarlo.')
  assert.equal(textoRechazos([nota], es.rechazos, es.y), 'No se pudo subir tu nota sobre Ana Rojas. Vuelve a escribirla.')
  assert.equal(textoRechazos([gasto, { clave: 'boleta:g1', tipo: 'boleta', nombre: 'Taxi al aeropuerto' }], es.rechazos, es.y), 'No se pudo subir el gasto «Taxi al aeropuerto». Vuelve a anotarlo.')
  assert.equal(textoRechazos([gasto, nota], es.rechazos, es.y), 'No se pudieron subir 2 cosas: el gasto «Taxi al aeropuerto» y tu nota sobre Ana Rojas. Vuelve a anotarlas.')
  assert.equal(textoRechazos([gasto, nota], en.rechazos, en.y), 'Couldn’t upload 2 things: the expense “Taxi al aeropuerto” and your note about Ana Rojas. Add them again.')
  // Más de tres: se nombran dos y el resto se cuenta
  const muchos: Rechazo[] = [gasto, nota, { clave: 'reunion:cafe', tipo: 'reunion', nombre: 'Café con Laura' }, { clave: 'n2', tipo: 'nota', nombre: null }]
  assert.equal(textoRechazos(muchos, es.rechazos, es.y), 'No se pudieron subir 4 cosas: el gasto «Taxi al aeropuerto», tu nota sobre Ana Rojas y 2 más. Vuelve a anotarlas.')
  assert.equal(textoRechazos([{ clave: 'n2', tipo: 'nota', nombre: null }], en.rechazos, en.y), 'Couldn’t upload a note you wrote offline. Write it again.')
})

test('una marca de tarea rechazada dice por qué: ya no está, ya no te toca u otra cosa', () => {
  const marca = { tarea: 'carta', hecha: true, persona: 'josefa', cadaUno: false, en: '2026-11-10T15:00:00Z' }
  // El motivo llega en "motivo" (ErrorDeTarea) o en "hint" (el error de la base)
  assert.deepEqual(describirRechazo('marcarTarea', marca, 'tarea:carta', nombres, { motivo: 'no_esta' }), { clave: 'tarea:carta', tipo: 'tareaNoEsta', nombre: 'Mandar la carta a la Escuela' })
  assert.deepEqual(describirRechazo('marcarTarea', marca, 'tarea:carta', nombres, { hint: 'no_asignado', code: '42501' }), { clave: 'tarea:carta', tipo: 'tareaNoAsignada', nombre: 'Mandar la carta a la Escuela' })
  assert.deepEqual(describirRechazo('marcarTarea', { ...marca, tarea: 'otra' }, 'tarea:otra', nombres, { code: 'P0001' }), { clave: 'tarea:otra', tipo: 'tarea', nombre: null })
  // Antes de subir todavía no hay error
  assert.equal(describirRechazo('marcarTarea', marca, 'tarea:carta', nombres).tipo, 'tarea')
  assert.deepEqual(rechazosValidos([{ clave: 'tarea:carta', tipo: 'tareaNoEsta', nombre: 'X' }]), [{ clave: 'tarea:carta', tipo: 'tareaNoEsta', nombre: 'X' }])
})

test('el aviso de una tarea dice qué pasó, en los dos idiomas', () => {
  const noEsta: Rechazo = { clave: 'tarea:carta', tipo: 'tareaNoEsta', nombre: 'Mandar la carta' }
  const noTeToca: Rechazo = { clave: 'tarea:seguro', tipo: 'tareaNoAsignada', nombre: 'Pagar el seguro' }
  assert.equal(textoRechazos([noEsta], es.rechazos, es.y), 'No se pudo marcar «Mandar la carta»: esa tarea ya no está.')
  assert.equal(textoRechazos([noTeToca], es.rechazos, es.y), 'No se pudo marcar «Pagar el seguro»: esa tarea ya no te toca.')
  assert.equal(textoRechazos([{ clave: 'tarea:x', tipo: 'tarea', nombre: null }], es.rechazos, es.y), 'No se pudo guardar una tarea que marcaste sin señal. Vuelve a marcarla.')
  assert.equal(textoRechazos([noEsta], en.rechazos, en.y), 'Couldn’t check off “Mandar la carta”: that task no longer exists.')
  assert.equal(textoRechazos([noEsta, noTeToca], es.rechazos, es.y), 'No se pudieron subir 2 cosas: tu marca en «Mandar la carta» (ya no está) y tu marca en «Pagar el seguro» (ya no te toca). Vuelve a anotarlas.')
})
