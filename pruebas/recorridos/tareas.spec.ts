import { expect, test, type Page } from '@playwright/test'
import { abrir, es } from './ayuda.ts'

const t = es.tareas
// Martes 10 de noviembre de 2026: "Mandar la carta a la Escuela" venció el domingo 8, el seguro vence el viernes 13
const TAREAS = '/tareas?maqueta=lista&hoy=2026-11-10'
const MIEMBRO = '/tareas?maqueta=miembro&hoy=2026-11-10'

// El aviso de abajo, por su texto
const aviso = (page: Page, texto: string) => page.getByRole('status').filter({ hasText: texto })
// La casilla de una tarea de la lista (su nombre es el título)
const casilla = (page: Page, titulo: string) => page.getByRole('checkbox', { name: titulo, exact: true })
// El botón de "Nueva" (en el celular dice "Nueva", pero se llama "Nueva tarea" en los dos)
const nueva = (page: Page) => page.getByRole('button', { name: t.lista.nuevaTarea, exact: true }).first()

test.describe('Tareas', () => {
  test('la lista va por fecha y marcar se deshace', async ({ page }) => {
    await abrir(page, TAREAS)
    for (const grupo of Object.values(t.comun.grupos)) await expect(page.getByRole('heading', { name: grupo, exact: true })).toBeVisible()
    await casilla(page, 'Mandar la carta a la Escuela').click()
    await expect(casilla(page, 'Mandar la carta a la Escuela')).toBeChecked()
    await expect(aviso(page, t.lista.marcaste('Mandar la carta a la Escuela'))).toBeVisible()
    await aviso(page, t.lista.marcaste('Mandar la carta a la Escuela')).getByRole('button', { name: es.deshacer }).click()
    await expect(casilla(page, 'Mandar la carta a la Escuela')).not.toBeChecked()
  })

  test('"Me la tomo" la hace tuya y se deshace', async ({ page }) => {
    await abrir(page, TAREAS)
    await page.getByRole('button', { name: t.lista.meLaTomo, exact: true }).click()
    await expect(aviso(page, t.lista.tomaste('Regalos para Plug and Play'))).toBeVisible()
    await expect(casilla(page, 'Regalos para Plug and Play')).toBeVisible()
    await aviso(page, t.lista.tomaste('Regalos para Plug and Play')).getByRole('button', { name: es.deshacer }).click()
    await expect(page.getByRole('button', { name: t.lista.meLaTomo, exact: true })).toBeVisible()
  })

  test('"Mías" deja solo las tuyas', async ({ page }) => {
    await abrir(page, TAREAS)
    await page.getByRole('button', { name: t.lista.mias, exact: true }).click()
    await expect(casilla(page, 'Mandar la carta a la Escuela')).toBeVisible()
    await expect(page.getByText('Cotizar el Airbnb de Palo Alto')).toHaveCount(0)
    await expect(page.getByRole('button', { name: t.lista.meLaTomo, exact: true })).toHaveCount(0)
  })

  test('crear una tarea pide el título y avisa con "Deshacer"', async ({ page }) => {
    await abrir(page, TAREAS)
    await nueva(page).click()
    await page.getByRole('button', { name: t.nueva.crear, exact: true }).click()
    await expect(page.getByText(t.nueva.faltaTitulo)).toBeVisible()
    await page.getByRole('textbox', { name: t.nueva.queHacer }).fill('Comprar las entradas del museo')
    await page.getByRole('button', { name: t.nueva.crear, exact: true }).click()
    await expect(aviso(page, t.nueva.creaste('Comprar las entradas del museo'))).toBeVisible()
    // En el celular vuelve a la lista; en el computador queda abierta al lado
    await expect(page.getByText('Comprar las entradas del museo').first()).toBeVisible()
  })

  test('en una de "cada uno" marcas la tuya', async ({ page }) => {
    await abrir(page, '/tareas/seguro?maqueta=lista&hoy=2026-11-10')
    await expect(page.getByText(t.comun.yaLaHicieron(9, 14)).first()).toBeVisible()
    await page.getByRole('button', { name: t.detalle.marcarMia, exact: true }).click()
    await expect(aviso(page, t.detalle.marcasteMia)).toBeVisible()
    await expect(page.getByText(t.comun.yaLaHicieron(10, 14)).first()).toBeVisible()
    await expect(page.getByRole('button', { name: t.detalle.desmarcarMia, exact: true })).toBeVisible()
  })

  test('sin señal se marca (queda sin subir) y crear avisa que falta conexión', async ({ page }) => {
    await abrir(page, TAREAS)
    await page.evaluate(() => window.puenteSenal?.(false))
    await casilla(page, 'Reservar el auto').click()
    await expect(casilla(page, 'Reservar el auto')).toBeChecked()
    await expect(page.getByText(t.comun.sinSubir).first()).toBeVisible()
    // Se ve apagado, pero al tocarlo explica por qué
    await expect(nueva(page)).toHaveAttribute('aria-disabled', 'true')
    await nueva(page).click({ force: true })
    await expect(aviso(page, t.lista.sinRedNueva)).toBeVisible()
  })

  test('una tarea ajena no se puede cambiar', async ({ page }) => {
    await abrir(page, MIEMBRO.replace('/tareas?', '/tareas/airbnb?'))
    await expect(page.getByText(t.detalle.soloPuede('Diego'))).toBeVisible()
    await expect(page.getByRole('button', { name: t.detalle.editar })).toHaveCount(0)
    await expect(page.getByRole('button', { name: t.detalle.borrar })).toHaveCount(0)
  })

  test('Hoy muestra tus tareas por hacer, la atrasada primero', async ({ page }) => {
    await abrir(page, '/hoy?maqueta=lista&hoy=2026-11-10')
    await expect(page.getByRole('button', { name: /Mandar la carta a la Escuela/ })).toBeVisible()
    await expect(page.getByText(t.comun.vencio('domingo 8'))).toBeVisible()
    await page.getByRole('button', { name: /1 tarea más/ }).click()
    await expect(page).toHaveURL(/\/tareas/)
    await expect(page.getByRole('button', { name: t.lista.mias, exact: true })).toHaveAttribute('aria-pressed', 'true')
  })
})
