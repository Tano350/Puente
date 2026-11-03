// Pruebas del cruce entre la Agenda y Google. Corren con: node --test supabase/functions/calendario/
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { aGoogle, cruzar, type FilaEvento, type Operacion } from './cruce.ts'
import type { CuerpoGoogle, EventoGoogle } from './google.ts'

const AGENDA = 'https://puente-2027.vercel.app/agenda/'

// Un evento de Puente: martes 12 de enero de 2027, de 10:00 a 11:30 en California
function fila(cambios: Partial<FilaEvento> = {}): FilaEvento {
  return {
    id: 'p1',
    titulo: 'Visita a Google',
    lugar: 'Googleplex',
    direccion: '1600 Amphitheatre Pkwy, Mountain View',
    notas: 'Llevar pasaporte',
    inicio: '2027-01-12T18:00:00.000Z',
    fin: '2027-01-12T19:30:00.000Z',
    google_id: null,
    desde_google: false,
    cancelado_en: null,
    ...cambios,
  }
}

// En enero California está 8 horas atrás, y Google devuelve las horas con ese desfase
const enCalifornia = (iso: string) => new Date(Date.parse(iso) - 8 * 3600_000).toISOString().slice(0, 19) + '-08:00'

// Lo que devuelve Google después de guardar lo que mandó Puente
function comoGuardado(id: string, c: CuerpoGoogle): EventoGoogle {
  return { ...structuredClone(c), id, start: { ...c.start, dateTime: enCalifornia(c.start.dateTime) }, end: { ...c.end, dateTime: enCalifornia(c.end.dateTime) } }
}

// La copia al día de un evento de Puente, con algo cambiado en Google si se pide
const copia = (f: FilaEvento, id = 'g1', cambios: Partial<EventoGoogle> = {}): EventoGoogle => ({ ...comoGuardado(id, aGoogle(f)), ...cambios })

// Un evento creado directo en Google (sin la marca de Puente): miércoles 13 de enero, de 19:00 a 21:00 en California
function deGoogle(cambios: Partial<EventoGoogle> = {}): EventoGoogle {
  return {
    id: 'x1',
    status: 'confirmed',
    summary: 'Cena con exalumnos',
    location: 'Tamarine, Palo Alto',
    description: 'Paga cada uno',
    start: { dateTime: '2027-01-13T19:00:00-08:00', timeZone: 'America/Los_Angeles' },
    end: { dateTime: '2027-01-13T21:00:00-08:00', timeZone: 'America/Los_Angeles' },
    ...cambios,
  }
}

// Ese mismo evento, ya traído a Puente
function traida(cambios: Partial<FilaEvento> = {}): FilaEvento {
  return {
    id: 'f1',
    titulo: 'Cena con exalumnos',
    lugar: 'Tamarine, Palo Alto',
    direccion: null,
    notas: 'Paga cada uno',
    inicio: '2027-01-14T03:00:00.000Z',
    fin: '2027-01-14T05:00:00.000Z',
    google_id: 'x1',
    desde_google: true,
    cancelado_en: null,
    ...cambios,
  }
}

test('Un evento nuevo de Puente se crea en Google, sin invitados y con su marca', () => {
  assert.deepEqual(cruzar([fila()], []), [
    {
      tipo: 'crear',
      evento: 'p1',
      cuerpo: {
        summary: 'Visita a Google',
        location: 'Googleplex, 1600 Amphitheatre Pkwy, Mountain View',
        description: `Llevar pasaporte\n\n${AGENDA}p1`,
        start: { dateTime: '2027-01-12T18:00:00Z', timeZone: 'America/Los_Angeles' },
        end: { dateTime: '2027-01-12T19:30:00Z', timeZone: 'America/Los_Angeles' },
        status: 'confirmed',
        extendedProperties: { private: { puente: 'p1' } },
      },
    },
  ])
})

test('Sin notas la descripción es solo el enlace, y el lugar junta lo que haya', () => {
  const soloDireccion = aGoogle(fila({ lugar: null, notas: '  ' }))
  assert.equal(soloDireccion.location, '1600 Amphitheatre Pkwy, Mountain View')
  assert.equal(soloDireccion.description, `${AGENDA}p1`)
  assert.equal(aGoogle(fila({ direccion: '' })).location, 'Googleplex')
  assert.ok(!('location' in aGoogle(fila({ lugar: null, direccion: null }))))
})

test('Si nada cambió no hace nada, aunque Google devuelva la hora con desfase', () => {
  const f = fila({ google_id: 'g1' })
  assert.deepEqual(cruzar([f], [copia(f)]), [])
  assert.deepEqual(cruzar([traida()], [deGoogle()]), [])
})

test('Lo que se cambie en Google de un evento de Puente vuelve a lo que dice Puente', () => {
  const f = fila({ google_id: 'g1' })
  const vuelve: Operacion[] = [{ tipo: 'actualizar', evento: 'p1', googleId: 'g1', cuerpo: aGoogle(f) }]
  assert.deepEqual(cruzar([f], [copia(f, 'g1', { summary: 'Otro título' })]), vuelve)
  assert.deepEqual(cruzar([f], [copia(f, 'g1', { description: 'Otra cosa' })]), vuelve)
  assert.deepEqual(cruzar([f], [copia(f, 'g1', { start: { dateTime: '2027-01-12T11:00:00-08:00', timeZone: 'America/Los_Angeles' } })]), vuelve)
  assert.deepEqual(cruzar([f], [copia(f, 'g1', { attendees: [{ email: 'alguien@example.com' }] })]), vuelve)
  // Misma hora, pero en la zona de Chile
  assert.deepEqual(cruzar([f], [copia(f, 'g1', { end: { dateTime: '2027-01-12T16:30:00-03:00', timeZone: 'America/Santiago' } })]), vuelve)
  // Borrado en Google (los borrados a veces traen solo el id) o perdido del todo: la función lo revive o lo crea de nuevo
  assert.deepEqual(cruzar([f], [{ id: 'g1', status: 'cancelled' }]), vuelve)
  assert.deepEqual(cruzar([f], []), vuelve)
})

test('Cancelado en Puente: se borra de Google; si ya estaba borrado, nada', () => {
  const f = fila({ google_id: 'g1', cancelado_en: '2027-01-02T00:00:00.000Z' })
  assert.deepEqual(cruzar([f], [copia(f)]), [{ tipo: 'borrar', googleId: 'g1' }])
  assert.deepEqual(cruzar([f], [{ id: 'g1', status: 'cancelled' }]), [])
})

test('Borrado en Puente: lo que siga en Google con su marca se borra', () => {
  assert.deepEqual(cruzar([], [copia(fila())]), [{ tipo: 'borrar', googleId: 'g1' }])
})

test('Si una vuelta creó el evento pero no alcanzó a guardar el id, se enlaza en vez de crear otro', () => {
  assert.deepEqual(cruzar([fila()], [copia(fila(), 'g9')]), [{ tipo: 'enlazar', evento: 'p1', googleId: 'g9' }])
  const cambiada = fila({ titulo: 'Visita a Google (cambiada)' })
  assert.deepEqual(cruzar([cambiada], [copia(fila(), 'g9')]), [
    { tipo: 'enlazar', evento: 'p1', googleId: 'g9' },
    { tipo: 'actualizar', evento: 'p1', googleId: 'g9', cuerpo: aGoogle(cambiada) },
  ])
})

test('Una copia repetida en Google se borra', () => {
  const f = fila({ google_id: 'g1' })
  assert.deepEqual(cruzar([f], [copia(f), copia(f, 'g2')]), [{ tipo: 'borrar', googleId: 'g2' }])
})

test('Fuera de la ventana no se cruza nada', () => {
  const enMayo = { inicio: '2027-05-01T18:00:00.000Z', fin: '2027-05-01T19:00:00.000Z' }
  assert.deepEqual(cruzar([fila(enMayo)], []), [])
  assert.deepEqual(cruzar([traida({ inicio: '2026-11-20T18:00:00.000Z', fin: '2026-11-20T19:00:00.000Z' })], []), [])
  // Si en Puente se movió fuera de la ventana, la copia que quedó adentro se borra
  assert.deepEqual(cruzar([fila({ ...enMayo, google_id: 'g1' })], [copia(fila())]), [{ tipo: 'borrar', googleId: 'g1' }])
})

test('Lo creado directo en Google entra a Puente como evento para todos, sin cupos ni organizador', () => {
  assert.deepEqual(cruzar([], [deGoogle()]), [
    {
      tipo: 'traer',
      fila: {
        titulo: 'Cena con exalumnos',
        lugar: 'Tamarine, Palo Alto',
        notas: 'Paga cada uno',
        inicio: '2027-01-14T03:00:00Z',
        fin: '2027-01-14T05:00:00Z',
        google_id: 'x1',
        desde_google: true,
        tipo: 'otro',
        modo: 'para_todos',
        cupos: null,
        organizador: null,
        creado_por: null,
      },
    },
  ])
})

test('Sin título queda "Sin título", y la descripción en HTML pasa a texto', () => {
  const [op] = cruzar([], [deGoogle({ summary: '  ', location: undefined, description: '<b>Ojo</b>: llegar 10&nbsp;min antes<br>Q&amp;A al final' })])
  assert.ok(op?.tipo === 'traer')
  assert.equal(op.fila.titulo, 'Sin título')
  assert.equal(op.fila.lugar, null)
  assert.equal(op.fila.notas, 'Ojo: llegar 10 min antes\nQ&A al final')
})

test('Lo que cambia en Google cambia en Puente, solo en lo que cambió', () => {
  assert.deepEqual(cruzar([traida()], [deGoogle({ summary: 'Cena con exalumnos UC' })]), [
    { tipo: 'cambiar', evento: 'f1', cambios: { titulo: 'Cena con exalumnos UC' } },
  ])
  const masTarde = deGoogle({ location: '', start: { dateTime: '2027-01-13T20:00:00-08:00' }, end: { dateTime: '2027-01-14T06:00:00Z' } })
  assert.deepEqual(cruzar([traida()], [masTarde]), [
    { tipo: 'cambiar', evento: 'f1', cambios: { lugar: null, inicio: '2027-01-14T04:00:00Z', fin: '2027-01-14T06:00:00Z' } },
  ])
})

test('Lo cancelado, borrado o pasado a todo el día en Google se cancela en Puente (la fila queda)', () => {
  const cancelar: Operacion[] = [{ tipo: 'cancelar', evento: 'f1' }]
  assert.deepEqual(cruzar([traida()], [deGoogle({ status: 'cancelled' })]), cancelar)
  assert.deepEqual(cruzar([traida()], [{ id: 'x1', status: 'cancelled' }]), cancelar)
  assert.deepEqual(cruzar([traida()], []), cancelar)
  assert.deepEqual(cruzar([traida()], [deGoogle({ start: { date: '2027-01-13' }, end: { date: '2027-01-14' } })]), cancelar)
  assert.deepEqual(cruzar([traida({ cancelado_en: '2027-01-05T00:00:00.000Z' })], [{ id: 'x1', status: 'cancelled' }]), [])
})

test('Si vuelve a estar en Google, se descancela', () => {
  assert.deepEqual(cruzar([traida({ cancelado_en: '2027-01-05T00:00:00.000Z' })], [deGoogle()]), [
    { tipo: 'cambiar', evento: 'f1', cambios: { cancelado_en: null } },
  ])
})

test('Los de todo el día o sin duración no entran; cada repetición entra por separado', () => {
  assert.deepEqual(cruzar([], [deGoogle({ start: { date: '2027-01-13' }, end: { date: '2027-01-14' } })]), [])
  assert.deepEqual(cruzar([], [deGoogle({ end: { dateTime: '2027-01-13T19:00:00-08:00' } })]), [])
  const repeticiones = [13, 20].map((dia) =>
    deGoogle({ id: `x1_202701${dia}T030000Z`, start: { dateTime: `2027-01-${dia}T19:00:00-08:00` }, end: { dateTime: `2027-01-${dia}T21:00:00-08:00` } }),
  )
  assert.deepEqual(
    cruzar([], repeticiones).map((op) => op.tipo === 'traer' && op.fila.google_id),
    ['x1_20270113T030000Z', 'x1_20270120T030000Z'],
  )
})

// Aplica las operaciones sobre copias de Puente y de Google, como lo hace la función
function aplicar(filas: FilaEvento[], google: EventoGoogle[], ops: Operacion[]) {
  const puente = new Map(filas.map((f) => [f.id, { ...f }]))
  const calendario = new Map(google.map((e) => [e.id, structuredClone(e)]))
  const deEvento = (id: string) => puente.get(id) ?? assert.fail(`No existe la fila ${id}`)
  let nuevos = 0
  for (const op of ops) {
    if (op.tipo === 'crear' || op.tipo === 'actualizar') {
      const id = op.tipo === 'actualizar' && calendario.has(op.googleId) ? op.googleId : `nuevo${++nuevos}`
      calendario.set(id, comoGuardado(id, op.cuerpo))
      deEvento(op.evento).google_id = id
    } else if (op.tipo === 'borrar') calendario.set(op.googleId, { id: op.googleId, status: 'cancelled' })
    else if (op.tipo === 'enlazar') deEvento(op.evento).google_id = op.googleId
    else if (op.tipo === 'traer') {
      const { google_id, titulo, lugar, notas, inicio, fin } = op.fila
      const id = `traida${++nuevos}`
      puente.set(id, { id, titulo, lugar, direccion: null, notas, inicio, fin, google_id, desde_google: true, cancelado_en: null })
    } else if (op.tipo === 'cambiar') Object.assign(deEvento(op.evento), op.cambios)
    else deEvento(op.evento).cancelado_en = '2027-01-10T00:00:00.000Z'
  }
  return { filas: [...puente.values()], google: [...calendario.values()] }
}

test('Después de una vuelta, la siguiente no escribe nada (ni en Google ni en Puente)', () => {
  const f = (id: string, cambios: Partial<FilaEvento> = {}) => fila({ id, titulo: `Evento ${id}`, ...cambios })
  const filas = [
    f('p1'), // nuevo
    f('p2', { google_id: 'g2' }), // cambiado en Google
    f('p3', { google_id: 'g3' }), // borrado en Google
    f('p4', { google_id: 'g4' }), // perdido en Google
    f('p5', { google_id: 'g5', cancelado_en: '2027-01-02T00:00:00.000Z' }), // cancelado en Puente
    f('p7'), // creado en una vuelta que no alcanzó a guardar el id
    f('p8', { google_id: 'g8' }), // con una copia repetida
    f('p9', { google_id: 'g9' }), // al día
    f('p10', { inicio: '2027-06-01T18:00:00.000Z', fin: '2027-06-01T19:00:00.000Z' }), // fuera de la ventana
    traida({ id: 'f2', google_id: 'x2' }), // cambiado en Google
    traida({ id: 'f3', google_id: 'x3' }), // cancelado en Google
    traida({ id: 'f4', google_id: 'x4', cancelado_en: '2027-01-03T00:00:00.000Z' }), // vuelve a estar en Google
    traida({ id: 'f8', google_id: 'x8' }), // desapareció de Google
  ]
  const google = [
    copia(f('p2', { google_id: 'g2' }), 'g2', { summary: 'Cambiado en Google', attendees: [{ email: 'alguien@example.com' }] }),
    { id: 'g3', status: 'cancelled' },
    copia(f('p5'), 'g5'),
    copia(f('p6'), 'g6'), // su evento se borró en Puente
    copia(f('p7', { titulo: 'Título viejo' }), 'g7'),
    copia(f('p8'), 'g8'),
    copia(f('p8'), 'g8b'),
    copia(f('p9'), 'g9'),
    deGoogle({ id: 'x1' }), // nuevo en Google
    deGoogle({ id: 'x2', summary: 'Cena movida', start: { dateTime: '2027-01-15T19:00:00-08:00' }, end: { dateTime: '2027-01-15T20:00:00-08:00' } }),
    { id: 'x3', status: 'cancelled' },
    deGoogle({ id: 'x4' }),
    deGoogle({ id: 'x5', start: { date: '2027-01-16' }, end: { date: '2027-01-17' } }), // todo el día
    deGoogle({ id: 'x6', summary: undefined, description: '<p>Traer <i>regalo</i></p><p>Q&amp;A</p>' }),
    deGoogle({ id: 'x7_20270113T030000Z' }), // repeticiones
    deGoogle({ id: 'x7_20270120T030000Z', start: { dateTime: '2027-01-20T19:00:00-08:00' }, end: { dateTime: '2027-01-20T21:00:00-08:00' } }),
  ]

  const primera = cruzar(filas, google)
  const cuantas = (tipo: Operacion['tipo']) => primera.filter((op) => op.tipo === tipo).length
  assert.deepEqual(
    { crear: cuantas('crear'), actualizar: cuantas('actualizar'), borrar: cuantas('borrar'), enlazar: cuantas('enlazar') },
    { crear: 1, actualizar: 4, borrar: 3, enlazar: 1 },
  )
  assert.deepEqual({ traer: cuantas('traer'), cambiar: cuantas('cambiar'), cancelar: cuantas('cancelar') }, { traer: 4, cambiar: 2, cancelar: 2 })

  const despues = aplicar(filas, google, primera)
  assert.deepEqual(cruzar(despues.filas, despues.google), [])
})
