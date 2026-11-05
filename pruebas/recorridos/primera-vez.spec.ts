import { expect, test } from '@playwright/test'
import { abrir, es, NUEVA } from './ayuda.ts'

const pv = es.primeraVez

test.describe('Primera vez', () => {
  test('completar perfil y fechas, y entrar a Hoy', async ({ page }) => {
    await abrir(page, NUEVA)
    await expect(page.getByRole('heading', { name: pv.hola('Josefa') })).toBeVisible()
    await expect(page.getByText(pv.faltan(5, 5))).toBeVisible()
    // Sin perfil ni fechas no se puede entrar
    const entrar = page.getByRole('button', { name: pv.irAHoy })
    await expect(entrar).toBeDisabled()
    await expect(page.getByText(pv.primeroPerfil)).toBeVisible()

    // Tu perfil
    await page.getByRole('button', { name: new RegExp(`^${pv.tareas.perfil}`) }).click()
    await page.getByRole('combobox', { name: es.perfil.carrera }).fill('Ingeniería Civil Industrial')
    await page.getByRole('button', { name: es.guardar }).click()
    await expect(page.getByText(pv.faltan(4, 5))).toBeVisible()
    await expect(page.getByRole('button', { name: new RegExp(`^${pv.tareas.perfil}`) })).toContainText(pv.hecho)
    await expect(page.getByText(pv.primeroFechas)).toBeVisible()
    await expect(entrar).toBeDisabled()

    // Tus fechas
    await page.getByRole('button', { name: new RegExp(`^${pv.tareas.fechas}`) }).click()
    await page.getByLabel(es.fechas.llegas).fill('2027-01-05')
    await page.getByLabel(es.fechas.vuelves).fill('2027-01-30')
    await page.getByRole('button', { name: es.guardar }).click()
    await expect(page.getByText(pv.faltan(3, 5))).toBeVisible()
    await expect(page.getByRole('button', { name: new RegExp(`^${pv.tareas.fechas}`) })).toContainText(pv.hecho)

    // Ya se puede entrar
    await expect(entrar).toBeEnabled()
    await entrar.click()
    await expect(page.getByRole('heading', { name: es.hoy.titulo, level: 1 })).toBeVisible()
    await expect(page).toHaveURL(/\/hoy/)
  })

  test('el perfil pide nombre y carrera', async ({ page }) => {
    await abrir(page, NUEVA)
    await page.getByRole('button', { name: new RegExp(`^${pv.tareas.perfil}`) }).click()
    await page.getByRole('button', { name: es.guardar }).click()
    await expect(page.getByText(es.perfil.faltaCarrera)).toBeVisible()
  })

  test('las fechas piden llegada y vuelta, y que la vuelta sea después', async ({ page }) => {
    await abrir(page, NUEVA)
    await page.getByRole('button', { name: new RegExp(`^${pv.tareas.perfil}`) }).click()
    await page.getByRole('combobox', { name: es.perfil.carrera }).fill('Ingeniería Civil')
    await page.getByRole('button', { name: es.guardar }).click()
    await page.getByRole('button', { name: new RegExp(`^${pv.tareas.fechas}`) }).click()
    await page.getByRole('button', { name: es.guardar }).click()
    await expect(page.getByText(es.fechas.faltaLlegada)).toBeVisible()
  })
})
