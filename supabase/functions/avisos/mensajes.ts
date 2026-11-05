// Qué dice cada aviso, en español o en inglés, con las horas de California. También decide, justo antes de
// mandarlo, si un aviso ya no tiene sentido (se deshizo lo que lo causó, el evento ya empezó, apagaste ese tipo…).
// Es puro: no lee la base ni la hora del sistema, así se prueba solo.

export type Tipo = 'eventos' | 'cambios' | 'espera' | 'recordatorio' | 'contacto' | 'pago'
export type Idioma = 'es' | 'en'
export type Urgencia = 'normal' | 'high'

// Cómo era el evento antes del primer cambio que todavía no se avisaba
export type Antes = { titulo: string; lugar: string | null; direccion: string | null; inicio: string; fin: string }

// Un aviso por mandar y lo que hace falta para escribirlo, como lo entrega la consulta de index.ts
export type Fila = {
  id: string
  tipo: Tipo
  persona: string
  creado_en: Date
  datos: { antes?: Antes | string | null } | null
  idioma: string
  sacada: boolean
  quiere: boolean
  // El evento (eventos, cambios, espera y recordatorio)
  evento_id: string | null
  titulo: string | null
  lugar: string | null
  direccion: string | null
  inicio: Date | null
  fin: Date | null
  modo: 'para_todos' | 'con_cupo' | 'cerrado' | null
  cupos: number | null
  cancelado_en: Date | null
  // Si quien recibe va o espera en ese evento
  estado: 'va' | 'espera' | null
  // Cuántos van
  van: number | null
  // El contacto
  contacto_id: string | null
  contacto_nombre: string | null
  organizacion: string | null
  responsable: string | null
  asigna: string | null
  // El pago
  pago_id: string | null
  monto: number | null
  borrado_en: Date | null
  paga: string | null
}

// Lo que recibe el service worker, más cómo lo trata el servicio de push
export type Mensaje = { titulo: string; cuerpo: string; url: string; etiqueta: string; ttl: number; urgencia: Urgencia }
export type Resultado = { mensaje: Mensaje } | { descartar: string }

const CALIFORNIA = 'America/Los_Angeles'
const HORA_S = 3600
const DIA_S = 24 * HORA_S

const NOMBRES = {
  es: {
    meses: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
    dias: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'],
  },
  en: {
    meses: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    dias: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  },
}

const formato = new Intl.DateTimeFormat('en-US', {
  timeZone: CALIFORNIA,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

// El día y la hora de un momento en California
function enCalifornia(momento: Date) {
  const p = Object.fromEntries(formato.formatToParts(momento).map((x) => [x.type, x.value]))
  const anio = Number(p.year)
  const mes = Number(p.month) - 1
  const dia = Number(p.day)
  return { anio, mes, dia, semana: new Date(Date.UTC(anio, mes, dia)).getUTCDay(), hora: `${p.hour}:${p.minute}`, clave: Date.UTC(anio, mes, dia) }
}

// "10:00", en 24 horas en los dos idiomas, como la app
export function hora(momento: Date): string {
  return enCalifornia(momento).hora
}

// "Hoy, 10:00", "Mañana, 10:00" o "Martes 12 de enero, 10:00" ("Today, 10:00", "Tuesday, January 12, 10:00")
export function cuando(momento: Date, ahora: Date, idioma: Idioma): string {
  const m = enCalifornia(momento)
  const dias = Math.round((m.clave - enCalifornia(ahora).clave) / (DIA_S * 1000))
  const n = NOMBRES[idioma]
  let dia: string
  if (dias === 0) dia = idioma === 'en' ? 'Today' : 'Hoy'
  else if (dias === 1) dia = idioma === 'en' ? 'Tomorrow' : 'Mañana'
  else if (idioma === 'en') dia = `${n.dias[m.semana]}, ${n.meses[m.mes]} ${m.dia}`
  else dia = `${mayuscula(n.dias[m.semana])} ${m.dia} de ${n.meses[m.mes]}`
  return `${dia}, ${m.hora}`
}

// "US$ 1.234,56" o "US$1,234.56", como la app (los montos están en centavos)
export function plata(centavos: number, idioma: Idioma): string {
  const enteros = Math.floor(centavos / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, idioma === 'en' ? ',' : '.')
  const resto = String(centavos % 100).padStart(2, '0')
  return idioma === 'en' ? `US$${enteros}.${resto}` : `US$ ${enteros},${resto}`
}

const mayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)
const limpio = (t: string | null | undefined) => (t ?? '').replace(/\s+/g, ' ').trim()
const corto = (t: string, maximo: number) => (t.length > maximo ? `${t.slice(0, maximo - 1).trimEnd()}…` : t)
// El nombre de pila: así se nombran en la app
const pila = (nombre: string | null) => limpio(nombre).split(' ')[0] || null

// "Googleplex · 1600 Amphitheatre Pkwy", sin repetir si el lugar ya es la dirección
function dondeEs(lugar: string | null, direccion: string | null): string {
  const l = limpio(lugar)
  const d = limpio(direccion)
  if (l && d && l.toLowerCase() !== d.toLowerCase()) return `${l} · ${d}`
  return l || d
}

// La forma en que se arma cada texto, por idioma
const TEXTOS = {
  es: {
    nuevo: (t: string) => `Evento nuevo: ${t}`,
    quedan: (n: number) => (n === 1 ? 'Queda 1 cupo.' : `Quedan ${n} cupos.`),
    lleno: 'Está lleno: anótate en la lista de espera.',
    cancelado: (t: string) => `Cancelado: ${t}`,
    yaNoVa: 'Ya no se hace.',
    cambio: (t: string) => `Cambió: ${t}`,
    nuevaHora: (c: string) => `Nueva hora: ${c}.`,
    terminaA: (h: string) => `Ahora termina a las ${h}.`,
    nuevoLugar: (l: string) => `Nuevo lugar: ${l}.`,
    sinLugar: 'Ya no tiene lugar.',
    antesSeLlamaba: (t: string) => `Antes se llamaba «${t}».`,
    tienesCupo: (t: string) => `Tienes cupo: ${t}`,
    saliste: 'Saliste de la lista de espera.',
    aLas: (h: string, t: string) => `A las ${h}: ${t}`,
    sinDireccion: 'Sin dirección.',
    teAsigno: (quien: string | null) => (quien ? `${quien} te asignó un contacto` : 'Te asignaron un contacto'),
    tePago: (quien: string | null, monto: string) => `${quien ?? 'Alguien'} te pagó ${monto}`,
    saldos: 'Tus saldos ya están al día.',
  },
  en: {
    nuevo: (t: string) => `New event: ${t}`,
    quedan: (n: number) => (n === 1 ? '1 spot left.' : `${n} spots left.`),
    lleno: "It's full: join the waitlist.",
    cancelado: (t: string) => `Canceled: ${t}`,
    yaNoVa: "It's no longer happening.",
    cambio: (t: string) => `Updated: ${t}`,
    nuevaHora: (c: string) => `New time: ${c}.`,
    terminaA: (h: string) => `Now ends at ${h}.`,
    nuevoLugar: (l: string) => `New place: ${l}.`,
    sinLugar: 'No place set anymore.',
    antesSeLlamaba: (t: string) => `Formerly “${t}”.`,
    tienesCupo: (t: string) => `You're in: ${t}`,
    saliste: "You're off the waitlist.",
    aLas: (h: string, t: string) => `At ${h}: ${t}`,
    sinDireccion: 'No address.',
    teAsigno: (quien: string | null) => (quien ? `${quien} assigned you a contact` : 'You have a new contact'),
    tePago: (quien: string | null, monto: string) => `${quien ?? 'Someone'} paid you ${monto}`,
    saldos: 'Your balances are up to date.',
  },
}

function deEvento(f: Fila, titulo: string, cuerpo: string, ttl = DIA_S, urgencia: Urgencia = 'normal'): Resultado {
  return { mensaje: { titulo: corto(titulo, 90), cuerpo: corto(cuerpo, 240), url: `/agenda/${f.evento_id}`, etiqueta: `evento-${f.evento_id}`, ttl, urgencia } }
}

function leerAntes(datos: Fila['datos']): Antes | null {
  const antes = datos?.antes
  if (!antes) return null
  return typeof antes === 'string' ? (JSON.parse(antes) as Antes) : antes
}

export function armar(f: Fila, ahora: Date): Resultado {
  if (f.sacada) return { descartar: 'Ya no está en Puente.' }
  if (!f.quiere) return { descartar: 'Apagó este tipo de aviso.' }
  if (ahora.getTime() - f.creado_en.getTime() > DIA_S * 1000) return { descartar: 'Venció: tiene más de un día.' }
  const idioma: Idioma = f.idioma === 'en' ? 'en' : 'es'
  const t = TEXTOS[idioma]

  if (f.tipo === 'contacto') {
    if (!f.contacto_id) return { descartar: 'El contacto ya no está.' }
    if (f.responsable !== f.persona) return { descartar: 'El contacto ya es de otra persona.' }
    const quien = [limpio(f.contacto_nombre), limpio(f.organizacion)].filter(Boolean).join(' · ')
    return { mensaje: { titulo: t.teAsigno(pila(f.asigna)), cuerpo: corto(quien, 240), url: `/contactos/${f.contacto_id}`, etiqueta: `contacto-${f.contacto_id}`, ttl: DIA_S, urgencia: 'normal' } }
  }

  if (f.tipo === 'pago') {
    if (!f.pago_id || f.monto === null) return { descartar: 'El pago ya no está.' }
    if (f.borrado_en) return { descartar: 'Se deshizo el pago.' }
    return { mensaje: { titulo: t.tePago(pila(f.paga), plata(f.monto, idioma)), cuerpo: t.saldos, url: '/gastos', etiqueta: `pago-${f.pago_id}`, ttl: DIA_S, urgencia: 'normal' } }
  }

  // Los demás son de un evento
  if (!f.evento_id || !f.inicio || !f.fin) return { descartar: 'El evento ya no está.' }
  const titulo = limpio(f.titulo)
  const empezo = f.inicio.getTime() <= ahora.getTime()

  switch (f.tipo) {
    case 'eventos': {
      if (f.cancelado_en) return { descartar: 'Se canceló el evento.' }
      if (empezo) return { descartar: 'El evento ya empezó.' }
      if (f.modo === 'cerrado') return { descartar: 'El evento es cerrado.' }
      if (f.estado) return { descartar: 'Ya está en el evento.' }
      const partes = [[cuando(f.inicio, ahora, idioma), dondeEs(f.lugar, null)].filter(Boolean).join(' · ') + '.']
      if (f.modo === 'con_cupo' && f.cupos !== null) {
        const quedan = f.cupos - (f.van ?? 0)
        partes.push(quedan > 0 ? t.quedan(quedan) : t.lleno)
      }
      return deEvento(f, t.nuevo(titulo), partes.join(' '))
    }

    case 'cambios': {
      if (f.estado !== 'va') return { descartar: 'Ya no va al evento.' }
      if (f.cancelado_en) return deEvento(f, t.cancelado(titulo), `${cuando(f.inicio, ahora, idioma)}. ${t.yaNoVa}`)
      if (f.fin.getTime() <= ahora.getTime()) return { descartar: 'El evento ya terminó.' }
      const antes = leerAntes(f.datos)
      if (!antes) return { descartar: 'No se sabe qué cambió.' }
      const partes: string[] = []
      const otraHora = new Date(antes.inicio).getTime() !== f.inicio.getTime()
      if (otraHora) partes.push(t.nuevaHora(cuando(f.inicio, ahora, idioma)))
      else if (new Date(antes.fin).getTime() !== f.fin.getTime()) partes.push(t.terminaA(hora(f.fin)))
      const donde = dondeEs(f.lugar, f.direccion)
      if (donde !== dondeEs(antes.lugar, antes.direccion)) partes.push(donde ? t.nuevoLugar(donde) : t.sinLugar)
      const tituloAntes = limpio(antes.titulo)
      if (tituloAntes !== titulo) partes.push(t.antesSeLlamaba(tituloAntes))
      // Se deshizo: quedó igual que antes
      if (partes.length === 0) return { descartar: 'Quedó como estaba.' }
      return deEvento(f, t.cambio(titulo), partes.join(' '))
    }

    case 'espera': {
      if (f.cancelado_en) return { descartar: 'Se canceló el evento.' }
      if (empezo) return { descartar: 'El evento ya empezó.' }
      if (f.estado !== 'va') return { descartar: 'Ya no tiene el cupo.' }
      return deEvento(f, t.tienesCupo(titulo), `${t.saliste} ${cuando(f.inicio, ahora, idioma)}.`, DIA_S, 'high')
    }

    case 'recordatorio': {
      if (f.cancelado_en) return { descartar: 'Se canceló el evento.' }
      if (empezo) return { descartar: 'El evento ya empezó.' }
      if (f.estado !== 'va') return { descartar: 'Ya no va al evento.' }
      // Dura hasta que empieza: después no sirve
      const ttl = Math.max(60, Math.min(HORA_S, Math.round((f.inicio.getTime() - ahora.getTime()) / 1000)))
      return deEvento(f, t.aLas(hora(f.inicio), titulo), dondeEs(f.lugar, f.direccion) || t.sinDireccion, ttl, 'high')
    }
  }
}
