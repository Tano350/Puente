// Pruebas de los textos de los avisos y de cuándo un aviso ya no se manda. Corren con:
// node --test "supabase/functions/avisos/*.test.ts"
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { armar, cuando, diaDeTarea, plata, type Fila } from './mensajes.ts'

// Lunes 11 de enero de 2027, 09:00 en California (17:00 UTC)
const AHORA = new Date('2027-01-11T17:00:00Z')
// Martes 12 de enero, 10:00 a 11:30 en California
const INICIO = new Date('2027-01-12T18:00:00Z')
const FIN = new Date('2027-01-12T19:30:00Z')

function fila(cambios: Partial<Fila> = {}): Fila {
  return {
    id: 'aviso-1',
    tipo: 'eventos',
    persona: 'josefa',
    creado_en: new Date(AHORA.getTime() - 60_000),
    datos: null,
    idioma: 'es',
    sacada: false,
    quiere: true,
    evento_id: 'e1',
    titulo: 'Visita a Google',
    lugar: 'Googleplex',
    direccion: '1600 Amphitheatre Pkwy, Mountain View',
    inicio: INICIO,
    fin: FIN,
    modo: 'para_todos',
    cupos: null,
    cancelado_en: null,
    estado: null,
    van: 1,
    suma: null,
    contacto_id: null,
    contacto_nombre: null,
    organizacion: null,
    responsable: null,
    asigna: null,
    pago_id: null,
    monto: null,
    borrado_en: null,
    paga: null,
    tarea_id: null,
    tarea_titulo: null,
    para: null,
    tarea_borrada: null,
    asignado: false,
    hecha: false,
    encarga: null,
    ...cambios,
  }
}

const filaBase = fila
const mensaje = (f: Fila, ahora = AHORA) => {
  const r = armar(f, ahora)
  assert.ok('mensaje' in r, `se descartó: ${'descartar' in r ? r.descartar : ''}`)
  return r.mensaje
}
const descarta = (f: Fila, ahora = AHORA) => {
  const r = armar(f, ahora)
  assert.ok('descartar' in r, `se mandaría: ${JSON.stringify(r)}`)
  return r.descartar
}

test('Fechas en hora de California: hoy, mañana o el día con su nombre, en los dos idiomas', () => {
  assert.equal(cuando(new Date('2027-01-11T23:30:00Z'), AHORA, 'es'), 'Hoy, 15:30')
  assert.equal(cuando(INICIO, AHORA, 'es'), 'Mañana, 10:00')
  assert.equal(cuando(INICIO, AHORA, 'en'), 'Tomorrow, 10:00')
  // 07:30 UTC del 13 es todavía el 12 en California
  assert.equal(cuando(new Date('2027-01-13T07:30:00Z'), AHORA, 'es'), 'Mañana, 23:30')
  assert.equal(cuando(new Date('2027-01-15T18:00:00Z'), AHORA, 'es'), 'Viernes 15 de enero, 10:00')
  assert.equal(cuando(new Date('2027-01-15T18:00:00Z'), AHORA, 'en'), 'Friday, January 15, 10:00')
  // En marzo California ya está en horario de verano (UTC-7)
  assert.equal(cuando(new Date('2027-03-20T17:00:00Z'), AHORA, 'es'), 'Sábado 20 de marzo, 10:00')
})

test('Montos como en la app', () => {
  assert.equal(plata(123456, 'es'), 'US$ 1.234,56')
  assert.equal(plata(123456, 'en'), 'US$1,234.56')
  assert.equal(plata(2500, 'es'), 'US$ 25,00')
})

test('Evento nuevo: cuándo, dónde y los cupos que quedan; abre el evento', () => {
  assert.deepEqual(mensaje(fila()), {
    titulo: 'Evento nuevo: Visita a Google',
    cuerpo: 'Mañana, 10:00 · Googleplex.',
    url: '/agenda/e1',
    etiqueta: 'evento-e1',
    ttl: 86400,
    urgencia: 'normal',
  })
  assert.equal(mensaje(fila({ modo: 'con_cupo', cupos: 4, van: 1 })).cuerpo, 'Mañana, 10:00 · Googleplex. Quedan 3 cupos.')
  assert.equal(mensaje(fila({ modo: 'con_cupo', cupos: 2, van: 1 })).cuerpo, 'Mañana, 10:00 · Googleplex. Queda 1 cupo.')
  assert.equal(mensaje(fila({ modo: 'con_cupo', cupos: 2, van: 2 })).cuerpo, 'Mañana, 10:00 · Googleplex. Está lleno: anótate en la lista de espera.')
  assert.deepEqual(
    { ...mensaje(fila({ idioma: 'en', modo: 'con_cupo', cupos: 4, van: 1, lugar: null })) },
    { titulo: 'New event: Visita a Google', cuerpo: 'Tomorrow, 10:00. 3 spots left.', url: '/agenda/e1', etiqueta: 'evento-e1', ttl: 86400, urgencia: 'normal' },
  )
})

test('Evento nuevo: no se manda si ya empezó, se canceló, se cerró o ya estás en él', () => {
  descarta(fila({ cancelado_en: AHORA }))
  descarta(fila(), new Date(INICIO.getTime() + 1))
  descarta(fila({ modo: 'cerrado' }))
  descarta(fila({ estado: 'va' }))
  descarta(fila({ estado: 'espera' }))
})

const antes = { titulo: 'Visita a Google', lugar: 'Googleplex', direccion: '1600 Amphitheatre Pkwy, Mountain View', inicio: INICIO.toISOString(), fin: FIN.toISOString() }

test('Cambio: dice qué cambió, con la hora nueva, el lugar nuevo o el nombre de antes', () => {
  const cambio = (c: Partial<Fila>, idioma = 'es') => mensaje(fila({ tipo: 'cambios', estado: 'va', datos: { antes }, idioma, ...c }))
  const nueva = new Date('2027-01-12T19:00:00Z')
  assert.deepEqual(cambio({ inicio: nueva, fin: new Date('2027-01-12T20:30:00Z') }), {
    titulo: 'Cambió: Visita a Google',
    cuerpo: 'Nueva hora: Mañana, 11:00.',
    url: '/agenda/e1',
    etiqueta: 'evento-e1',
    ttl: 86400,
    urgencia: 'normal',
  })
  assert.equal(cambio({ fin: new Date('2027-01-12T20:00:00Z') }).cuerpo, 'Ahora termina a las 12:00.')
  assert.equal(cambio({ lugar: 'Google Visitor Center', direccion: '1911 Landings Dr' }).cuerpo, 'Nuevo lugar: Google Visitor Center · 1911 Landings Dr.')
  assert.equal(cambio({ lugar: null, direccion: null }).cuerpo, 'Ya no tiene lugar.')
  assert.deepEqual(
    [cambio({ titulo: 'Visita a Google X' }).titulo, cambio({ titulo: 'Visita a Google X' }).cuerpo],
    ['Cambió: Visita a Google X', 'Antes se llamaba «Visita a Google».'],
  )
  assert.equal(
    cambio({ titulo: 'Google X', inicio: nueva, lugar: 'Otro' }, 'en').cuerpo,
    'New time: Tomorrow, 11:00. New place: Otro · 1600 Amphitheatre Pkwy, Mountain View. Formerly “Visita a Google”.',
  )
  // Los datos pueden llegar como texto JSON
  assert.equal(cambio({ datos: { antes: JSON.stringify(antes) }, fin: new Date('2027-01-12T20:00:00Z') }).cuerpo, 'Ahora termina a las 12:00.')
})

test('Cambio: la cancelación se avisa aunque haya otros cambios', () => {
  const m = mensaje(fila({ tipo: 'cambios', estado: 'va', datos: { antes }, cancelado_en: AHORA }))
  assert.deepEqual([m.titulo, m.cuerpo], ['Cancelado: Visita a Google', 'Mañana, 10:00. Ya no se hace.'])
  const en = mensaje(fila({ tipo: 'cambios', estado: 'va', datos: { antes }, cancelado_en: AHORA, idioma: 'en' }))
  assert.deepEqual([en.titulo, en.cuerpo], ['Canceled: Visita a Google', "Tomorrow, 10:00. It's no longer happening."])
})

test('Cambio: si se deshizo (quedó igual) o ya no vas, no se manda', () => {
  assert.equal(descarta(fila({ tipo: 'cambios', estado: 'va', datos: { antes } })), 'Quedó como estaba.')
  // Espacios de más no cuentan como cambio
  descarta(fila({ tipo: 'cambios', estado: 'va', datos: { antes }, lugar: ' Googleplex ' }))
  descarta(fila({ tipo: 'cambios', estado: null, datos: { antes }, cancelado_en: AHORA }))
  descarta(fila({ tipo: 'cambios', estado: 'va', datos: { antes }, lugar: 'Otro' }), new Date(FIN.getTime() + 1))
})

test('Saliste de la lista de espera: urgente, solo si todavía tienes el cupo', () => {
  assert.deepEqual(mensaje(fila({ tipo: 'espera', estado: 'va' })), {
    titulo: 'Tienes cupo: Visita a Google',
    cuerpo: 'Saliste de la lista de espera. Mañana, 10:00.',
    url: '/agenda/e1',
    etiqueta: 'evento-e1',
    ttl: 86400,
    urgencia: 'high',
  })
  assert.equal(mensaje(fila({ tipo: 'espera', estado: 'va', idioma: 'en' })).titulo, "You're in: Visita a Google")
  descarta(fila({ tipo: 'espera', estado: 'espera' }))
  descarta(fila({ tipo: 'espera', estado: null }))
  descarta(fila({ tipo: 'espera', estado: 'va', cancelado_en: AHORA }))
})

test('Recordatorio: la hora y la dirección; vence cuando empieza el evento', () => {
  const unaHoraAntes = new Date(INICIO.getTime() - 3600_000)
  // El reloj lo encola justo antes
  const fila = (c: Partial<Fila>) => filaBase({ creado_en: new Date(unaHoraAntes.getTime() - 60_000), ...c })
  assert.deepEqual(mensaje(fila({ tipo: 'recordatorio', estado: 'va' }), unaHoraAntes), {
    titulo: 'A las 10:00: Visita a Google',
    cuerpo: 'Googleplex · 1600 Amphitheatre Pkwy, Mountain View',
    url: '/agenda/e1',
    etiqueta: 'evento-e1',
    ttl: 3600,
    urgencia: 'high',
  })
  const diezAntes = new Date(INICIO.getTime() - 600_000)
  assert.equal(mensaje(fila({ tipo: 'recordatorio', estado: 'va' }), diezAntes).ttl, 600)
  assert.equal(mensaje(fila({ tipo: 'recordatorio', estado: 'va', lugar: null }), diezAntes).cuerpo, '1600 Amphitheatre Pkwy, Mountain View')
  assert.equal(mensaje(fila({ tipo: 'recordatorio', estado: 'va', lugar: null, direccion: null, idioma: 'en' }), diezAntes).cuerpo, 'No address.')
  assert.equal(mensaje(fila({ tipo: 'recordatorio', estado: 'va', idioma: 'en' }), diezAntes).titulo, 'At 10:00: Visita a Google')
  descarta(fila({ tipo: 'recordatorio', estado: 'va' }), INICIO)
  descarta(fila({ tipo: 'recordatorio', estado: 'espera' }), diezAntes)
  descarta(fila({ tipo: 'recordatorio', estado: 'va', cancelado_en: AHORA }), diezAntes)
})

test('Te sumaron: quién te sumó, cuándo y dónde; abre el evento', () => {
  const sumado = (c: Partial<Fila> = {}) => fila({ tipo: 'sumado', estado: 'va', modo: 'cerrado', titulo: 'Visita a Stripe', lugar: 'Stripe', datos: { quien: 'diego' }, suma: 'Diego Soto', ...c })
  assert.deepEqual(mensaje(sumado()), {
    titulo: 'Diego te sumó a Visita a Stripe',
    cuerpo: 'Mañana, 10:00 · Stripe.',
    url: '/agenda/e1',
    etiqueta: 'evento-e1',
    ttl: 86400,
    urgencia: 'normal',
  })
  assert.equal(mensaje(sumado({ suma: null })).titulo, 'Te sumaron a Visita a Stripe')
  assert.deepEqual(
    [mensaje(sumado({ idioma: 'en', lugar: null })).titulo, mensaje(sumado({ idioma: 'en', lugar: null })).cuerpo],
    ['Diego added you to Visita a Stripe', 'Tomorrow, 10:00.'],
  )
  assert.equal(mensaje(sumado({ idioma: 'en', suma: null })).titulo, 'You were added to Visita a Stripe')
  // También en un evento abierto
  assert.equal(mensaje(sumado({ modo: 'para_todos' })).titulo, 'Diego te sumó a Visita a Stripe')
})

test('Te sumaron: no se manda si quien organiza lo deshizo, si se canceló o si ya empezó', () => {
  const sumado = (c: Partial<Fila> = {}) => fila({ tipo: 'sumado', estado: 'va', suma: 'Diego Soto', ...c })
  assert.equal(descarta(sumado({ estado: null })), 'Ya no está en el evento.')
  descarta(sumado({ estado: 'espera' }))
  assert.equal(descarta(sumado({ cancelado_en: AHORA })), 'Se canceló el evento.')
  assert.equal(descarta(sumado({ creado_en: new Date(INICIO.getTime() - 60_000) }), INICIO), 'El evento ya empezó.')
  // Se apaga con el interruptor de cambios: la consulta lo entrega como "quiere"
  descarta(sumado({ quiere: false }))
  descarta(sumado({ evento_id: null, inicio: null, fin: null }))
})

test('Contacto asignado: quién te lo asignó y a quién contactar; abre el contacto', () => {
  const contacto = { tipo: 'contacto' as const, evento_id: null, inicio: null, fin: null, contacto_id: 'c1', contacto_nombre: 'Laura Pérez', organizacion: 'Stripe', responsable: 'josefa' }
  assert.deepEqual(mensaje(fila({ ...contacto, asigna: 'Diego Soto' })), {
    titulo: 'Diego te asignó un contacto',
    cuerpo: 'Laura Pérez · Stripe',
    url: '/contactos/c1',
    etiqueta: 'contacto-c1',
    ttl: 86400,
    urgencia: 'normal',
  })
  assert.equal(mensaje(fila({ ...contacto, asigna: null, organizacion: null, idioma: 'en' })).titulo, 'You have a new contact')
  assert.equal(mensaje(fila({ ...contacto, asigna: 'Diego', organizacion: null, idioma: 'en' })).cuerpo, 'Laura Pérez')
  descarta(fila({ ...contacto, responsable: 'martina' }))
  descarta(fila({ ...contacto, contacto_id: null }))
})

test('Pago: quién te pagó y cuánto; abre Gastos; no se manda si lo deshizo', () => {
  const pago = { tipo: 'pago' as const, evento_id: null, inicio: null, fin: null, pago_id: 'p1', monto: 2550, paga: 'Diego Soto' }
  assert.deepEqual(mensaje(fila(pago)), {
    titulo: 'Diego te pagó US$ 25,50',
    cuerpo: 'Tus saldos ya están al día.',
    url: '/gastos',
    etiqueta: 'pago-p1',
    ttl: 86400,
    urgencia: 'normal',
  })
  assert.equal(mensaje(fila({ ...pago, paga: null, idioma: 'en' })).titulo, 'Someone paid you US$25.50')
  assert.equal(descarta(fila({ ...pago, borrado_en: AHORA })), 'Se deshizo el pago.')
})

// Una tarea: sin evento, con la tarea y quien recibe asignado
const deTarea = (c: Partial<Fila> = {}) =>
  fila({ tipo: 'tarea', evento_id: null, titulo: null, inicio: null, fin: null, tarea_id: 't1', tarea_titulo: 'Reservar el auto', asignado: true, encarga: 'Diego Soto', datos: { quien: 'diego' }, ...c })

test('Día de una tarea como en la app: cerca, el día de la semana; más lejos, con el mes', () => {
  // Hoy es el lunes 11 de enero
  assert.equal(diaDeTarea('2027-01-16', AHORA, 'es'), 'sábado 16')
  assert.equal(diaDeTarea('2027-01-16', AHORA, 'en'), 'Saturday the 16th')
  assert.equal(diaDeTarea('2027-01-12', AHORA, 'es'), 'martes 12')
  assert.equal(diaDeTarea('2027-01-17', AHORA, 'es'), 'domingo 17')
  assert.equal(diaDeTarea('2027-01-18', AHORA, 'es'), 'lunes 18 de enero')
  assert.equal(diaDeTarea('2027-01-05', AHORA, 'es'), 'martes 5')
  assert.equal(diaDeTarea('2027-02-02', AHORA, 'es'), 'martes 2 de febrero')
  assert.equal(diaDeTarea('2027-02-02', AHORA, 'en'), 'Tuesday, February 2')
  assert.deepEqual(['2027-01-11', '2027-01-12', '2027-01-13', '2027-01-21'].map((d) => diaDeTarea(d, new Date('2027-01-08T18:00:00Z'), 'en')), [
    'Monday the 11th',
    'Tuesday the 12th',
    'Wednesday the 13th',
    'Thursday, January 21',
  ])
  // A las 23:30 del lunes en California (ya martes en UTC), el domingo 17 sigue cerca
  assert.equal(diaDeTarea('2027-01-17', new Date('2027-01-12T07:30:00Z'), 'es'), 'domingo 17')
})

test('Te asignaron una tarea: quién, el título y para cuándo; abre la tarea', () => {
  assert.deepEqual(mensaje(deTarea({ para: '2027-01-16' })), {
    titulo: 'Diego te asignó una tarea',
    cuerpo: 'Reservar el auto · para el sábado 16',
    url: '/tareas/t1',
    etiqueta: 'tarea-t1',
    ttl: 86400,
    urgencia: 'normal',
  })
  assert.equal(mensaje(deTarea()).cuerpo, 'Reservar el auto')
  assert.equal(mensaje(deTarea({ para: '2027-12-01' })).cuerpo, 'Reservar el auto · para el miércoles 1 de diciembre')
  assert.equal(mensaje(deTarea({ encarga: null })).titulo, 'Te asignaron una tarea')
  const en = mensaje(deTarea({ idioma: 'en', para: '2027-01-16' }))
  assert.deepEqual([en.titulo, en.cuerpo], ['Diego assigned you a task', 'Reservar el auto · due Saturday the 16th'])
  assert.equal(mensaje(deTarea({ idioma: 'en', encarga: null, para: '2027-12-01' })).titulo, 'You were assigned a task')
  assert.equal(mensaje(deTarea({ idioma: 'en', para: '2027-12-01' })).cuerpo, 'Reservar el auto · due Wednesday, December 1')
  // Aunque ya esté hecha, la asignación se avisa
  assert.equal(mensaje(deTarea({ hecha: true })).titulo, 'Diego te asignó una tarea')
})

test('Te asignaron una tarea: no se manda si la borraron, si te sacaron o si apagaste los de tareas', () => {
  assert.equal(descarta(deTarea({ tarea_borrada: AHORA })), 'Se borró la tarea.')
  assert.equal(descarta(deTarea({ asignado: false })), 'Ya no está en la tarea.')
  assert.equal(descarta(deTarea({ tarea_id: null, tarea_titulo: null })), 'La tarea ya no está.')
  assert.equal(descarta(deTarea({ quiere: false })), 'Apagó este tipo de aviso.')
  assert.equal(descarta(deTarea({ sacada: true })), 'Ya no está en Puente.')
})

test('Vence mañana: el título de la tarea; abre la tarea', () => {
  const vence = (c: Partial<Fila> = {}) => deTarea({ tipo: 'vence', para: '2027-01-12', encarga: null, datos: { para: '2027-01-12' }, ...c })
  assert.deepEqual(mensaje(vence()), {
    titulo: 'Mañana vence una tarea tuya',
    cuerpo: 'Reservar el auto',
    url: '/tareas/t1',
    etiqueta: 'tarea-t1',
    ttl: 86400,
    urgencia: 'normal',
  })
  assert.equal(mensaje(vence({ idioma: 'en' })).titulo, 'One of your tasks is due tomorrow')
  // Hasta las 23:59 de California del día antes
  assert.equal(mensaje(vence(), new Date('2027-01-12T07:30:00Z')).titulo, 'Mañana vence una tarea tuya')
})

test('Vence mañana: no se manda si ya no vence mañana, si está hecha, borrada o ya no es tuya', () => {
  const vence = (c: Partial<Fila> = {}) => deTarea({ tipo: 'vence', para: '2027-01-12', encarga: null, datos: { para: '2027-01-12' }, ...c })
  // Le cambiaron la fecha
  assert.equal(descarta(vence({ para: '2027-01-13' })), 'La tarea ya no vence mañana.')
  assert.equal(descarta(vence({ para: null })), 'La tarea ya no vence mañana.')
  // Ya es el día (00:30 en California)
  assert.equal(descarta(vence(), new Date('2027-01-12T08:30:00Z')), 'La tarea ya no vence mañana.')
  assert.equal(descarta(vence({ hecha: true })), 'La tarea ya está hecha.')
  assert.equal(descarta(vence({ tarea_borrada: AHORA })), 'Se borró la tarea.')
  assert.equal(descarta(vence({ asignado: false })), 'Ya no está en la tarea.')
  assert.equal(descarta(vence({ quiere: false })), 'Apagó este tipo de aviso.')
})

test('Nunca a quien sacaron, a quien apagó ese tipo, ni avisos de hace más de un día', () => {
  descarta(fila({ sacada: true }))
  descarta(fila({ quiere: false }))
  descarta(fila({ creado_en: new Date(AHORA.getTime() - 25 * 3600_000) }))
  descarta(fila({ evento_id: null, inicio: null, fin: null }))
})

test('Títulos y cuerpos largos se cortan para que quepan en el aviso', () => {
  const m = mensaje(fila({ titulo: 'x'.repeat(300), lugar: 'y'.repeat(500) }))
  assert.equal(m.titulo.length, 90)
  assert.ok(m.titulo.endsWith('…'))
  assert.equal(m.cuerpo.length, 240)
})
