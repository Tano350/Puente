import { expect, test, type Page } from '@playwright/test'
import { abrir, es, esCelular, LISTA, MIEMBRO } from './ayuda.ts'

const p = es.perfil

// Tu perfil: en el celular se llega desde Grupo (tocando "Tú"); en el computador, por la barra lateral
async function irAlPerfil(page: Page) {
  if (esCelular(page)) {
    await page.getByRole('navigation', { name: es.navegacion }).getByRole('link', { name: es.secciones.grupo }).click()
    await page.getByRole('main').getByRole('button', { name: /^Tú / }).click()
  } else {
    await page.getByRole('navigation', { name: es.navegacion }).getByRole('link', { name: es.secciones.perfil }).click()
  }
  // El celular no lleva título en esta pantalla: se sabe que llegó por sus filas
  await expect(page.getByRole('button', { name: new RegExp(`^${es.fechas.titulo}`) })).toBeVisible()
}

test.describe('Tu perfil', () => {
  test('editar el perfil', async ({ page }) => {
    await abrir(page, LISTA)
    await irAlPerfil(page)
    await page.getByRole('button', { name: p.editarCorto, exact: true }).click()
    await page.getByRole('textbox', { name: p.emprendimiento }).first().fill('Agua Limpia')
    await page.getByRole('textbox', { name: p.objetivos }).fill('Conocer inversionistas.')
    await page.getByRole('button', { name: es.guardar }).click()
    await expect(page.getByRole('status').filter({ hasText: p.guardado })).toBeVisible()
    // Al abrir de nuevo el perfil, quedó lo que escribí
    await page.getByRole('button', { name: p.editarCorto, exact: true }).click()
    await expect(page.getByRole('textbox', { name: p.emprendimiento }).first()).toHaveValue('Agua Limpia')
    await expect(page.getByRole('textbox', { name: p.objetivos })).toHaveValue('Conocer inversionistas.')
  })

  test('cambiar las fechas de estadía', async ({ page }) => {
    await abrir(page, LISTA)
    await irAlPerfil(page)
    await page.getByRole('button', { name: new RegExp(`^${es.fechas.titulo}`) }).click()
    await page.getByLabel(es.fechas.vuelves).fill('2027-01-28')
    await page.getByRole('button', { name: es.guardar }).click()
    await expect(page.getByRole('status').filter({ hasText: es.fechas.guardado })).toBeVisible()
    await expect(page.getByRole('button', { name: new RegExp(`^${es.fechas.titulo}`) })).toContainText('5 ene – 28 ene')
  })

  test('quien administra ve Invitados y puede abrirlos', async ({ page }) => {
    await abrir(page, LISTA)
    await irAlPerfil(page)
    await page.getByRole('button', { name: new RegExp(`^${p.invitados}`) }).click()
    await expect(page.getByRole('heading', { name: es.invitados.titulo, level: 1 })).toBeVisible()
    await expect(page.getByText(es.invitados.entraron(12, 14))).toBeVisible()
  })

  test('quien no administra no ve Invitados ni entra por la dirección', async ({ page }) => {
    await abrir(page, MIEMBRO)
    await irAlPerfil(page)
    await expect(page.getByRole('button', { name: new RegExp(`^${p.invitados}`) })).toHaveCount(0)
    // Por la dirección tampoco: vuelve a Tu perfil (navegación dentro de la app, para no perder la maqueta)
    await page.evaluate(() => {
      window.history.pushState({}, '', '/perfil/invitados')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    await expect(page).toHaveURL(/\/perfil$/)
    await expect(page.getByRole('heading', { name: es.invitados.titulo, level: 1 })).toHaveCount(0)
    await expect(page.getByRole('button', { name: new RegExp(`^${es.fechas.titulo}`) })).toBeVisible()
  })
})
