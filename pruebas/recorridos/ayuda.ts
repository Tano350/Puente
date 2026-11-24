import type { Locator, Page } from '@playwright/test'
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

// ---------- Gestos de verdad (src/movimiento/gesto.ts) ----------
// En el celular con toques reales (CDP: touchStart, touchMove, touchEnd), en el computador con el mouse.

export type Punto = { x: number; y: number }

export async function centroDe(elemento: Locator): Promise<Punto> {
  const caja = await elemento.boundingBox()
  if (!caja) throw new Error('El elemento no se ve')
  return { x: caja.x + caja.width / 2, y: caja.y + caja.height / 2 }
}

// Arrastra de un punto a otro. mantener: en el celular, ms con el dedo quieto antes de mover (para levantar algo
// de una lista; con el mouse no hace falta)
export async function arrastrar(page: Page, desde: Punto, hasta: Punto, { mantener = 0, pasos = 14 }: { mantener?: number; pasos?: number } = {}) {
  const punto = (i: number) => ({ x: desde.x + ((hasta.x - desde.x) * i) / pasos, y: desde.y + ((hasta.y - desde.y) * i) / pasos })
  if (esCelular(page)) {
    const cdp = await page.context().newCDPSession(page)
    const tocar = (type: 'touchStart' | 'touchMove' | 'touchEnd', p?: Punto) =>
      cdp.send('Input.dispatchTouchEvent', { type, touchPoints: p ? [{ x: p.x, y: p.y, id: 1 }] : [] })
    await tocar('touchStart', desde)
    if (mantener) await page.waitForTimeout(mantener)
    for (let i = 1; i <= pasos; i++) {
      await tocar('touchMove', punto(i))
      await page.waitForTimeout(16)
    }
    await tocar('touchEnd')
    await cdp.detach()
    return
  }
  await page.mouse.move(desde.x, desde.y)
  await page.mouse.down()
  for (let i = 1; i <= pasos; i++) {
    const p = punto(i)
    await page.mouse.move(p.x, p.y)
    await page.waitForTimeout(16)
  }
  await page.mouse.up()
}

// Mantiene apretado un elemento (en el celular) y lo lleva hasta otro elemento o punto
export async function llevar(page: Page, elemento: Locator, hasta: Locator | Punto) {
  const destino = 'x' in hasta ? hasta : await centroDe(hasta)
  await arrastrar(page, await centroDe(elemento), destino, { mantener: 420 })
}

// Desliza un elemento hacia el lado (positivo: a la derecha), desde un cuarto de su ancho
export async function deslizar(page: Page, elemento: Locator, dx: number) {
  const caja = await elemento.boundingBox()
  if (!caja) throw new Error('El elemento no se ve')
  const desde = { x: caja.x + caja.width * (dx > 0 ? 0.25 : 0.75), y: caja.y + caja.height / 2 }
  await arrastrar(page, desde, { x: desde.x + dx, y: desde.y + 4 }, { pasos: 10 })
}
