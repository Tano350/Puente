import { expect, test } from '@playwright/test'
import { abrir, es, NUEVA } from './ayuda.ts'

const pv = es.primeraVez
const falta = (...partes: (keyof typeof pv.faltaParte)[]) => pv.faltanParaEntrar(partes.map((p) => pv.faltaParte[p]))

test.describe('Primera vez', () => {
  test('completar perfil y fechas, y entrar a Hoy', async ({ page }) => {
    await abrir(page, NUEVA)
    await expect(page.getByRole('heading', { name: pv.hola('Josefa') })).toBeVisible()
    // Solo cuenta lo obligatorio: sin perfil ni fechas no se puede entrar
    await expect(page.getByText(falta('perfil', 'fechas'))).toBeVisible()
    const entrar = page.getByRole('button', { name: pv.irAHoy })
    await expect(entrar).toBeDisabled()

    // Tu perfil
    await page.getByRole('button', { name: new RegExp(`^${pv.tareas.perfil}`) }).click()
    await page.getByRole('radio', { name: 'Ingeniería Comercial' }).check({ force: true })
    await page.getByRole('button', { name: es.guardar }).click()
    await expect(page.getByText(falta('fechas'))).toBeVisible()
    await expect(page.getByRole('button', { name: new RegExp(`^${pv.tareas.perfil}`) })).toContainText(pv.hecho)
    await expect(entrar).toBeDisabled()

    // Tus fechas
    await page.getByRole('button', { name: new RegExp(`^${pv.tareas.fechas}`) }).click()
    await page.getByLabel(es.fechas.llegas).fill('2027-01-05')
    await page.getByLabel(es.fechas.vuelves).fill('2027-01-30')
    await page.getByRole('button', { name: es.guardar }).click()
    await expect(page.getByRole('heading', { name: pv.listo('Josefa') })).toBeVisible()
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
    await page.getByRole('radio', { name: 'Ingeniería Civil' }).check({ force: true })
    await page.getByRole('button', { name: es.guardar }).click()
    await page.getByRole('button', { name: new RegExp(`^${pv.tareas.fechas}`) }).click()
    await page.getByRole('button', { name: es.guardar }).click()
    await expect(page.getByText(es.fechas.faltaLlegada)).toBeVisible()
  })

  test('el calendario vacío abre en enero de 2027 y lo que se elige se guarda', async ({ page }) => {
    await abrir(page, NUEVA)
    await page.getByRole('button', { name: new RegExp(`^${pv.tareas.fechas}`) }).click()
    const llega = page.getByLabel(es.fechas.llegas)
    await llega.dispatchEvent('click')
    // El campo recibe un día de enero de 2027 como referencia para abrir ahí, pero no cambia lo que se ve
    await expect(llega).toHaveValue('2027-01-01')
    await expect(page.getByText(es.elegir).first()).toBeVisible()
    await llega.fill('2027-01-05')
    await expect(page.getByText(/5/).first()).toBeVisible()
    await expect(page.getByText(es.fechas.tituloGrafico)).toBeVisible()
  })
})
