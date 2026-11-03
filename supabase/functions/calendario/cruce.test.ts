// Pruebas del cruce entre la Agenda y los calendarios de cada uno. Corren con:
// node --test "supabase/functions/calendario/*.test.ts"
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { aGoogle, cruzar, cruzarCalendarios, ratosOcupados, seEscribe, seLee, type CalendarioDe, type Entrada, type Evento, type Operacion, type Va } from './cruce.ts'
import type { CuerpoGoogle, EventoGoogle } from './google.ts'

const AGENDA = 'https://puente-2027.vercel.app/agenda/'

// Un evento de Puente: martes 12 de enero de 2027, de 10:00 a 11:30 en California
function evento(cambios: Partial<Evento> = {}): Evento {
  return {
    id: 'p1',
    titulo: 'Visita a Google',
    lugar: 'Googleplex',
    direccion: '1600 Amphitheatre Pkwy, Mountain View',
    notas: 'Llevar pasaporte',
    inicio: '2027-01-12T18:00:00.000Z',
    fin: '2027-01-12T19:30:00.000Z',
    ...cambios,
  }
}

const calendarios: CalendarioDe[] = [
  { persona: 'tano', google_id: 'cal-tano', permiso: 'writer' },
  { persona: 'josefa', google_id: 'cal-josefa', permiso: 'writer' },
  { persona: 'diego', google_id: 'cal-diego', permiso: 'writer' },
]
// Los mismos calendarios, con otro permiso para algunos
const conPermisos = (permisos: Record<string, string>) => calendarios.map((c) => ({ ...c, permiso: permisos[c.persona] ?? c.permiso }))
const va = (persona: string, evento = 'p1'): Va => ({ evento, persona })

// Lo leído de cada calendario (los que no se nombran, vacíos)
const leidos = (porCalendario: Record<string, EventoGoogle[]> = {}) => new Map(calendarios.map((c) => [c.google_id, porCalendario[c.google_id] ?? []]))
const entrada = (cambios: Partial<Entrada> = {}): Entrada => ({ eventos: [evento()], van: [], calendarios, ocupados: [], listas: leidos(), ...cambios })

// En enero California está 8 horas atrás, y Google devuelve las horas con ese desfase
const enCalifornia = (iso: string) => new Date(Date.parse(iso) - 8 * 3600_000).toISOString().slice(0, 19) + '-08:00'
function comoGuardado(id: string, c: CuerpoGoogle): EventoGoogle {
  return { ...structuredClone(c), id, start: { ...c.start, dateTime: enCalifornia(c.start.dateTime) }, end: { ...c.end, dateTime: enCalifornia(c.end.dateTime) } }
}
// La copia de un evento de Puente en el calendario de alguien, con algo cambiado en Google si se pide
const copia = (e: Evento, id: string, cambios: Partial<EventoGoogle> = {}): EventoGoogle => ({ ...comoGuardado(id, aGoogle(e)), ...cambios })
// Algo propio en el calendario de alguien: una clase de 9:00 a 10:00 en California
const propio = (id: string, cambios: Partial<EventoGoogle> = {}): EventoGoogle => ({
  id,
  status: 'confirmed',
  summary: 'Clase online',
  start: { dateTime: '2027-01-12T09:00:00-08:00', timeZone: 'America/Los_Angeles' },
  end: { dateTime: '2027-01-12T10:00:00-08:00', timeZone: 'America/Los_Angeles' },
  ...cambios,
})

const CUERPO: CuerpoGoogle = {
  summary: 'Visita a Google',
  location: 'Googleplex, 1600 Amphitheatre Pkwy, Mountain View',
  description: `Llevar pasaporte\n\n${AGENDA}p1`,
  start: { dateTime: '2027-01-12T18:00:00Z', timeZone: 'America/Los_Angeles' },
  end: { dateTime: '2027-01-12T19:30:00Z', timeZone: 'America/Los_Angeles' },
  status: 'confirmed',
  extendedProperties: { private: { puente: 'p1' } },
}

test('Cada uno tiene en su calendario una copia de cada evento al que va (sin invitados y con la marca de Puente)', () => {
  // Diego tiene calendario pero no va; Pedro va pero no tiene calendario asignado
  assert.deepEqual(cruzar(entrada({ van: [va('tano'), va('josefa'), va('pedro')] })), [
    { tipo: 'crear', calendario: 'cal-tano', cuerpo: CUERPO },
    { tipo: 'crear', calendario: 'cal-josefa', cuerpo: CUERPO },
  ])
})

test('Sin notas la descripción es solo el enlace, y el lugar junta lo que haya', () => {
  const soloDireccion = aGoogle(evento({ lugar: null, notas: '  ' }))
  assert.equal(soloDireccion.location, '1600 Amphitheatre Pkwy, Mountain View')
  assert.equal(soloDireccion.description, `${AGENDA}p1`)
  assert.equal(aGoogle(evento({ direccion: '' })).location, 'Googleplex')
  assert.ok(!('location' in aGoogle(evento({ lugar: null, direccion: null }))))
})

test('Si nada cambió no hace nada, aunque Google devuelva las horas con desfase', () => {
  const ocupados = [{ persona: 'tano', inicio: '2027-01-12T17:00:00.000Z', fin: '2027-01-12T18:00:00.000Z' }]
  assert.deepEqual(cruzar(entrada({ van: [va('tano')], ocupados, listas: leidos({ 'cal-tano': [copia(evento(), 'c1'), propio('x1')] }) })), [])
})

test('Lo que se cambie en Google de una copia vuelve a lo que dice Puente', () => {
  const vuelve: Operacion[] = [{ tipo: 'actualizar', calendario: 'cal-tano', googleId: 'c1', cuerpo: CUERPO }]
  const cambios: Partial<EventoGoogle>[] = [
    { summary: 'Otro título' },
    { description: 'Otra cosa' },
    { location: undefined },
    { start: { dateTime: '2027-01-12T11:00:00-08:00', timeZone: 'America/Los_Angeles' } },
    { attendees: [{ email: 'alguien@example.com' }] },
    // La misma hora, pero en la zona de Chile
    { end: { dateTime: '2027-01-12T16:30:00-03:00', timeZone: 'America/Santiago' } },
  ]
  for (const cambio of cambios) {
    assert.deepEqual(cruzar(entrada({ van: [va('tano')], listas: leidos({ 'cal-tano': [copia(evento(), 'c1', cambio)] }) })), vuelve)
  }
})

test('Si alguien borra su copia en Google, se crea de nuevo', () => {
  assert.deepEqual(cruzar(entrada({ van: [va('tano')] })), [{ tipo: 'crear', calendario: 'cal-tano', cuerpo: CUERPO }])
})

test('Si el evento cambia en Puente, se actualizan todas las copias', () => {
  const ahora = evento({ titulo: 'Visita a Google (más tarde)', inicio: '2027-01-12T19:00:00.000Z', fin: '2027-01-12T20:00:00.000Z' })
  const listas = leidos({ 'cal-tano': [copia(evento(), 'c1')], 'cal-josefa': [copia(evento(), 'c2')] })
  assert.deepEqual(cruzar(entrada({ eventos: [ahora], van: [va('tano'), va('josefa')], listas })), [
    { tipo: 'actualizar', calendario: 'cal-tano', googleId: 'c1', cuerpo: aGoogle(ahora) },
    { tipo: 'actualizar', calendario: 'cal-josefa', googleId: 'c2', cuerpo: aGoogle(ahora) },
  ])
})

test('Al soltar el cupo, quedar en espera o salir del evento, se borra su copia', () => {
  const listas = leidos({ 'cal-tano': [copia(evento(), 'c1')], 'cal-josefa': [copia(evento(), 'c2')] })
  assert.deepEqual(cruzar(entrada({ van: [va('tano')], listas })), [{ tipo: 'borrar', calendario: 'cal-josefa', googleId: 'c2' }])
})

test('Si el evento se cancela o se borra en Puente, se borran todas sus copias', () => {
  const listas = leidos({ 'cal-tano': [copia(evento(), 'c1')], 'cal-josefa': [copia(evento(), 'c2')] })
  // Los cancelados no llegan al cruce, igual que los borrados
  assert.deepEqual(cruzar(entrada({ eventos: [], van: [va('tano'), va('josefa')], listas })), [
    { tipo: 'borrar', calendario: 'cal-tano', googleId: 'c1' },
    { tipo: 'borrar', calendario: 'cal-josefa', googleId: 'c2' },
  ])
})

test('Una copia repetida se borra', () => {
  const listas = leidos({ 'cal-tano': [copia(evento(), 'c1'), copia(evento(), 'c1b')] })
  assert.deepEqual(cruzar(entrada({ van: [va('tano')], listas })), [{ tipo: 'borrar', calendario: 'cal-tano', googleId: 'c1b' }])
})

test('Fuera de la ventana no hay copias', () => {
  const enMayo = evento({ inicio: '2027-05-04T18:00:00.000Z', fin: '2027-05-04T19:00:00.000Z' })
  assert.deepEqual(cruzar(entrada({ eventos: [enMayo], van: [va('tano')] })), [])
  // Si en Puente se movió fuera de la ventana, la copia que quedó adentro se borra
  const listas = leidos({ 'cal-tano': [copia(evento(), 'c1')] })
  assert.deepEqual(cruzar(entrada({ eventos: [enMayo], van: [va('tano')], listas })), [{ tipo: 'borrar', calendario: 'cal-tano', googleId: 'c1' }])
})

test('Un calendario que no se pudo leer queda como estaba (ni copias ni ratos ocupados)', () => {
  const listas = leidos()
  listas.delete('cal-josefa')
  const ocupados = [{ persona: 'josefa', inicio: '2027-01-12T17:00:00Z', fin: '2027-01-12T18:00:00Z' }]
  assert.deepEqual(cruzar(entrada({ van: [va('josefa')], ocupados, listas })), [])
})

test('Solo con permiso de dueño o para hacer cambios se escriben copias; "solo libre u ocupado" ni se lee', () => {
  assert.deepEqual(
    ['owner', 'writer', 'reader', 'freeBusyReader'].map((p) => [p, seLee(p), seEscribe(p)]),
    [['owner', true, true], ['writer', true, true], ['reader', true, false], ['freeBusyReader', false, false]],
  )
  assert.deepEqual(cruzar(entrada({ calendarios: conPermisos({ tano: 'owner' }), van: [va('tano')] })), [{ tipo: 'crear', calendario: 'cal-tano', cuerpo: CUERPO }])
})

test('Con permiso solo para ver no se escriben copias (las que ya están se dejan), pero sí se leen los ratos ocupados', () => {
  // Josefa tiene una copia vieja de p1 y otra de un evento borrado: con permiso para cambiar, se actualizaría una y se borraría la otra
  const lista = [copia(evento({ titulo: 'Título viejo' }), 'c2'), copia(evento({ id: 'p9' }), 'c9'), propio('x1')]
  const listas = leidos({ 'cal-josefa': lista })
  assert.deepEqual(cruzar(entrada({ calendarios: conPermisos({ josefa: 'reader' }), van: [va('tano'), va('josefa')], listas })), [
    { tipo: 'crear', calendario: 'cal-tano', cuerpo: CUERPO },
    { tipo: 'ocupados', persona: 'josefa', ratos: [{ inicio: '2027-01-12T17:00:00Z', fin: '2027-01-12T18:00:00Z' }] },
  ])
  // Aunque el evento se cancele, su copia en un calendario solo para ver se queda
  assert.deepEqual(cruzar(entrada({ eventos: [], calendarios: conPermisos({ josefa: 'reader' }), listas: leidos({ 'cal-josefa': [copia(evento(), 'c2')] }) })), [])
})

test('Con permiso solo de libre u ocupado se salta: ni copias ni ratos, y los ratos que tenía se borran', () => {
  const ocupados = [{ persona: 'diego', inicio: '2027-01-12T17:00:00Z', fin: '2027-01-12T18:00:00Z' }]
  // index.ts no lo lee; aunque llegara una lista, no se usa
  const listas = leidos({ 'cal-diego': [propio('x1')] })
  assert.deepEqual(cruzar(entrada({ calendarios: conPermisos({ diego: 'freeBusyReader' }), van: [va('diego')], ocupados, listas })), [
    { tipo: 'ocupados', persona: 'diego', ratos: [] },
  ])
})

test('Ocupado es solo lo que bloquea tiempo: sin copias de Puente, cancelados ni "disponible"; sin títulos', () => {
  const lista: EventoGoogle[] = [
    propio('clase'),
    propio('clase-repetida'),
    propio('libre', { transparency: 'transparent', start: { dateTime: '2027-01-13T09:00:00-08:00' }, end: { dateTime: '2027-01-13T10:00:00-08:00' } }),
    propio('cancelada', { status: 'cancelled', start: { dateTime: '2027-01-14T09:00:00-08:00' }, end: { dateTime: '2027-01-14T10:00:00-08:00' } }),
    propio('sin-duracion', { end: { dateTime: '2027-01-12T09:00:00-08:00' } }),
    copia(evento(), 'copia-de-puente'),
    // Todo el día: cuenta solo si bloquea tiempo, como días enteros de California
    propio('feriado', { start: { date: '2027-01-20' }, end: { date: '2027-01-21' } }),
    propio('cumpleanos', { transparency: 'transparent', start: { date: '2027-01-22' }, end: { date: '2027-01-23' } }),
    // Cruza el cambio de hora del 14 de marzo: empieza a las 00:00 -08:00 y termina a las 00:00 -07:00
    propio('viaje', { transparency: 'opaque', start: { date: '2027-03-13' }, end: { date: '2027-03-15' } }),
  ]
  assert.deepEqual(ratosOcupados(lista), [
    { inicio: '2027-01-12T17:00:00Z', fin: '2027-01-12T18:00:00Z' },
    { inicio: '2027-01-20T08:00:00Z', fin: '2027-01-21T08:00:00Z' },
    { inicio: '2027-03-13T08:00:00Z', fin: '2027-03-15T07:00:00Z' },
  ])
})

test('Los ratos ocupados se reescriben solo si cambiaron; quien no tiene calendario queda sin ratos', () => {
  const listas = leidos({ 'cal-tano': [propio('x1'), propio('x2', { start: { date: '2027-01-20' }, end: { date: '2027-01-21' } })] })
  const tano = [
    { persona: 'tano', inicio: '2027-01-20T08:00:00.000Z', fin: '2027-01-21T08:00:00.000Z' },
    { persona: 'tano', inicio: '2027-01-12T09:00:00-08:00', fin: '2027-01-12T10:00:00-08:00' },
  ]
  assert.deepEqual(cruzar(entrada({ listas, ocupados: tano })), [])
  assert.deepEqual(cruzar(entrada({ listas, ocupados: tano.slice(0, 1) })), [
    { tipo: 'ocupados', persona: 'tano', ratos: ratosOcupados(listas.get('cal-tano') ?? []) },
  ])
  const pedro = [{ persona: 'pedro', inicio: '2027-01-12T17:00:00Z', fin: '2027-01-12T18:00:00Z' }]
  assert.deepEqual(cruzar(entrada({ listas, ocupados: [...tano, ...pedro] })), [{ tipo: 'ocupados', persona: 'pedro', ratos: [] }])
})

test('Los calendarios del viaje se reconocen por "The Bridge" en cualquier parte del nombre, con su permiso', () => {
  const lista = [
    { id: 'cal-tano', summary: 'The Bridge: Tano', accessRole: 'owner' },
    { id: 'cal-x', summary: 'Josefa: The Bridge', accessRole: 'writer' },
    { id: 'cal-z', summary: 'Diego: The bridge ', accessRole: 'reader' },
    { id: 'cal-y', summary: 'Viaje', summaryOverride: 'TheBridge Coti', accessRole: 'freeBusyReader' },
    { id: 'cal-w', summary: 'Mateo: THE BRIDGE' }, // sin permiso conocido: cuenta como el más bajo
    { id: 'personal', summary: 'tano@example.com', accessRole: 'owner' },
    { id: 'puente', summary: 'Puentes de Chile', accessRole: 'reader' },
  ]
  assert.deepEqual(cruzarCalendarios(lista, []).vistos, [
    { google_id: 'cal-tano', nombre: 'The Bridge: Tano', permiso: 'owner' },
    { google_id: 'cal-x', nombre: 'Josefa: The Bridge', permiso: 'writer' },
    { google_id: 'cal-z', nombre: 'Diego: The bridge', permiso: 'reader' },
    { google_id: 'cal-y', nombre: 'TheBridge Coti', permiso: 'freeBusyReader' },
    { google_id: 'cal-w', nombre: 'Mateo: THE BRIDGE', permiso: 'freeBusyReader' },
  ])
})

test('Calendarios: los nuevos entran sin dueño; se anota si cambió el nombre o el permiso; todos los vistos se marcan', () => {
  const guardados = [
    { google_id: 'cal-martina', nombre: 'Martina: The Bridge', permiso: 'reader', persona: 'martina' },
    { google_id: 'cal-ignacio', nombre: 'Ignacio: The bridge', permiso: 'reader', persona: null },
    { google_id: 'cal-coti', nombre: 'Coti: The Bridge', permiso: 'writer', persona: null },
  ]
  const lista = [
    { id: 'cal-martina', summary: 'Martina: The Bridge', accessRole: 'reader' }, // igual
    { id: 'cal-ignacio', summary: 'Ignacio: The bridge', accessRole: 'writer' }, // le dieron permiso para cambiar eventos
    { id: 'cal-coti', summary: 'Coti (viaje): The Bridge', accessRole: 'writer' }, // cambió de nombre
    { id: 'cal-tano', summary: 'Tano: The Bridge', accessRole: 'owner' }, // nuevo
  ]
  assert.deepEqual(cruzarCalendarios(lista, guardados), {
    vistos: [
      { google_id: 'cal-martina', nombre: 'Martina: The Bridge', permiso: 'reader' },
      { google_id: 'cal-ignacio', nombre: 'Ignacio: The bridge', permiso: 'writer' },
      { google_id: 'cal-coti', nombre: 'Coti (viaje): The Bridge', permiso: 'writer' },
      { google_id: 'cal-tano', nombre: 'Tano: The Bridge', permiso: 'owner' },
    ],
    nuevos: [{ google_id: 'cal-tano', nombre: 'Tano: The Bridge', permiso: 'owner' }],
    cambiados: [
      { google_id: 'cal-ignacio', nombre: 'Ignacio: The bridge', permiso: 'writer' },
      { google_id: 'cal-coti', nombre: 'Coti (viaje): The Bridge', permiso: 'writer' },
    ],
    borrados: [],
  })
})

test('Calendarios: uno que ya no aparece se borra si no tiene dueño y se queda si lo tiene', () => {
  const guardados = [
    { google_id: 'cal-martina', nombre: 'Martina: The Bridge', permiso: 'reader', persona: 'martina' },
    { google_id: 'cal-ignacio', nombre: 'Ignacio: The bridge', permiso: 'reader', persona: null },
    { google_id: 'cal-coti', nombre: 'Coti: The Bridge', permiso: 'writer', persona: null },
  ]
  // Solo se ve el de Coti; el de Martina tiene dueño y se queda aunque no aparezca
  const { vistos, nuevos, cambiados, borrados } = cruzarCalendarios([{ id: 'cal-coti', summary: 'Coti: The Bridge', accessRole: 'writer' }], guardados)
  assert.deepEqual({ vistos: vistos.map((c) => c.google_id), nuevos, cambiados, borrados }, { vistos: ['cal-coti'], nuevos: [], cambiados: [], borrados: ['cal-ignacio'] })
  // Si la lista viene sin calendarios del viaje, se borran todos los que no tienen dueño
  assert.deepEqual(cruzarCalendarios([{ id: 'personal', summary: 'tano@example.com' }], guardados).borrados, ['cal-ignacio', 'cal-coti'])
})

// Aplica las operaciones sobre copias de los calendarios y de la base, como lo hacen Google y la función
function aplicar(e: Entrada, ops: Operacion[]): Entrada {
  const listas = new Map([...e.listas].map(([calendario, lista]) => [calendario, lista.map((g) => structuredClone(g))]))
  let ocupados = e.ocupados.map((o) => ({ ...o }))
  let nuevas = 0
  for (const op of ops) {
    if (op.tipo === 'crear') listas.get(op.calendario)?.push(comoGuardado(`nueva${++nuevas}`, op.cuerpo))
    else if (op.tipo === 'actualizar') {
      const lista = listas.get(op.calendario) ?? []
      lista[lista.findIndex((g) => g.id === op.googleId)] = comoGuardado(op.googleId, op.cuerpo)
    } else if (op.tipo === 'borrar') listas.set(op.calendario, (listas.get(op.calendario) ?? []).filter((g) => g.id !== op.googleId))
    else ocupados = [...ocupados.filter((o) => o.persona !== op.persona), ...op.ratos.map((r) => ({ persona: op.persona, ...r }))]
  }
  return { ...e, listas, ocupados }
}

test('Después de una vuelta, la siguiente no escribe nada (ni en Google ni en Puente)', () => {
  const p1 = evento()
  const p2 = evento({ id: 'p2', titulo: 'Almuerzo', lugar: null, direccion: null, notas: null, inicio: '2027-01-13T20:00:00.000Z', fin: '2027-01-13T21:00:00.000Z' })
  const p2Antes = { ...p2, titulo: 'Almuerzo (viejo)' }
  const p3 = evento({ id: 'p3', inicio: '2027-06-01T18:00:00.000Z', fin: '2027-06-01T19:00:00.000Z' })
  const todos = [
    ...calendarios,
    { persona: 'mateo', google_id: 'cal-mateo', permiso: 'writer' }, // no se pudo leer
    { persona: 'coti', google_id: 'cal-coti', permiso: 'reader' }, // solo para ver: su copia vieja se queda
  ]
  const listas = leidos({
    'cal-tano': [copia(p1, 'c1', { summary: 'Editado en Google' }), copia(evento({ id: 'p9' }), 'c9'), propio('x1'), propio('x2', { transparency: 'transparent' })],
    'cal-josefa': [copia(p1, 'c2'), copia(p1, 'c2b'), copia(p2Antes, 'c3'), propio('x3', { start: { date: '2027-01-20' }, end: { date: '2027-01-21' } })],
    'cal-diego': [propio('x4')],
  })
  listas.set('cal-coti', [copia(p2Antes, 'c4'), propio('x5', { start: { dateTime: '2027-01-16T09:00:00-08:00' }, end: { dateTime: '2027-01-16T11:00:00-08:00' } })])
  const inicial: Entrada = {
    eventos: [p1, p2, p3],
    van: [va('tano'), va('josefa'), va('josefa', 'p2'), va('diego', 'p2'), va('pedro'), va('tano', 'p3'), va('mateo'), va('coti')],
    calendarios: todos,
    ocupados: [
      { persona: 'tano', inicio: '2027-01-02T17:00:00Z', fin: '2027-01-02T18:00:00Z' },
      { persona: 'pedro', inicio: '2027-01-02T17:00:00Z', fin: '2027-01-02T18:00:00Z' },
      { persona: 'mateo', inicio: '2027-01-02T17:00:00Z', fin: '2027-01-02T18:00:00Z' },
    ],
    listas,
  }
  const primera = cruzar(inicial)
  const cuantas = Object.fromEntries((['crear', 'actualizar', 'borrar', 'ocupados'] as const).map((t) => [t, primera.filter((op) => op.tipo === t).length]))
  // Crear: la de Diego en p2. Actualizar: la editada de Tano y la vieja de Josefa. Borrar: la de un evento borrado y una repetida.
  // Ocupados: Tano, Josefa, Diego y Coti cambiaron; Pedro ya no tiene calendario. Mateo queda como estaba.
  // Coti: ninguna copia (ni la que le falta de p1 ni arreglar la vieja de p2), porque su calendario es solo para ver.
  assert.deepEqual(cuantas, { crear: 1, actualizar: 2, borrar: 2, ocupados: 5 })

  const despues = aplicar(inicial, primera)
  assert.deepEqual(cruzar(despues), [])
})
