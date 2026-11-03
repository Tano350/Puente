import type { Persona } from './consultas.ts'
import { sumarDias, VIAJE } from './fechas.ts'

// Solo en desarrollo: personas de ejemplo del lienzo, para revisar pantallas sin entrar con Google.
// Se activa con ?maqueta=nueva (primera vez) o ?maqueta=lista (ya entró). Nunca llega a la app publicada:
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
