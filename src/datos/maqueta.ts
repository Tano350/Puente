import type { Persona } from './consultas.ts'
import type { Contacto, Nota } from './contactos.ts'
import type { Calendario, Sincronizacion } from './calendario.ts'
import type { Asistente, Evento, NotaReunion, Ocupado } from './eventos.ts'
import type { Gasto, Pago, Parte, Rendicion } from './gastos.ts'
import type { Asignado, Tarea } from './estadoTareas.ts'
import { hoyEnCalifornia, momento, sumarDias, VIAJE } from './fechas.ts'

// Solo en desarrollo: personas de ejemplo del lienzo, para revisar pantallas sin entrar con Google.
// Se activa con ?maqueta=nueva (primera vez), ?maqueta=lista (ya entró) o ?maqueta=miembro (sin administrar). Nunca llega a la app publicada:
// los datos se arman dentro de funciones que solo se llaman en desarrollo.

export const modoMaqueta: string | null = import.meta.env.DEV ? new URLSearchParams(window.location.search).get('maqueta') : null

type Perfil = Pick<Persona, 'emprendimiento' | 'emprendimiento_texto' | 'objetivos' | 'linkedin'>

function perfil(emprendimiento: string, texto: string, objetivos: string, linkedin: string | null): Perfil {
  return { emprendimiento, emprendimiento_texto: texto, objetivos, linkedin }
}

function persona(id: string, nombre: string, carrera: string, llega: number, vuelve: number, extra: Partial<Persona> = {}): Persona {
  return {
    id,
    correo: `${id}@example.com`,
    usuario: `u-${id}`,
    nombre,
    foto: null,
    foto_google: null,
    carrera,
    emprendimiento: null,
    emprendimiento_texto: null,
    objetivos: null,
    linkedin: null,
    llega: sumarDias(VIAJE.desde, llega),
    vuelve: sumarDias(VIAJE.desde, vuelve),
    administra: false,
    idioma: 'es',
    invitada_por: null,
    invitada_en: '2026-10-30T12:00:00Z',
    entro_en: '2026-11-01T12:00:00Z',
    sacada_en: null,
    bienvenida_en: '2026-11-01T12:05:00Z',
    avisos: { eventos: true, cambios: true, espera: true, recordatorio: true, contacto: true, pago: true },
    ...extra,
  }
}

const sinEntrar: Partial<Persona> = { usuario: null, entro_en: null, nombre: null, carrera: null, llega: null, vuelve: null, bienvenida_en: null }

export function personaDeMaqueta(): Persona {
  const josefa = persona('josefa.contreras', 'Josefa Contreras', 'Ingeniería Civil', 4, 29, {
    ...perfil('Agua Clara', 'Filtros baratos para agua de pozo en zonas rurales.', 'Conocer fondos de impacto y aprender cómo venden startups de hardware a gobiernos.', null),
    administra: true,
    // Como si viniera de Google, para probar "Usar la de Google"
    foto_google: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#8fa3b8"/><circle cx="32" cy="26" r="12" fill="#e7c3a1"/><rect x="16" y="42" width="32" height="26" rx="12" fill="#3f6fa0"/></svg>')}`,
  })
  if (modoMaqueta === 'nueva') return { ...josefa, carrera: null, emprendimiento: null, emprendimiento_texto: null, objetivos: null, linkedin: null, llega: null, vuelve: null, bienvenida_en: null }
  // ?maqueta=miembro: la misma Josefa, pero sin administrar (para ver lo que no puede cambiar)
  if (modoMaqueta === 'miembro') return { ...josefa, administra: false }
  return josefa
}

// La lista se arma una vez; invitar, sacar y devolver la cambian como lo haría la base
let gente: Persona[] | null = null

export function personasDeMaqueta(): Persona[] {
  gente ??= [
    personaDeMaqueta(),
    persona('andres.cifuentes', 'Andrés Cifuentes', 'Ingeniería Civil', 3, 27, perfil('Ruta Fría', 'Sensores de temperatura para camiones que llevan alimentos.', 'Ver cómo operan las startups de logística y buscar un piloto en California.', 'linkedin.com/in/andres-cifuentes')),
    persona('benjamin.silva', 'Benjamín Silva', 'Ingeniería Civil', 5, 33, perfil('Grúa Libre', 'Arriendo de maquinaria entre constructoras.', 'Aprender cómo venden las startups de construcción y conocer inversionistas del rubro.', 'linkedin.com/in/benjamin-silva')),
    persona('catalina.perez', 'Catalina Pérez', 'Ingeniería Comercial', 4, 29, perfil('Aula Viva', 'Clases de programación para colegios rurales.', 'Conocer los programas de educación de empresas tecnológicas y conseguir socios.', 'linkedin.com/in/catalina-perez')),
    persona('diego.larrain', 'Diego Larraín', 'Ingeniería Comercial', 2, 36, {
      ...perfil('Bodega Viva', 'Software para que los almacenes de barrio controlen su inventario.', 'Entender cómo escalaron los marketplaces B2B y conseguir tres mentores para Bodega Viva.', 'linkedin.com/in/diego-larrain'),
      administra: true,
    }),
    persona('florencia.diaz', 'Florencia Díaz', 'Ingeniería Comercial', 9, 37, perfil('Pulso', 'Un parche que mide la presión arterial todo el día.', 'Entender cómo se certifica un dispositivo médico en Estados Unidos.', 'linkedin.com/in/florencia-diaz')),
    persona('ignacio.rivas', 'Ignacio Rivas', 'Ingeniería Civil', 4, 23, perfil('Voltea', 'Cargadores rápidos para bicicletas eléctricas.', 'Validar Voltea con empresas de movilidad y aprender cómo se hace hardware allá.', 'linkedin.com/in/ignacio-rivas')),
    persona('joaquin.soto', 'Joaquín Soto', 'Ingeniería Comercial', 7, 30, perfil('Mesa Lista', 'Reservas y pedidos para restaurantes chicos.', 'Aprender a vender software a restaurantes y conocer aceleradoras.', 'linkedin.com/in/joaquin-soto')),
    persona('martina.vidal', 'Martina Vidal', 'Ingeniería Comercial', 3, 29, perfil('Lazo', 'Una app para coordinar el cuidado de adultos mayores.', 'Validar Lazo con startups de salud y entender cómo cobran.', 'linkedin.com/in/martina-vidal')),
    persona('paula.torres', 'Paula Torres', 'Ingeniería Comercial', 4, 32, perfil('Ropa Circular', 'Arriendo de ropa de trabajo para empresas.', 'Conocer marcas de moda circular y cómo miden su impacto.', 'linkedin.com/in/paula-torres')),
    persona('sofia.mendez', 'Sofía Méndez', 'Ingeniería Civil', 6, 35, perfil('Andes Dron', 'Drones para revisar torres eléctricas.', 'Aprender de startups de drones y buscar clientes en energía.', 'linkedin.com/in/sofia-mendez')),
    persona('vicente.morales', 'Vicente Morales', 'Ingeniería Civil', 4, 25),
    persona('tomas.fuenzalida', 'Tomás Fuenzalida', 'Ingeniería Comercial', 14, 50, sinEntrar),
    persona('martin.ossa', 'Martín Ossa', 'Ingeniería Comercial', 4, 29, { ...sinEntrar, invitada_en: '2026-11-02T12:00:00Z' }),
  ]
  return gente
}

export function cambiarMaqueta(cambiar: (personas: Persona[]) => Persona[]) {
  gente = cambiar(personasDeMaqueta())
}

// ---------- Contactos de ejemplo (los 16 del lienzo; "Tú" es Josefa) ----------
let contactos: Contacto[] | null = null
let notas: Nota[] | null = null

function contacto(id: string, nombre: string, organizacion: string, responsable: string, etapa: Contacto['etapa'], etapaEn: string, canal: Contacto['canal'], dato: string, extra: Partial<Contacto> = {}): Contacto {
  return { id, nombre, organizacion, responsable, etapa, etapa_en: `${etapaEn}T15:00:00Z`, canal, dato, personal: false, asignado_por: null, creado_por: responsable, creado_en: '2026-11-10T15:00:00Z', ...extra }
}

export function contactosDeMaqueta(): Contacto[] {
  contactos ??= [
    contacto('camila', 'Camila Reyes', 'Stripe', 'tomas.fuenzalida', 'por_contactar', '2027-01-10', 'correo', 'camila.reyes@example.com', { creado_por: 'diego.larrain', asignado_por: 'diego.larrain' }),
    contacto('emily', 'Emily Davis', 'Lightspeed', 'paula.torres', 'por_contactar', '2027-01-09', 'linkedin', 'linkedin.com/in/emily-davis'),
    contacto('kevin', 'Kevin Park', 'StartX', 'sofia.mendez', 'por_contactar', '2027-01-06', 'correo', 'kevin.park@example.com'),
    contacto('matias', 'Matías Lagos', 'NVIDIA', 'josefa.contreras', 'por_contactar', '2027-01-11', 'linkedin', 'linkedin.com/in/matias-lagos', { creado_por: 'diego.larrain', asignado_por: 'diego.larrain' }),
    contacto('david', 'David Levin', 'Airbnb', 'diego.larrain', 'contactado', '2026-12-01', 'linkedin', 'linkedin.com/in/david-levin'),
    contacto('nicolas', 'Nicolás Vidal', 'Google', 'catalina.perez', 'contactado', '2026-12-05', 'telefono', '+1 650 555 0142'),
    contacto('rodrigo', 'Rodrigo Pérez', 'NotCo', 'josefa.contreras', 'contactado', '2026-11-28', 'correo', 'rodrigo.perez@example.com', { personal: true }),
    contacto('sarah', 'Sarah Kim', 'Y Combinator', 'joaquin.soto', 'contactado', '2026-12-09', 'linkedin', 'linkedin.com/in/sarah-kim'),
    contacto('felipe', 'Felipe Araya', 'Cornershop by Uber', 'josefa.contreras', 'respondio', '2026-12-10', 'correo', 'felipe.araya@example.com'),
    contacto('valentina', 'Valentina Ortiz', 'Platanus', 'catalina.perez', 'respondio', '2026-11-20', 'telefono', '+56 9 5555 0199'),
    contacto('ana', 'Ana Rojas', 'Stripe', 'josefa.contreras', 'reunion_agendada', '2026-12-04', 'linkedin', 'linkedin.com/in/ana-rojas'),
    contacto('andrea', 'Andrea Fuentes', 'Figma', 'josefa.contreras', 'reunion_agendada', '2027-01-08', 'correo', 'andrea.fuentes@example.com'),
    contacto('priya', 'Priya Raman', 'Sequoia Capital', 'diego.larrain', 'reunion_agendada', '2027-01-05', 'correo', 'priya.raman@example.com'),
    contacto('javier', 'Javier Muñoz', 'Apple', 'martina.vidal', 'reunion_hecha', '2027-01-08', 'correo', 'javier.munoz@example.com'),
    contacto('laura', 'Laura Chen', 'Plug and Play', 'josefa.contreras', 'reunion_hecha', '2027-01-12', 'correo', 'laura.chen@example.com'),
    contacto('daniela', 'Daniela Soto', 'Meta', 'andres.cifuentes', 'descartado', '2026-12-04', 'linkedin', 'linkedin.com/in/daniela-soto'),
  ]
  return contactos
}

export function cambiarContactosDeMaqueta(cambiar: (lista: Contacto[]) => Contacto[]) {
  contactos = cambiar(contactosDeMaqueta())
}

function nota(id: string, contacto: string, autor: string, texto: string, creada: string, personal = false): Nota {
  return { id, contacto, autor, texto, personal, creada_en: `${creada}T15:00:00Z` }
}

export function notasDeMaqueta(): Nota[] {
  notas ??= [
    nota('n-matias', 'matias', 'diego.larrain', 'Exalumno de Ingeniería UC. Trabaja en robótica.', '2027-01-11'),
    nota('n-david', 'david', 'diego.larrain', 'Le escribí por LinkedIn. Está de viaje hasta el 20 de diciembre.', '2026-12-01'),
    nota('n-rodrigo', 'rodrigo', 'josefa.contreras', 'Amigo de mi familia. Responde más rápido por WhatsApp.', '2026-11-20', true),
    nota('n-felipe', 'felipe', 'josefa.contreras', 'Nos lo presentó Valentina Ortiz, de Platanus. Lideró la llegada de Cornershop a México.', '2026-12-02'),
    nota('n-valentina', 'valentina', 'catalina.perez', 'Nos presentó a Felipe Araya.', '2026-11-20'),
    nota('n-ana', 'ana', 'josefa.contreras', 'Le interesa conocer startups chilenas de pagos.', '2026-12-02'),
    nota('n-andrea', 'andrea', 'josefa.contreras', 'Exalumna UC. Nos puede mostrar la oficina de Figma.', '2026-12-05'),
    nota('n-priya', 'priya', 'diego.larrain', 'Ve inversiones en América Latina.', '2026-12-01'),
    nota('n-daniela', 'daniela', 'andres.cifuentes', 'No está viendo startups este año.', '2026-12-04'),
  ]
  return notas
}

export function cambiarNotasDeMaqueta(cambiar: (lista: Nota[]) => Nota[]) {
  notas = cambiar(notasDeMaqueta())
}

// ---------- Agenda de ejemplo: la semana del 11 al 16 de enero del lienzo ----------
type Datos = { readonly personas: Persona[]; eventos: Evento[]; asistentes: Asistente[]; ocupados: Ocupado[]; notasReunion: NotaReunion[] }
let agenda: Datos | null = null

const YO = 'josefa.contreras'
const [ANDRES, BENJAMIN, CATALINA, DIEGO, FLORENCIA, IGNACIO, JOAQUIN, MARTINA, PAULA, SOFIA, VICENTE] = ['andres.cifuentes', 'benjamin.silva', 'catalina.perez', 'diego.larrain', 'florencia.diaz', 'ignacio.rivas', 'joaquin.soto', 'martina.vidal', 'paula.torres', 'sofia.mendez', 'vicente.morales']

type Ejemplo = [id: string, dia: number, desde: string, hasta: string, titulo: string, tipo: Evento['tipo'], lugar: string, direccion: string, modo: Evento['modo'], cupos: number | null, organizador: string, van: string[], espera?: string[], notas?: string, contacto?: string]

// Las mismas personas, cupos y listas de espera del lienzo ("Tú" es Josefa)
export function datosDeMaqueta(): Datos {
  if (agenda) return agenda
  const ejemplos: Ejemplo[] = [
    ['intuit', 11, '09:30', '11:30', 'Visita a Intuit', 'visita', 'Intuit', '2700 Coast Ave, Mountain View', 'con_cupo', 10, BENJAMIN, [BENJAMIN, YO, CATALINA, PAULA, ANDRES, DIEGO, FLORENCIA, IGNACIO]],
    ['almuerzo-11', 11, '13:00', '14:00', 'Almuerzo del grupo', 'comida', 'Coupa Café', '538 Ramona St, Palo Alto', 'para_todos', null, MARTINA, [MARTINA, YO, ANDRES, CATALINA, DIEGO, PAULA, SOFIA, VICENTE, JOAQUIN]],
    ['dschool', 11, '18:00', '20:00', 'Charla en la d.school', 'visita', 'Stanford d.school', '416 Escondido Mall, Stanford', 'con_cupo', 14, FLORENCIA, [FLORENCIA, YO, IGNACIO, VICENTE, ANDRES, BENJAMIN, CATALINA, DIEGO, JOAQUIN, MARTINA]],
    ['cafe-laura', 12, '09:00', '10:00', 'Café con Laura Chen', 'reunion', 'Philz Coffee', '101 Forest Ave, Palo Alto', 'con_cupo', 4, YO, [YO], [], '', 'laura'],
    ['plug', 12, '10:30', '12:00', 'Plug and Play', 'visita', 'Plug and Play Tech Center', '440 N Wolfe Rd, Sunnyvale', 'con_cupo', 8, CATALINA, [CATALINA, YO, DIEGO, JOAQUIN, MARTINA], [], 'Llevar el pitch de una página. Nos recibe Amir en la recepción.'],
    ['almuerzo-12', 12, '13:00', '14:00', 'Almuerzo del grupo', 'comida', 'Castro St', 'Castro St, Mountain View', 'para_todos', null, MARTINA, [MARTINA, YO, ANDRES, CATALINA, DIEGO, PAULA, SOFIA, VICENTE]],
    ['sequoia', 12, '14:30', '15:30', 'Reunión con Sequoia', 'reunion', 'Sequoia Capital', '2800 Sand Hill Rd, Menlo Park', 'cerrado', null, DIEGO, [DIEGO, MARTINA], [], '', 'priya'],
    ['reunion-ana', 12, '16:00', '17:00', 'Reunión con Ana Rojas', 'reunion', 'Stripe', 'Townsend St, San Francisco', 'con_cupo', 4, YO, [YO], [], '', 'ana'],
    ['charla-stripe', 12, '17:30', '18:45', 'Charla en Stripe', 'visita', 'Stripe', '354 Oyster Point Blvd, South San Francisco', 'con_cupo', 8, DIEGO, [DIEGO, SOFIA, PAULA, VICENTE], [], 'Charla sobre pagos en Latinoamérica. Hay que llevar pasaporte para entrar.'],
    ['cena', 12, '19:00', '22:00', 'Cena con exalumnos UC', 'comida', 'Foreign Cinema', '2534 Mission St, San Francisco', 'para_todos', null, JOAQUIN, [JOAQUIN, CATALINA, DIEGO, ANDRES, BENJAMIN, FLORENCIA, IGNACIO, MARTINA, PAULA], [], 'Cada uno paga lo suyo. Reservamos la mesa larga del patio.'],
    ['google', 13, '08:30', '10:30', 'Visita a Google', 'visita', 'Googleplex', '1600 Amphitheatre Pkwy, Mountain View', 'con_cupo', 6, MARTINA, [MARTINA, CATALINA, IGNACIO, ANDRES, BENJAMIN, DIEGO], [PAULA, SOFIA], 'Recorrido por el campus y conversación con el equipo de Google for Startups.'],
    ['taller', 13, '11:00', '13:00', 'Taller de pitch', 'otro', 'Hotel Avante', '860 E El Camino Real, Mountain View', 'para_todos', null, PAULA, [PAULA, SOFIA, VICENTE, ANDRES, BENJAMIN, CATALINA, DIEGO], [], 'Trae tu pitch de 3 minutos.'],
    ['andres-vial', 13, '15:00', '16:00', 'Reunión con Andrés Vial', 'reunion', 'Blue Bottle Coffee', '456 University Ave, Palo Alto', 'con_cupo', 4, YO, [YO]],
    ['tesla', 14, '10:00', '12:00', 'Visita a Tesla', 'visita', 'Tesla', '3500 Deer Creek Rd, Palo Alto', 'con_cupo', 10, IGNACIO, [IGNACIO, JOAQUIN, PAULA, ANDRES, BENJAMIN, CATALINA, DIEGO]],
    ['sofia-lagos', 14, '14:00', '15:00', 'Café con Sofía Lagos', 'reunion', 'Verve Coffee', '162 University Ave, Palo Alto', 'con_cupo', 4, YO, [YO]],
    ['asado', 14, '19:00', '21:00', 'Asado del grupo', 'comida', 'Rinconada Park', '777 Embarcadero Rd, Palo Alto', 'para_todos', null, DIEGO, [DIEGO, YO, ANDRES, BENJAMIN, CATALINA, FLORENCIA, IGNACIO, JOAQUIN, MARTINA, PAULA, SOFIA]],
    ['apple', 15, '09:30', '12:00', 'Visita a Apple Park', 'visita', 'Apple Park Visitor Center', '10600 N Tantau Ave, Cupertino', 'con_cupo', 6, SOFIA, [SOFIA, BENJAMIN, ANDRES, CATALINA, DIEGO, FLORENCIA], [IGNACIO, JOAQUIN, VICENTE]],
    ['half-moon-bay', 16, '10:00', '16:00', 'Paseo a Half Moon Bay', 'otro', 'Half Moon Bay', 'Half Moon Bay, CA', 'para_todos', null, MARTINA, [MARTINA, YO, ANDRES, BENJAMIN, CATALINA, DIEGO, FLORENCIA, IGNACIO, JOAQUIN, PAULA]],
  ]
  const dia = (n: number) => `2027-01-${String(n).padStart(2, '0')}`
  const llegada = (minutos: number) => new Date(Date.UTC(2027, 0, 2, 12, minutos)).toISOString()
  const eventos: Evento[] = ejemplos.map(([id, d, desde, hasta, titulo, tipo, lugar, direccion, modo, cupos, organizador, , , notas, contacto]) => ({
    id,
    titulo,
    tipo,
    lugar,
    direccion,
    modo,
    cupos,
    organizador,
    notas: notas || null,
    contacto: contacto ?? null,
    inicio: momento(dia(d), desde),
    fin: momento(dia(d), hasta),
    google_id: null,
    desde_google: false,
    creado_por: organizador,
    creado_en: llegada(0),
    cambiado_en: llegada(0),
    cancelado_en: null,
  }))
  const asistentes: Asistente[] = ejemplos.flatMap(([id, , , , , , , , , , , van, espera = []]) => [
    ...van.map((persona, i) => ({ evento: id, persona, estado: 'va', desde: llegada(i) })),
    ...espera.map((persona, i) => ({ evento: id, persona, estado: 'espera', desde: llegada(60 + i) })),
  ])
  agenda = {
    get personas() {
      return personasDeMaqueta()
    },
    eventos,
    asistentes,
    ocupados: [{ id: 'clase-online', persona: YO, titulo: 'Clase online', inicio: momento(dia(15), '15:00'), fin: momento(dia(15), '16:00') }],
    notasReunion: [{ evento: 'cafe-laura', autor: YO, aprendi: 'Plug and Play busca startups de logística para su programa de primavera.', sigue: 'Mandarle el deck antes del viernes.', escrita_en: '2027-01-12T19:00:00Z' }],
  }
  return agenda
}

// Google Calendar (solo quien administra): los calendarios del viaje que ve en su cuenta y si la sincronización está encendida.
// El tuyo es tuyo; Diego te dio permiso para hacer cambios y Martina solo para ver.
let calendarios: Calendario[] | null = null
let sincroniza = false

export function calendariosDeMaqueta(): Calendario[] {
  calendarios ??= [
    { google_id: 'cal-josefa', nombre: 'Josefa: The Bridge', permiso: 'owner', persona: YO, visto_en: '2027-01-12T18:00:00Z' },
    { google_id: 'cal-diego', nombre: 'Diego: The Bridge', permiso: 'writer', persona: null, visto_en: '2027-01-12T18:00:00Z' },
    { google_id: 'cal-martina', nombre: 'Martina: The bridge', permiso: 'reader', persona: null, visto_en: '2027-01-12T18:00:00Z' },
  ]
  return calendarios
}

export function cambiarCalendariosDeMaqueta(cambiar: (lista: Calendario[]) => Calendario[]) {
  calendarios = cambiar(calendariosDeMaqueta())
}

export function sincronizacionDeMaqueta(): Sincronizacion {
  return { unica: true, activa: sincroniza, ultima_vez: sincroniza ? '2027-01-12T18:11:00Z' : null, errores: 0 }
}

export function cambiarSincronizacionDeMaqueta(activa: boolean) {
  sincroniza = activa
}

// ---------- Gastos ----------
// Los 7 gastos del lienzo (del 10 al 12 de enero) y el Airbnb de la primera semana entre los 14, para que "Tú"
// (Josefa) deba US$ 84,00 como en el diseño. El supermercado tiene foto de la boleta; Josefa rinde el café con Laura.
export type DatosGastos = { gastos: Gasto[]; partes: Parte[]; pagos: Pago[]; rendiciones: Rendicion[] }
let cuentas: DatosGastos | null = null

export function gastosDeMaqueta(): DatosGastos {
  if (cuentas) return cuentas
  const todos = personasDeMaqueta()
    .filter((p) => !p.sacada_en)
    .map((p) => p.id)
  // Partes iguales: los centavos que sobran van a los primeros
  const igual = (monto: number, quienes: string[]): [string, number][] =>
    quienes.map((persona, i) => [persona, Math.floor(monto / quienes.length) + (i < monto % quienes.length ? 1 : 0)])
  const ejemplos: [id: string, fecha: string, titulo: string, categoria: string, monto: number, pago: string, division: string, partes: [string, number][], boleta?: string][] = [
    ['uber', '2027-01-12', 'Uber al Plug and Play', 'auto', 3840, YO, 'iguales', igual(3840, [YO, CATALINA, DIEGO, MARTINA])],
    ['cafe-laura', '2027-01-12', 'Café con Laura Chen', 'cafe', 1450, YO, 'solo', [[YO, 1450]]],
    ['cena', '2027-01-11', 'Cena en Palo Alto', 'comida', 31200, MARTINA, 'exactos', [[YO, 4100], [CATALINA, 3500], [DIEGO, 4400], [IGNACIO, 3800], [JOAQUIN, 3600], [MARTINA, 4000], [PAULA, 3000], [SOFIA, 4800]]],
    ['super', '2027-01-11', 'Supermercado', 'super', 12680, DIEGO, 'iguales', igual(12680, [DIEGO, CATALINA, YO, MARTINA, PAULA, SOFIA]), 'super/boleta.jpg'],
    ['museo', '2027-01-11', 'Entradas al Computer History Museum', 'entrada', 9000, JOAQUIN, 'iguales', igual(9000, [JOAQUIN, IGNACIO, VICENTE, ANDRES, BENJAMIN, FLORENCIA])],
    ['caltrain', '2027-01-10', 'Caltrain a San Francisco', 'tren', 2800, CATALINA, 'iguales', igual(2800, [YO, CATALINA, DIEGO, MARTINA])],
    ['bicis', '2027-01-10', 'Arriendo de bicicletas', 'bici', 4500, YO, 'iguales', igual(4500, [YO, MARTINA, SOFIA])],
    ['airbnb', '2027-01-05', 'Airbnb de la primera semana', 'alojamiento', 7367 * todos.length, DIEGO, 'iguales', igual(7367 * todos.length, todos)],
  ]
  cuentas = {
    // Dentro de un día, el primero de la lista es el último anotado
    gastos: ejemplos.map(([id, fecha, titulo, categoria, monto, pago, division, , boleta], i) => {
      const cuando = `${fecha}T${String(23 - i).padStart(2, '0')}:00:00Z`
      return { id, titulo, categoria, monto, fecha, pagado_por: pago, division, boleta: boleta ?? null, boleta_por: boleta ? pago : null, creado_por: pago, creado_en: cuando, cambiado_en: cuando, borrado_en: null }
    }),
    partes: ejemplos.flatMap(([gasto, , , , , , , partes]) => partes.map(([persona, monto]) => ({ gasto, persona, monto }))),
    pagos: [],
    rendiciones: [{ gasto: 'cafe-laura', persona: YO, marcado_en: '2027-01-12T21:00:00Z' }],
  }
  return cuentas
}

export function cambiarGastosDeMaqueta(cambiar: (datos: DatosGastos) => DatosGastos) {
  cuentas = cambiar(gastosDeMaqueta())
}

// Una boleta dibujada, para ver la foto sin subir nada
export function boletaDeMaqueta(): string {
  const lineas = ['Leche', 'Pan', 'Frutas', 'Café', 'Agua', 'Huevos'].map((cosa, i) => `<text x="24" y="${118 + i * 26}">${cosa}</text><text x="216" y="${118 + i * 26}" text-anchor="end">${(8.5 + i * 3.7).toFixed(2)}</text>`)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="380" font-family="monospace" font-size="15" fill="#222"><rect width="240" height="380" fill="#fbfaf6"/><text x="120" y="44" text-anchor="middle" font-size="19" font-weight="bold">SUPERMERCADO</text><text x="120" y="70" text-anchor="middle">Palo Alto, CA</text>${lineas.join('')}<text x="24" y="300" font-weight="bold">TOTAL</text><text x="216" y="300" text-anchor="end" font-weight="bold">126.80</text><text x="120" y="344" text-anchor="middle">Gracias</text></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

// ---------- Tareas de ejemplo (las del diseño; "Tú" es Josefa). Las fechas van contadas desde hoy ----------
type DatosTareas = { tareas: Tarea[]; asignados: Asignado[] }
let tareasMaqueta: DatosTareas | null = null

function armarTareas(): DatosTareas {
  const hoy = hoyEnCalifornia()
  const dia = (n: number) => sumarDias(hoy, n)
  const instante = (n: number, hora = '10:00') => momento(dia(n), hora)
  const tarea = (id: string, titulo: string, para: string | null, creadaPor: string, creadaHace: number, extra: Partial<Tarea> = {}): Tarea => ({
    id, titulo, notas: null, para, cada_uno: false, personal: false, creada_por: creadaPor, creada_en: instante(-creadaHace, '09:00'), borrada_en: null, ...extra,
  })
  const TOMAS = 'tomas.fuenzalida'
  const MARTIN = 'martin.ossa'
  const tareas = [
    tarea('carta', 'Mandar la carta a la Escuela', dia(-2), DIEGO, 8, { notas: 'La firman los 14 y se manda en PDF.' }),
    tarea('airbnb', 'Cotizar el Airbnb de Palo Alto', dia(1), DIEGO, 5, { notas: 'Para 14, del 5 al 30 de enero. Al menos tres opciones.' }),
    tarea('seguro', 'Pagar el seguro de viaje', dia(3), CATALINA, 7, { cada_uno: true, notas: 'El que pide la Escuela. Mándale el comprobante a Catalina.' }),
    tarea('auto', 'Reservar el auto', dia(6), DIEGO, 8, { notas: 'Un auto para 7, del 5 al 12 de enero.' }),
    tarea('presentacion', 'Armar la presentación del grupo', dia(21), YO, 4, { notas: 'Una lámina por emprendimiento.' }),
    tarea('regalos', 'Regalos para Plug and Play', dia(35), PAULA, 3, { notas: 'Algo chileno para el equipo de Laura Chen.' }),
    tarea('adaptadores', 'Comprar adaptadores de enchufe', null, YO, 2, { personal: true, notas: 'Tipo A y B.' }),
    tarea('whatsapp', 'Crear el grupo de WhatsApp', dia(-12), DIEGO, 14),
    tarea('correos', 'Juntar los correos de los 14', dia(-9), DIEGO, 13),
    tarea('fechas', 'Elegir las fechas del viaje', dia(-6), CATALINA, 12, { cada_uno: true }),
  ]
  const fila = (t: string, persona: string, creadaHace: number, extra: Partial<Asignado> = {}): Asignado => ({
    tarea: t, persona, tomada: false, hecha_en: null, asignado_en: instante(-creadaHace, '09:00'), ...extra,
  })
  const hechasSeguro = [BENJAMIN, CATALINA, DIEGO, FLORENCIA, IGNACIO, JOAQUIN, MARTINA, PAULA, SOFIA]
  const asignados = [
    fila('carta', YO, 8),
    fila('airbnb', CATALINA, 5),
    ...[YO, ANDRES, ...hechasSeguro, VICENTE, TOMAS, MARTIN].map((p, i) => fila('seguro', p, 7, hechasSeguro.includes(p) ? { hecha_en: instante(-6 + (i % 4), '18:30') } : {})),
    fila('auto', YO, 8),
    fila('auto', DIEGO, 8),
    fila('presentacion', MARTINA, 4),
    fila('presentacion', TOMAS, 4),
    fila('adaptadores', YO, 2),
    fila('whatsapp', DIEGO, 14, { hecha_en: instante(-12, '20:00') }),
    fila('correos', YO, 13, { hecha_en: instante(-10, '11:30') }),
    ...[YO, DIEGO, CATALINA].map((p, i) => fila('fechas', p, 12, { hecha_en: instante(-7 + i, '19:00') })),
  ]
  return { tareas, asignados }
}

export function tareasDeMaqueta(): Tarea[] {
  tareasMaqueta ??= armarTareas()
  return tareasMaqueta.tareas
}

export function asignadosDeMaqueta(): Asignado[] {
  tareasMaqueta ??= armarTareas()
  return tareasMaqueta.asignados
}

export function cambiarTareasDeMaqueta(cambiar: (lista: Tarea[]) => Tarea[]) {
  tareasMaqueta ??= armarTareas()
  tareasMaqueta = { ...tareasMaqueta, tareas: cambiar(tareasMaqueta.tareas) }
}

export function cambiarAsignadosDeMaqueta(cambiar: (lista: Asignado[]) => Asignado[]) {
  tareasMaqueta ??= armarTareas()
  tareasMaqueta = { ...tareasMaqueta, asignados: cambiar(tareasMaqueta.asignados) }
}
