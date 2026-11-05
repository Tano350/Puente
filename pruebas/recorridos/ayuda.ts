import type { Page } from '@playwright/test'
import { es } from '../../src/textos.ts'

// Los textos de la app, para que las pruebas no los copien
export { es }

// La maqueta de desarrollo (solo existe con el servidor de desarrollo) guarda en memoria:
// cada vez que se carga la página parte de cero. ?hoy= fija el día (y las 10:15) para tener un viaje en curso.
export const LISTA = '/hoy?maqueta=lista&hoy=2027-01-12' // Josefa, administra, con datos, durante el viaje
export const MIEMBRO = '/hoy?maqueta=miembro&hoy=2027-01-12' // la misma, sin administrar
export const NUEVA = '/hoy?maqueta=nueva' // primera vez

export async function abrir(page: Page, ruta = LISTA) {
  await page.goto(ruta)
}

// Desde 1024 px la app usa la versión de computador
export const esCelular = (page: Page) => (page.viewportSize()?.width ?? 0) < 1024
