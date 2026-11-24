import { expect, test } from '@playwright/test'
import { abrir, arrastrar, centroDe, es, esCelular, LISTA } from './ayuda.ts'

const v = es.hoy.viaje

test.describe('Hoy durante el viaje', () => {
  test.describe('la tuerca grande', () => {
    // Con movimiento de verdad: suelta, sigue girando y se asienta en un lado de la tuerca
    test.use({ reducedMotion: 'no-preference' })
    test('se gira con el dedo o el mouse y se asienta en un múltiplo de 60°', async ({ page }) => {
      await abrir(page, LISTA)
      const tuerca = page.locator('[data-arrastrable]').filter({ has: page.locator('svg') }).first()
      await expect(tuerca).toBeVisible()
      const c = await centroDe(tuerca)
      await arrastrar(page, { x: c.x + 36, y: c.y }, { x: c.x, y: c.y + 36 })
      const giro = () => tuerca.locator('svg').evaluate((el) => Number.parseFloat(getComputedStyle(el).rotate) || 0)
      // Quieta: dos lecturas seguidas iguales
      await expect
        .poll(async () => {
          const a = await giro()
          await page.waitForTimeout(250)
          return Math.abs((await giro()) - a) < 0.001
        })
        .toBe(true)
      const grados = await giro()
      expect(grados).not.toBe(0)
      expect(Math.abs(grados / 60 - Math.round(grados / 60))).toBeLessThan(0.01)
      // La cuenta de adentro sigue derecha
      await expect(tuerca.getByText(es.hoy.diaDelViaje(1)[0], { exact: true })).toBeVisible()
    })
  })

  test('la línea del día va en orden y marca la hora de ahora', async ({ page }) => {
    await abrir(page, LISTA)
    await expect(page.getByRole('heading', { name: es.hoy.titulo, level: 1 })).toBeVisible()
    await expect(page.getByText('Martes 12 de enero').first()).toBeVisible()
    await expect(page.getByText('Día', { exact: true })).toBeVisible()
    const dia = page.getByRole('region', { name: v.tuDia })
    // Los cinco eventos de Josefa, con la marca "ahora" (10:15) entre el café y Plug and Play
    await expect(dia.getByRole('listitem')).toContainText(['09:00', '10:15', '10:30', '13:00', '16:00'])
    await expect(dia.getByRole('listitem').filter({ hasText: v.ahora })).toContainText('10:15')
    // En el celular, lo próximo viene abierto y dice cuánto falta
    if (esCelular(page)) await expect(dia.getByRole('listitem').nth(2)).toContainText(v.empiezaEn(v.minutos(15)))
    // También están los del grupo a los que todavía no va
    const grupo = page.getByRole('region', { name: v.tambienHoy })
    await expect(grupo.getByRole('button', { name: /^Charla en Stripe/ })).toBeVisible()
  })

  test('ir a un evento desde la línea del día', async ({ page }) => {
    await abrir(page, LISTA)
    await page.getByRole('region', { name: v.tuDia }).getByRole('button', { name: /Plug and Play/ }).click()
    const boleto = page.getByRole('main')
    await expect(boleto.getByRole('heading', { name: 'Plug and Play' })).toBeVisible()
    await expect(boleto.getByText(es.agenda.evento.tienesCupo)).toBeVisible()
    await expect(boleto.getByRole('link', { name: es.agenda.evento.comoLlegar })).toBeVisible()
    if (esCelular(page)) {
      // El evento abierto desde Hoy vuelve a Hoy
      await boleto.getByRole('button', { name: es.hoy.titulo }).click()
      await expect(page.getByRole('region', { name: v.tuDia })).toBeVisible()
    }
  })

  test('sumarse a un evento del grupo desde Hoy', async ({ page }) => {
    await abrir(page, LISTA)
    // Las mismas palabras que la Agenda: "Tomar cupo" en lo que tiene cupos, "Voy" en lo que es para todos
    await expect(page.getByRole('button', { name: v.voyA('Cena con exalumnos UC') })).toHaveText(v.voy)
    await page.getByRole('button', { name: v.tomarCupoEn('Charla en Stripe') }).click()
    await expect(page.getByRole('status').filter({ hasText: v.tomaste })).toBeVisible()
    await expect(page.getByRole('region', { name: v.tuDia }).getByRole('button', { name: /Charla en Stripe/ })).toBeVisible()
  })

  test('lo que está en curso se ve como la próxima parada', async ({ page }) => {
    // El 16 de enero a las 10:15, el paseo de 10:00 a 16:00 sigue y no viene nada más
    await abrir(page, '/hoy?maqueta=lista&hoy=2027-01-16')
    const dia = page.getByRole('region', { name: v.tuDia })
    await expect(dia.getByRole('listitem')).toContainText(['10:00', '10:15'])
    if (esCelular(page)) {
      await expect(dia.getByRole('listitem').first()).toContainText(v.enCursoHasta('16:00'))
      await expect(dia.getByRole('link', { name: v.comoLlegar })).toBeVisible()
    }
  })
})
