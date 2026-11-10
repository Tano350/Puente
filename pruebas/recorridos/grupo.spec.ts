import { expect, test } from '@playwright/test'
import { abrir, es, esCelular } from './ayuda.ts'

const GRUPO = '/grupo?maqueta=lista&hoy=2027-01-12'
const g = es.grupo

test.describe('Grupo', () => {
  test('ver quiénes están allá hoy', async ({ page }) => {
    await abrir(page, GRUPO)
    await expect(page.getByRole('heading', { name: g.titulo, level: 1 })).toBeVisible()
    await expect(page.getByText(g.hayAlla(12, 14))).toBeVisible()
    // En el computador, cuántos hay cada día; en el celular, la estadía de cada uno como una barra con su nombre
    if (esCelular(page)) await expect(page.getByRole('list', { name: g.estadias })).toBeVisible()
    else await expect(page.getByRole('img', { name: g.grafico })).toBeVisible()
  })

  test('en el celular van tú primero y después por llegada, cada uno con sus fechas', async ({ page }) => {
    test.skip(!esCelular(page), 'Las barras con nombre son del celular')
    await abrir(page, GRUPO)
    const filas = page.getByRole('list', { name: g.estadias }).getByRole('button')
    // Los 12 con fechas; Martín y Tomás todavía no entran y van aparte, sin barra
    await expect(filas).toHaveCount(12)
    await expect(filas.first()).toHaveAccessibleName(g.fila(g.tu, g.alla, 'Del 5 al 30 de enero'))
    await expect(filas.nth(1)).toHaveAccessibleName(g.fila('Diego Larraín', g.alla, 'Del 3 de enero al 6 de febrero'))
    await expect(filas.last()).toHaveAccessibleName(g.fila('Florencia Díaz', g.alla, 'Del 10 de enero al 7 de febrero'))
    // Toda la fila se toca; la tuya abre Tu perfil
    await filas.first().click()
    await expect(page.getByRole('main').getByRole('heading', { name: es.perfil.titulo, level: 1 })).toBeVisible()
  })

  test('abrir a una persona', async ({ page }) => {
    await abrir(page, GRUPO)
    const principal = page.getByRole('main')
    // En el computador se puede buscar; en el celular los 14 están a la vista
    if (!esCelular(page)) {
      await principal.getByRole('searchbox', { name: es.buscar }).fill('cata')
      await expect(principal.getByRole('button', { name: /Benjamín/ })).toHaveCount(0)
    }
    await principal.getByRole('button', { name: /Catalina/ }).first().click()
    // Su tarjeta: en el celular ocupa la pantalla; en el computador va al lado
    const tarjeta = esCelular(page) ? principal : page.getByRole('complementary', { name: 'Catalina Pérez' })
    await expect(tarjeta.getByText('Catalina Pérez')).toBeVisible()
    await expect(tarjeta.getByText('Aula Viva')).toBeVisible()
    await expect(tarjeta.getByText(es.persona.emprendimiento)).toBeVisible()
    await expect(tarjeta.getByText(es.persona.estadia)).toBeVisible()
    await expect(tarjeta.getByText(es.persona.coinciden('5 al 30 de enero'))).toBeVisible()
    if (esCelular(page)) {
      await principal.getByRole('button', { name: g.titulo }).click()
      await expect(principal.getByRole('list', { name: g.estadias })).toBeVisible()
    }
  })

  test('quien no ha entrado sale con un nombre legible y "Sin entrar"', async ({ page }) => {
    await abrir(page, GRUPO)
    const principal = page.getByRole('main')
    // El primer nombre, sacado del correo; en el celular va al final, sin barra
    await expect(principal.getByText('Martin', { exact: true })).toBeVisible()
    await expect(principal.getByText('martin.ossa')).toHaveCount(0)
    await expect(principal.getByText(g.sinEntrar, { exact: true }).first()).toBeVisible()
  })

  test('la línea del viaje marca hoy', async ({ page }) => {
    await abrir(page, GRUPO)
    await expect(page.getByRole('main').getByText(g.hoyRaya, { exact: true })).toBeVisible()
  })

  test('buscar a alguien que no está', async ({ page }) => {
    test.skip(esCelular(page), 'En el celular no hay buscador: los 14 están a la vista')
    await abrir(page, GRUPO)
    await page.getByRole('main').getByRole('searchbox', { name: es.buscar }).fill('zzzz')
    await expect(page.getByText(es.nadieCoincide('zzzz'))).toBeVisible()
  })
})
