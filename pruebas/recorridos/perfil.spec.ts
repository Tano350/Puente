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

  test('el modo oscuro va por defecto y se cambia con su interruptor', async ({ page }) => {
    const raiz = page.locator('html')
    const fondo = page.locator('body')
    // Aunque el dispositivo esté en claro, Puente parte en oscuro
    await page.emulateMedia({ colorScheme: 'light' })
    await abrir(page, LISTA)
    await expect(fondo).toHaveCSS('background-color', 'rgb(30, 36, 44)')
    await irAlPerfil(page)
    const interruptor = page.getByRole('switch', { name: p.modoOscuro })
    await expect(interruptor).toHaveAttribute('aria-checked', 'true')
    await interruptor.click()
    await expect(interruptor).toHaveAttribute('aria-checked', 'false')
    await expect(raiz).toHaveAttribute('data-tema', 'claro')
    await expect(fondo).toHaveCSS('background-color', 'rgb(238, 241, 244)')
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#EEF1F4')
    // Este dispositivo lo recuerda: al volver a abrir Puente sigue en claro, aunque el dispositivo pase a oscuro
    await page.emulateMedia({ colorScheme: 'dark' })
    await abrir(page, LISTA)
    await expect(raiz).toHaveAttribute('data-tema', 'claro')
    await expect(fondo).toHaveCSS('background-color', 'rgb(238, 241, 244)')
    await irAlPerfil(page)
    await page.getByRole('switch', { name: p.modoOscuro }).click()
    await expect(raiz).toHaveAttribute('data-tema', 'oscuro')
    await expect(fondo).toHaveCSS('background-color', 'rgb(30, 36, 44)')
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#1E242C')
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
