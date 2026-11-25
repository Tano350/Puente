import { expect, test, type Page } from '@playwright/test'
import { abrir, anotarMovimiento, arrastrar, centroDe, deslizar, es, esCelular, LISTA, tocar } from './ayuda.ts'

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

  // B+ «Al dedo»: un toque corto se ve aunque el dedo tape lo tocado, porque al soltar tiembla
  test('un toque corto hunde lo tocado y al soltar tiembla', async ({ page }) => {
    await abrir(page, LISTA)
    const boton = page.getByRole('button', { name: /^Pendientes/ })
    const leer = await anotarMovimiento(boton)
    await tocar(page, boton, 80)
    const { menor, mayor, giro } = await leer()
    expect(menor).toBeLessThan(0.995)
    expect(mayor).toBeGreaterThan(1.005)
    expect(giro).toBeGreaterThan(0.4)
    // Y termina quieto, en su lugar (en el computador, después de sacar el mouse de encima)
    if (!esCelular(page)) await page.mouse.move(2, 2)
    await expect(boton).toHaveCSS('scale', 'none')
    await expect(boton).toHaveCSS('rotate', 'none')
  })

  test('desplazar la pantalla con el dedo encima de un botón no lo hunde', async ({ page }) => {
    test.skip(!esCelular(page), 'solo con el dedo')
    await abrir(page, LISTA)
    const boton = page.getByRole('button', { name: /^Pendientes/ })
    const antes = await centroDe(boton)
    const leer = await anotarMovimiento(boton, 600)
    // Como un dedo que desplaza: el primer movimiento llega junto con el toque (sin esperar la respuesta del
    // navegador, que con varias pruebas a la vez puede demorar más que la espera antes de hundirse)
    const cdp = await page.context().newCDPSession(page)
    const dedo = (type: 'touchStart' | 'touchMove' | 'touchEnd', y?: number) =>
      cdp.send('Input.dispatchTouchEvent', { type, touchPoints: y === undefined ? [] : [{ x: antes.x, y, id: 1 }] })
    await Promise.all([dedo('touchStart', antes.y), dedo('touchMove', antes.y - 16)])
    for (let i = 2; i <= 10; i++) {
      await dedo('touchMove', antes.y - 16 * i)
      await page.waitForTimeout(16)
    }
    await dedo('touchEnd')
    await cdp.detach()
    const { menor, giro } = await leer()
    expect(menor).toBe(1)
    expect(giro).toBe(0)
    // La pantalla sí se desplazó
    expect((await centroDe(boton)).y).toBeLessThan(antes.y - 40)
  })

  test('al pasar a otra sección, sus filas se reparten y quedan en su lugar', async ({ page }) => {
    await abrir(page, LISTA)
    const vio = await vigilarReparto(page)
    await page.getByRole('navigation', { name: es.navegacion }).getByRole('link', { name: es.secciones.tareas }).click()
    await expect.poll(vio).toBeGreaterThan(0)
    await expect.poll(() => page.evaluate(corridasAhora)).toBe(0)
  })
})

test('con «reducir movimiento» las filas no se reparten', async ({ page }) => {
  await abrir(page, LISTA)
  const vio = await vigilarReparto(page)
  await page.getByRole('navigation', { name: es.navegacion }).getByRole('link', { name: es.secciones.tareas }).click()
  await expect(page.locator('main [data-flip]').first()).toBeVisible()
  await page.waitForTimeout(800)
  expect(await vio()).toBe(0)
})

// Cuántas filas de la pantalla están corridas o giradas por el movimiento en este momento
function corridasAhora() {
  return Array.from(document.querySelectorAll<HTMLElement>('main [data-flip]')).filter((el) => el.style.translate !== '' || el.style.rotate !== '').length
}

// Mira en cada cuadro, por 6 s, cuántas filas llegaron a estar corridas a la vez (para no depender de cuándo carga la sección)
async function vigilarReparto(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { maxCorridas: number }
    w.maxCorridas = 0
    const desde = performance.now()
    const mirar = () => {
      const n = Array.from(document.querySelectorAll<HTMLElement>('main [data-flip]')).filter((el) => el.style.translate !== '' || el.style.rotate !== '').length
      w.maxCorridas = Math.max(w.maxCorridas, n)
      if (performance.now() - desde < 6000) requestAnimationFrame(mirar)
    }
    requestAnimationFrame(mirar)
  })
  return () => page.evaluate(() => (window as unknown as { maxCorridas: number }).maxCorridas)
}
