import { expect, test } from '@playwright/test'
import { abrir, es, esCelular } from './ayuda.ts'

const GRUPO = '/grupo?maqueta=lista&hoy=2027-01-12'

test.describe('Grupo', () => {
  test('ver quiénes están allá hoy', async ({ page }) => {
    await abrir(page, GRUPO)
    await expect(page.getByRole('heading', { name: es.grupo.titulo, level: 1 })).toBeVisible()
    await expect(page.getByText(es.grupo.hayAlla(12, 14))).toBeVisible()
    await expect(page.getByRole('img', { name: es.grupo.grafico })).toBeVisible()
  })

  test('buscar y abrir a una persona', async ({ page }) => {
    await abrir(page, GRUPO)
    const principal = page.getByRole('main')
    await principal.getByRole('searchbox', { name: es.buscar }).fill('cata')
    await expect(principal.getByRole('button', { name: /Catalina/ }).first()).toBeVisible()
    await expect(principal.getByRole('button', { name: /Benjamín/ })).toHaveCount(0)
    await principal.getByRole('button', { name: /Catalina/ }).first().click()
    // Su tarjeta: en el celular ocupa la pantalla; en el computador va al lado
    const tarjeta = esCelular(page) ? principal : page.getByRole('complementary', { name: 'Catalina Pérez' })
    await expect(tarjeta.getByText('Catalina Pérez')).toBeVisible()
    await expect(tarjeta.getByText('Aula Viva')).toBeVisible()
    await expect(tarjeta.getByText(es.persona.emprendimiento)).toBeVisible()
    await expect(tarjeta.getByText(es.persona.estadia)).toBeVisible()
    await expect(tarjeta.getByText(es.persona.coinciden('5 al 30 de enero'))).toBeVisible()
    if (esCelular(page)) {
      await principal.getByRole('button', { name: es.grupo.titulo }).click()
      await expect(principal.getByRole('searchbox', { name: es.buscar })).toBeVisible()
    }
  })

  test('quien no ha entrado sale con un nombre legible y "Sin entrar"', async ({ page }) => {
    await abrir(page, GRUPO)
    const principal = page.getByRole('main')
    // En la lista del celular sale el nombre entero; en la línea del viaje (también en el computador), el primero
    await expect(principal.getByText(esCelular(page) ? 'Martin Ossa' : 'Martin', { exact: true })).toBeVisible()
    await expect(principal.getByText('martin.ossa')).toHaveCount(0)
    await expect(principal.getByText(es.grupo.sinEntrar).first()).toBeVisible()
  })

  test('la línea del viaje marca hoy', async ({ page }) => {
    await abrir(page, GRUPO)
    await expect(page.getByRole('main').getByText(es.grupo.hoyRaya, { exact: true })).toBeVisible()
  })

  test('buscar a alguien que no está', async ({ page }) => {
    await abrir(page, GRUPO)
    await page.getByRole('main').getByRole('searchbox', { name: es.buscar }).fill('zzzz')
    await expect(page.getByText(es.nadieCoincide('zzzz'))).toBeVisible()
  })
})
