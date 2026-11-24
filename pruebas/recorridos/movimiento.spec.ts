import { expect, test, type Page } from '@playwright/test'
import { abrir, arrastrar, deslizar, es, LISTA } from './ayuda.ts'

const v = es.hoy.viaje

// Abre la hoja de pendientes desde la ficha de Hoy y la baja con el dedo (o el mouse) desde su borde de arriba
async function bajarLaHoja(page: Page) {
  await abrir(page, LISTA)
  await page.getByRole('button', { name: /^Pendientes/ }).click()
  const hoja = page.getByRole('dialog', { name: es.hoy.pendientes })
  await expect(hoja).toBeVisible()
  // Con animaciones, la hoja sube con resorte: se toma cuando ya llegó
  await expect(hoja).toHaveCSS('translate', 'none')
  const caja = await hoja.boundingBox()
  if (!caja) throw new Error('La hoja no se ve')
  const x = caja.x + caja.width / 2
  await arrastrar(page, { x, y: caja.y + 10 }, { x, y: caja.y + 10 + caja.height * 0.6 })
  await expect(hoja).toBeHidden()
}

test.describe('Movimiento: hojas, avisos y marcas', () => {
  test('la hoja se cierra bajándola', async ({ page }) => {
    await bajarLaHoja(page)
  })

  test('una hoja bajada un poco vuelve a su lugar', async ({ page }) => {
    await abrir(page, LISTA)
    await page.getByRole('button', { name: /^Pendientes/ }).click()
    const hoja = page.getByRole('dialog', { name: es.hoy.pendientes })
    const caja = await hoja.boundingBox()
    if (!caja) throw new Error('La hoja no se ve')
    const x = caja.x + caja.width / 2
    await arrastrar(page, { x, y: caja.y + 10 }, { x, y: caja.y + 40 }, { pasos: 6 })
    await expect(hoja).toBeVisible()
  })

  test('el aviso se descarta tirándolo hacia el lado', async ({ page }) => {
    await abrir(page, LISTA)
    await page.getByRole('button', { name: v.tomarCupoEn('Charla en Stripe') }).click()
    const aviso = page.getByRole('status').filter({ hasText: v.tomaste })
    await expect(aviso).toBeVisible()
    await deslizar(page, aviso, -260)
    await expect(aviso).toBeHidden()
  })

  test('la marca de lo elegido llega a la opción elegida', async ({ page }) => {
    await abrir(page, LISTA)
    await page.getByRole('navigation', { name: es.navegacion }).getByRole('link', { name: es.secciones.tareas }).click()
    const grupo = page.getByRole('group', { name: es.tareas.lista.queVer })
    const mias = grupo.getByRole('button', { name: es.tareas.lista.mias })
    await mias.click()
    await expect(mias).toHaveAttribute('aria-pressed', 'true')
    const marca = grupo.locator('[data-pastilla]')
    await expect(async () => {
      const [a, b] = await Promise.all([marca.boundingBox(), mias.boundingBox()])
      expect(Math.abs((a?.x ?? 0) - (b?.x ?? 99))).toBeLessThan(1.5)
      expect(Math.abs((a?.width ?? 0) - (b?.width ?? 99))).toBeLessThan(1.5)
    }).toPass()
  })

  test('sonido y vibración se encienden en Tu perfil y quedan en el dispositivo', async ({ page }) => {
    await abrir(page, LISTA)
    await page.evaluate(() => {
      window.history.pushState({}, '', '/perfil')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    const sonido = page.getByRole('switch', { name: es.perfil.sonido })
    await expect(sonido).toHaveAttribute('aria-checked', 'false')
    await sonido.click()
    await expect(sonido).toHaveAttribute('aria-checked', 'true')
    expect(await page.evaluate(() => localStorage.getItem('puente.sonido'))).toBe('si')
  })
})

test.describe('Movimiento con animaciones', () => {
  test.use({ reducedMotion: 'no-preference' })

  test('la hoja baja animada y se quita', async ({ page }) => {
    await bajarLaHoja(page)
  })

  test('el aviso sale animado al tirarlo', async ({ page }) => {
    await abrir(page, LISTA)
    await page.getByRole('button', { name: v.tomarCupoEn('Charla en Stripe') }).click()
    const aviso = page.getByRole('status').filter({ hasText: v.tomaste })
    await expect(aviso).toBeVisible()
    await deslizar(page, aviso, 260)
    await expect(aviso).toBeHidden()
  })
})
