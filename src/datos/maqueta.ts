import type { Persona } from './consultas.ts'
import type { Contacto, Nota } from './contactos.ts'
import { sumarDias, VIAJE } from './fechas.ts'

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
  const josefa = persona('josefa.contreras', 'Josefa Contreras', 'Ingeniería Civil Química', 15, 44, {
    ...perfil('Agua Clara', 'Filtros baratos para agua de pozo en zonas rurales.', 'Conocer fondos de impacto y aprender cómo venden startups de hardware a gobiernos.', null),
    administra: true,
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
