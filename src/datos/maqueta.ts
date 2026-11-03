import type { Persona } from './consultas.ts'
import type { Contacto, Nota } from './contactos.ts'
import type { Calendario, Sincronizacion } from './calendario.ts'
import type { Asistente, Evento, NotaReunion, Ocupado } from './eventos.ts'
import { momento, sumarDias, VIAJE } from './fechas.ts'

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
  const josefa = persona('josefa.contreras', 'Josefa Contreras', 'Ingeniería Civil Química', 4, 29, {
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
    persona('andres.cifuentes', 'Andrés Cifuentes', 'Ingeniería Civil en Computación', 3, 27, perfil('Ruta Fría', 'Sensores de temperatura para camiones que llevan alimentos.', 'Ver cómo operan las startups de logística y buscar un piloto en California.', 'linkedin.com/in/andres-cifuentes')),
    persona('benjamin.silva', 'Benjamín Silva', 'Ingeniería Civil Mecánica', 5, 33, perfil('Grúa Libre', 'Arriendo de maquinaria entre constructoras.', 'Aprender cómo venden las startups de construcción y conocer inversionistas del rubro.', 'linkedin.com/in/benjamin-silva')),
    persona('catalina.perez', 'Catalina Pérez', 'Ingeniería Civil Industrial', 4, 29, perfil('Aula Viva', 'Clases de programación para colegios rurales.', 'Conocer los programas de educación de empresas tecnológicas y conseguir socios.', 'linkedin.com/in/catalina-perez')),
    persona('diego.larrain', 'Diego Larraín', 'Ingeniería Civil Industrial', 2, 36, {
      ...perfil('Bodega Viva', 'Software para que los almacenes de barrio controlen su inventario.', 'Entender cómo escalaron los marketplaces B2B y conseguir tres mentores para Bodega Viva.', 'linkedin.com/in/diego-larrain'),
      administra: true,
    }),
    persona('florencia.diaz', 'Florencia Díaz', 'Ingeniería Civil Biomédica', 9, 37, perfil('Pulso', 'Un parche que mide la presión arterial todo el día.', 'Entender cómo se certifica un dispositivo médico en Estados Unidos.', 'linkedin.com/in/florencia-diaz')),
    persona('ignacio.rivas', 'Ignacio Rivas', 'Ingeniería Civil Eléctrica', 4, 23, perfil('Voltea', 'Cargadores rápidos para bicicletas eléctricas.', 'Validar Voltea con empresas de movilidad y aprender cómo se hace hardware allá.', 'linkedin.com/in/ignacio-rivas')),
    persona('joaquin.soto', 'Joaquín Soto', 'Ingeniería Civil en Computación', 7, 30, perfil('Mesa Lista', 'Reservas y pedidos para restaurantes chicos.', 'Aprender a vender software a restaurantes y conocer aceleradoras.', 'linkedin.com/in/joaquin-soto')),
    persona('martina.vidal', 'Martina Vidal', 'Ingeniería Civil en Computación', 3, 29, perfil('Lazo', 'Una app para coordinar el cuidado de adultos mayores.', 'Validar Lazo con startups de salud y entender cómo cobran.', 'linkedin.com/in/martina-vidal')),
    persona('paula.torres', 'Paula Torres', 'Ingeniería Civil Industrial', 4, 32, perfil('Ropa Circular', 'Arriendo de ropa de trabajo para empresas.', 'Conocer marcas de moda circular y cómo miden su impacto.', 'linkedin.com/in/paula-torres')),
    persona('sofia.mendez', 'Sofía Méndez', 'Ingeniería Civil Mecánica', 6, 35, perfil('Andes Dron', 'Drones para revisar torres eléctricas.', 'Aprender de startups de drones y buscar clientes en energía.', 'linkedin.com/in/sofia-mendez')),
    persona('vicente.morales', 'Vicente Morales', 'Ingeniería Civil', 4, 25),
    persona('tomas.fuenzalida', 'Tomás Fuenzalida', 'Ingeniería Civil Eléctrica', 14, 50, sinEntrar),
    persona('martin.ossa', 'Martín Ossa', 'Ingeniería Civil', 4, 29, { ...sinEntrar, invitada_en: '2026-11-02T12:00:00Z' }),
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
