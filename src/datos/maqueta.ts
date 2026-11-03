import type { Persona } from './consultas.ts'
import { sumarDias, VIAJE } from './fechas.ts'

// Solo en desarrollo: personas de ejemplo del lienzo, para revisar pantallas sin entrar con Google.
// Se activa con ?maqueta=nueva (primera vez) o ?maqueta=lista (ya entró). Nunca llega a la app publicada:
// los datos se arman dentro de funciones que solo se llaman en desarrollo.

export const modoMaqueta: string | null = import.meta.env.DEV ? new URLSearchParams(window.location.search).get('maqueta') : null

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

const sinEntrar: Partial<Persona> = { entro_en: null, nombre: null, carrera: null, llega: null, vuelve: null, bienvenida_en: null }

export function personaDeMaqueta(): Persona {
  const josefa = persona('josefa.contreras', 'Josefa Contreras', 'Ingeniería Civil Química', 15, 44, {
    emprendimiento: 'Agua Clara',
    emprendimiento_texto: 'Filtros baratos para agua de pozo en zonas rurales.',
    objetivos: 'Conocer fondos de impacto y aprender cómo venden startups de hardware a gobiernos.',
    linkedin: 'linkedin.com/in/josefa-contreras',
    administra: true,
  })
  if (modoMaqueta === 'nueva') return { ...josefa, carrera: null, emprendimiento: null, emprendimiento_texto: null, objetivos: null, linkedin: null, llega: null, vuelve: null, bienvenida_en: null }
  return josefa
}

export function personasDeMaqueta(): Persona[] {
  return [
    personaDeMaqueta(),
    persona('andres.cifuentes', 'Andrés Cifuentes', 'Ingeniería Civil en Computación', 3, 27),
    persona('benjamin.silva', 'Benjamín Silva', 'Ingeniería Civil Mecánica', 5, 33),
    persona('catalina.perez', 'Catalina Pérez', 'Ingeniería Civil Industrial', 4, 29),
    persona('diego.larrain', 'Diego Larraín', 'Ingeniería Civil Industrial', 2, 36, { administra: true }),
    persona('florencia.diaz', 'Florencia Díaz', 'Ingeniería Civil Biomédica', 9, 37),
    persona('ignacio.rivas', 'Ignacio Rivas', 'Ingeniería Civil Eléctrica', 4, 23),
    persona('joaquin.soto', 'Joaquín Soto', 'Ingeniería Civil en Computación', 7, 30),
    persona('martina.vidal', 'Martina Vidal', 'Ingeniería Civil en Computación', 3, 29),
    persona('paula.torres', 'Paula Torres', 'Ingeniería Civil Industrial', 4, 32),
    persona('sofia.mendez', 'Sofía Méndez', 'Ingeniería Civil Mecánica', 6, 35),
    persona('vicente.morales', 'Vicente Morales', 'Ingeniería Civil', 4, 25),
    persona('tomas.fuenzalida', 'Tomás Fuenzalida', 'Ingeniería Civil Eléctrica', 14, 50, sinEntrar),
    persona('martin.ossa', 'Martín Ossa', 'Ingeniería Civil', 4, 29, sinEntrar),
  ]
}
