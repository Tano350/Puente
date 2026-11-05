import { expect, test, type Page } from '@playwright/test'
import { abrir, es, esCelular, LISTA, MIEMBRO } from './ayuda.ts'

const p = es.perfil

// Tu perfil: en el celular se llega con tu foto, arriba a la derecha de Grupo; en el computador, por la barra lateral
async function irAlPerfil(page: Page) {
  if (esCelular(page)) {
    await page.getByRole('navigation', { name: es.navegacion }).getByRole('link', { name: es.secciones.grupo }).click()
    await page.getByRole('main').getByRole('link', { name: p.titulo }).click()
  } else {
    await page.getByRole('navigation', { name: es.navegacion }).getByRole('link', { name: es.secciones.perfil }).click()
  }
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
    await expect(page.getByRole('button', { name: new RegExp(`^${p.invitados}`) })).toContainText(p.yaEntraron(12, 14))
    await page.getByRole('button', { name: new RegExp(`^${p.invitados}`) }).click()
    await expect(page.getByRole('heading', { name: es.invitados.titulo, level: 1 })).toBeVisible()
    await expect(page.getByText(es.invitados.entraron(12, 14))).toBeVisible()
  })

  test('en el celular Tu perfil tiene título, no marca Grupo y vuelve a donde estabas', async ({ page }) => {
    test.skip(!esCelular(page), 'La barra de abajo y la entrada con la foto son del celular')
    const barra = page.getByRole('navigation', { name: es.navegacion })
    const principal = page.getByRole('main')
    // Desde Grupo
    await abrir(page, LISTA)
    await barra.getByRole('link', { name: es.secciones.grupo }).click()
    await principal.getByRole('link', { name: p.titulo }).click()
    await expect(principal.getByRole('heading', { name: p.titulo, level: 1 })).toBeVisible()
    await expect(barra.getByRole('link', { name: es.secciones.grupo })).not.toHaveAttribute('aria-current', 'page')
    await principal.getByRole('button', { name: es.secciones.grupo, exact: true }).click()
    await expect(principal.getByRole('heading', { name: es.grupo.titulo, level: 1 })).toBeVisible()
    // Desde Hoy (navegación dentro de la app, para no perder la maqueta)
    await barra.getByRole('link', { name: es.secciones.hoy }).click()
    await page.evaluate(() => {
      window.history.pushState({}, '', '/perfil')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    await expect(principal.getByRole('heading', { name: p.titulo, level: 1 })).toBeVisible()
    await principal.getByRole('button', { name: es.secciones.hoy, exact: true }).click()
    await expect(page).toHaveURL(/\/hoy/)
  })

  test('sin señal, lo que necesita conexión lo dice y lo demás sigue funcionando', async ({ page }) => {
    await abrir(page, LISTA)
    await irAlPerfil(page)
    await page.evaluate(() => window.puenteSenal?.(false))
    for (const fila of [es.fechas.titulo, es.avisos.titulo, p.invitados, es.calendario.titulo]) {
      await page.getByRole('button', { name: new RegExp(`^${fila}`) }).click()
      await expect(page.getByRole('status').filter({ hasText: p.necesitaConexion })).toBeVisible()
    }
    // Idioma y Modo oscuro no necesitan señal
    await page.getByRole('button', { name: new RegExp(`^${p.idioma}`) }).click()
    // Celular: hoja con opciones; computador: menú junto a la fila
    await expect(page.getByRole(esCelular(page) ? 'radio' : 'menuitemradio', { name: 'English' })).toBeVisible()
  })

  test('invitar con nombre y compartir por WhatsApp', async ({ page }) => {
    const i = es.invitados
    await abrir(page, LISTA)
    await irAlPerfil(page)
    await page.getByRole('button', { name: new RegExp(`^${p.invitados}`) }).click()
    // Quien no ha entrado se ve con un nombre sacado del correo, no con el correo
    await expect(page.getByText('Martin Ossa').first()).toBeVisible()
    await page.getByRole('button', { name: i.invitar, exact: true }).click()
    const formulario = esCelular(page) ? page.getByRole('dialog') : page.getByRole('complementary', { name: i.invitarA })
    await formulario.getByLabel(i.nombre).fill('Valentina')
    await formulario.getByLabel(i.correo).fill('valentina.prueba@example.com')
    await formulario.getByRole('button', { name: i.invitar, exact: true }).click()
    await expect(formulario.getByRole('heading', { name: i.invitasteA('Valentina') })).toBeVisible()
    const whatsapp = formulario.getByRole('link', { name: i.compartirWhatsApp })
    const direccion = (await whatsapp.getAttribute('href')) ?? ''
    expect(direccion.startsWith('https://wa.me/?text=')).toBe(true)
    expect(decodeURIComponent(direccion.slice('https://wa.me/?text='.length))).toBe(i.mensajeWhatsApp('valentina.prueba@example.com', 'https://puente-2027.vercel.app'))
    await formulario.getByRole('button', { name: i.listo }).click()
    await expect(page.getByText('Valentina').first()).toBeVisible()
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
