import { expect, test } from '@playwright/test'
import { abrir, es, esCelular, LISTA } from './ayuda.ts'

const v = es.hoy.viaje

test.describe('Hoy durante el viaje', () => {
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
    await page.getByRole('button', { name: v.voyA('Charla en Stripe') }).click()
    await expect(page.getByRole('status').filter({ hasText: v.vasA('Charla en Stripe') })).toBeVisible()
    await expect(page.getByRole('region', { name: v.tuDia }).getByRole('button', { name: /Charla en Stripe/ })).toBeVisible()
  })
})
