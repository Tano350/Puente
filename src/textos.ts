// Textos de la app. Cada idioma usa las mismas claves.
const es = {
  navegacion: 'Secciones',
  secciones: {
    hoy: 'Hoy',
    agenda: 'Agenda',
    contactos: 'Contactos',
    gastos: 'Gastos',
    grupo: 'Grupo',
    perfil: 'Perfil',
  },
}

export type Textos = typeof es

export function useTextos(): Textos {
  return es
}
