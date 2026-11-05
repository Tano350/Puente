import { expect, test, type Page } from '@playwright/test'
import { abrir, es, esCelular } from './ayuda.ts'

const g = es.gastos
const an = g.anotar
const GASTOS = '/gastos?maqueta=lista&hoy=2027-01-12'

// Un gasto de la lista, por su título
const gasto = (page: Page, titulo: string) => page.getByRole('main').getByRole('button', { name: new RegExp(`^${titulo}`) })

// El panel que se abre encima: pantalla entera en el celular, columna del lado en el computador
const panel = (page: Page, nombre: string) => (esCelular(page) ? page.getByRole('main') : page.getByRole('complementary', { name: nombre }))

async function anotar(page: Page) {
  await page.getByRole('button', { name: g.lista.anotar }).first().click()
  return panel(page, an.titulo)
}

// Desmarca a todos (parte con quienes están allá: si falta alguien, el botón dice "Todos")
async function aNadie(p: ReturnType<typeof panel>) {
  const todos = p.getByRole('button', { name: an.todos, exact: true })
  if (await todos.isVisible()) await todos.click()
  await p.getByRole('button', { name: an.ninguno, exact: true }).click()
}

// Deja marcadas solo a estas personas (por su nombre en la lista)
async function soloEntre(p: ReturnType<typeof panel>, nombres: string[]) {
  await aNadie(p)
  for (const nombre of nombres) await p.getByRole('checkbox', { name: new RegExp(`^${nombre} `) }).check({ force: true })
}

// Elige la forma de dividir en su hoja (el menú, en el computador)
async function dividir(page: Page, p: ReturnType<typeof panel>, ahora: string, forma: string) {
  await p.getByRole('button', { name: ahora, exact: true }).click()
  await page.getByRole('dialog', { name: an.comoDividir }).getByRole('button', { name: forma }).click()
}

// Una foto gris de 8×10 px, para la boleta
const FOTO = { name: 'boleta.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAKCAIAAAAGpYjXAAAAD0lEQVR4nGN4hwMwDHcJAPnu3yF5GLxcAAAAAElFTkSuQmCC', 'base64') }

test.describe('Gastos', () => {
  test('anotar un gasto en partes iguales', async ({ page }) => {
    await abrir(page, GASTOS)
    const p = await anotar(page)
    await p.getByRole('textbox', { name: an.queFue }).fill('Taxi de prueba')
    await p.getByRole('textbox', { name: an.monto }).fill('30')
    await soloEntre(p, ['Tú', 'Andrés', 'Benjamín'])
    await expect(p.getByRole('status').filter({ hasText: an.cadaUna(3, 'US$ 10,00') })).toBeVisible()
    await p.getByRole('button', { name: an.anotar }).click()
    await expect(page.getByRole('status').filter({ hasText: g.lista.anotaste('Taxi de prueba') })).toBeVisible()
    // Pagaste los 30 y prestaste los 20 de los otros dos
    await expect(gasto(page, 'Taxi de prueba')).toHaveAccessibleName(/Pagaste US\$ 30,00 prestaste US\$ 20,00/)
  })

  test('anotar con montos exactos: avisa cuánto falta por repartir', async ({ page }) => {
    await abrir(page, GASTOS)
    const p = await anotar(page)
    await p.getByRole('textbox', { name: an.queFue }).fill('Cena de prueba')
    await p.getByRole('textbox', { name: an.monto }).fill('30')
    await dividir(page, p, an.divisiones.iguales, an.formas.exactos)
    await expect(p.getByRole('button', { name: an.divisiones.exactos })).toBeVisible()
    // Solo yo: con 10 de los 30, faltan 20
    await soloEntre(p, ['Tú'])
    await p.getByRole('textbox', { name: an.tuParte }).fill('10')
    await expect(p.getByText(an.faltan('US$ 20,00'))).toBeVisible()
    // Sumo a Andrés: 25 es de más; 20 cuadra
    await p.getByRole('checkbox', { name: /^Andrés / }).check({ force: true })
    await p.getByRole('textbox', { name: an.parteDe('Andrés') }).fill('25')
    await expect(p.getByText(an.tePasaste('US$ 5,00'))).toBeVisible()
    await p.getByRole('textbox', { name: an.parteDe('Andrés') }).fill('20')
    await expect(p.getByText(an.tePasaste('US$ 5,00'))).toHaveCount(0)
    await expect(p.getByText(an.faltan('US$ 20,00'))).toHaveCount(0)
    await p.getByRole('button', { name: an.anotar }).click()
    await expect(page.getByRole('status').filter({ hasText: g.lista.anotaste('Cena de prueba') })).toBeVisible()
    await expect(gasto(page, 'Cena de prueba')).toHaveAccessibleName(/prestaste US\$ 20,00/)
  })

  test('anotar un gasto solo mío', async ({ page }) => {
    await abrir(page, GASTOS)
    const p = await anotar(page)
    await p.getByRole('textbox', { name: an.queFue }).fill('Café de prueba')
    await p.getByRole('textbox', { name: an.monto }).fill('4,50')
    await dividir(page, p, an.divisiones.iguales, an.formas.solo)
    await expect(p.getByRole('button', { name: an.divisiones.solo })).toBeVisible()
    await expect(p.getByText(an.soloTu)).toBeVisible()
    await p.getByRole('button', { name: an.anotar }).click()
    await expect(gasto(page, 'Café de prueba')).toHaveAccessibleName(new RegExp(g.lista.conmigo.solotuyo))
    await gasto(page, 'Café de prueba').click()
    await expect(panel(page, 'Café de prueba').getByText(g.detalle.soloTuyo)).toBeVisible()
  })

  test('entre quiénes: parte con quienes están allá y "Como el último"', async ({ page }) => {
    await abrir(page, GASTOS)
    const p = await anotar(page)
    await p.getByRole('textbox', { name: an.monto }).fill('40')
    // El 12 de enero están los 14; el 27, Ignacio y Vicente ya volvieron
    await expect(p.getByRole('button', { name: an.ninguno, exact: true })).toBeVisible()
    await p.getByLabel(an.fecha).fill('2027-01-27')
    await expect(p.getByRole('checkbox', { name: /^Ignacio / })).not.toBeChecked()
    await expect(p.getByRole('checkbox', { name: /^Vicente / })).not.toBeChecked()
    await expect(p.getByRole('checkbox', { name: /^Andrés / })).toBeChecked()
    // Tu último gasto compartido fue el Uber: Catalina, Diego, Martina y tú
    await p.getByRole('button', { name: an.comoElUltimo('Catalina, Diego y Martina') }).click()
    await expect(p.getByRole('status').filter({ hasText: an.cadaUna(4, 'US$ 10,00') })).toBeVisible()
    // Ya elegidos a mano, cambiar la fecha no los toca
    await p.getByLabel(an.fecha).fill('2027-01-12')
    await expect(p.getByRole('status').filter({ hasText: an.cadaUna(4, 'US$ 10,00') })).toBeVisible()
  })

  test('la foto de la boleta: tocarla la abre y la X la quita', async ({ page }) => {
    await abrir(page, GASTOS)
    const p = await anotar(page)
    await page.locator('#anotar-foto').setInputFiles(FOTO)
    await p.getByRole('button', { name: an.verFoto }).click()
    const visor = page.getByRole('dialog', { name: g.detalle.foto })
    await expect(visor.getByRole('img')).toBeVisible()
    await visor.getByRole('button', { name: es.cerrar }).click()
    await expect(visor).toHaveCount(0)
    await expect(p.getByRole('button', { name: an.verFoto })).toBeVisible()
    await p.getByRole('button', { name: an.quitarFoto }).click()
    await expect(p.getByRole('button', { name: an.fotoBoleta })).toBeVisible()
  })

  test('sin señal se edita y se elimina un gasto que todavía no sube', async ({ page }) => {
    await abrir(page, GASTOS)
    await page.evaluate(() => window.puenteSenal?.(false))
    const p = await anotar(page)
    await p.getByRole('textbox', { name: an.queFue }).fill('Peaje sin señal')
    await p.getByRole('textbox', { name: an.monto }).fill('12')
    await p.getByRole('button', { name: an.anotar }).click()
    await gasto(page, 'Peaje sin señal').click()
    await panel(page, 'Peaje sin señal').getByRole('button', { name: g.detalle.editar }).click()
    const e = panel(page, an.editar)
    await e.getByRole('textbox', { name: an.queFue }).fill('Peaje a Stanford')
    await e.getByRole('button', { name: an.guardar }).click()
    await expect(page.getByRole('status').filter({ hasText: g.lista.guardaste })).toBeVisible()
    const detalle = panel(page, 'Peaje a Stanford')
    await expect(detalle.getByRole('heading', { name: 'Peaje a Stanford' })).toBeVisible()
    await detalle.getByRole('button', { name: g.detalle.eliminar }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: g.detalle.eliminar }).click()
    await expect(page.getByRole('status').filter({ hasText: g.lista.eliminaste('Peaje a Stanford') })).toBeVisible()
    await expect(gasto(page, 'Peaje a Stanford')).toHaveCount(0)
    // Uno que ya subió sigue pidiendo conexión
    await gasto(page, 'Arriendo de bicicletas').click()
    const editar = panel(page, 'Arriendo de bicicletas').getByRole('button', { name: g.detalle.editar })
    await expect(editar).toHaveAttribute('aria-disabled', 'true')
    await editar.click({ force: true })
    await expect(page.getByText(g.detalle.necesitasConexion)).toBeVisible()
  })

  test('sin señal, corregir un gasto que no sube deja su foto, y quitarla la saca de la espera', async ({ page }) => {
    await abrir(page, GASTOS)
    await page.evaluate(() => window.puenteSenal?.(false))
    const p = await anotar(page)
    await p.getByRole('textbox', { name: an.queFue }).fill('Taxi con foto')
    await p.getByRole('textbox', { name: an.monto }).fill('9')
    await page.locator('#anotar-foto').setInputFiles(FOTO)
    await p.getByRole('button', { name: an.anotar }).click()
    // Corregir el título no le quita la foto que espera
    await gasto(page, 'Taxi con foto').click()
    await panel(page, 'Taxi con foto').getByRole('button', { name: g.detalle.editar }).click()
    await panel(page, an.editar).getByRole('textbox', { name: an.queFue }).fill('Taxi al centro')
    await panel(page, an.editar).getByRole('button', { name: an.guardar }).click()
    const detalle = panel(page, 'Taxi al centro')
    await expect(detalle.getByRole('button', { name: g.detalle.verBoleta })).toBeVisible()
    // Quitarla al corregir: cuando vuelve la señal, sube el gasto y la foto no
    await detalle.getByRole('button', { name: g.detalle.editar }).click()
    await panel(page, an.editar).getByRole('button', { name: an.quitarFoto }).click()
    await panel(page, an.editar).getByRole('button', { name: an.guardar }).click()
    await expect(panel(page, 'Taxi al centro').getByText(g.detalle.sinSubir)).toBeVisible()
    await page.evaluate(() => window.puenteSenal?.(true))
    await expect(panel(page, 'Taxi al centro').getByText(g.detalle.sinSubir)).toHaveCount(0)
    await expect(panel(page, 'Taxi al centro').getByRole('button', { name: g.detalle.agregarFoto })).toBeVisible()
    await expect(panel(page, 'Taxi al centro').getByRole('button', { name: g.detalle.verBoleta })).toHaveCount(0)
  })

  test('no deja anotar sin título ni monto', async ({ page }) => {
    await abrir(page, GASTOS)
    const p = await anotar(page)
    await p.getByRole('button', { name: an.anotar }).click()
    await expect(p.getByText(an.faltaQue)).toBeVisible()
    await expect(p.getByText(an.faltaMonto)).toBeVisible()
  })

  test('detalle de un gasto', async ({ page }) => {
    await abrir(page, GASTOS)
    await gasto(page, 'Uber al Plug and Play').click()
    const p = panel(page, 'Uber al Plug and Play')
    await expect(p.getByText(g.detalle.prestaste('US$ 28,80'))).toBeVisible()
    await expect(p.getByText(g.detalle.entre(4, false))).toBeVisible()
    await expect(p.getByText(g.detalle.pagaste)).toBeVisible()
  })

  test('editar un gasto', async ({ page }) => {
    await abrir(page, GASTOS)
    await gasto(page, 'Arriendo de bicicletas').click()
    await panel(page, 'Arriendo de bicicletas').getByRole('button', { name: g.detalle.editar }).click()
    const p = panel(page, an.editar)
    await p.getByRole('textbox', { name: an.queFue }).fill('Bicicletas del domingo')
    await p.getByRole('button', { name: an.guardar }).click()
    await expect(page.getByRole('status').filter({ hasText: g.lista.guardaste })).toBeVisible()
    // Queda abierto el gasto, ya con el título nuevo
    await expect(panel(page, 'Bicicletas del domingo').getByRole('heading', { name: 'Bicicletas del domingo' })).toBeVisible()
  })

  test('eliminar un gasto y deshacer', async ({ page }) => {
    await abrir(page, GASTOS)
    await gasto(page, 'Arriendo de bicicletas').click()
    await panel(page, 'Arriendo de bicicletas').getByRole('button', { name: g.detalle.eliminar }).click()
    const pregunta = page.getByRole('alertdialog')
    await expect(pregunta).toContainText(g.detalle.eliminarPregunta('Arriendo de bicicletas'))
    await pregunta.getByRole('button', { name: g.detalle.eliminar }).click()
    const aviso = page.getByRole('status').filter({ hasText: g.lista.eliminaste('Arriendo de bicicletas') })
    await expect(aviso).toBeVisible()
    await expect(gasto(page, 'Arriendo de bicicletas')).toHaveCount(0)
    await aviso.getByRole('button', { name: es.deshacer }).click()
    // Vuelve el gasto y se abre
    await expect(panel(page, 'Arriendo de bicicletas').getByRole('heading', { name: 'Arriendo de bicicletas' })).toBeVisible()
  })

  test('saldos: quién debe a quién', async ({ page }) => {
    await abrir(page, GASTOS)
    if (esCelular(page)) await page.getByRole('tab', { name: g.pestanas.saldos }).click()
    await expect(page.getByRole('heading', { name: g.saldos.titulo })).toBeVisible()
    // Sobre el monto va la palabra ("debes"), no un signo
    await expect(page.getByText(g.saldos.debesCorto, { exact: true })).toBeVisible()
    await expect(page.getByText(g.saldos.leDeben, { exact: true }).first()).toBeVisible()
    if (esCelular(page)) {
      await expect(page.getByRole('heading', { name: g.saldos.comoSaldar })).toBeVisible()
      await expect(page.getByText(g.saldos.menosTransferencias)).toBeVisible()
    }
  })

  test('saldar: marcar que pagué y deshacer', async ({ page }) => {
    await abrir(page, GASTOS)
    await expect(page.getByText(g.saldos.debes, { exact: true }).first()).toBeVisible()
    await page.getByRole('button', { name: g.saldos.saldar }).first().click()
    const hoja = page.getByRole(esCelular(page) ? 'dialog' : 'complementary', { name: g.saldos.saldar })
    await expect(hoja.getByText(g.saldos.lePagas('Martina'))).toBeVisible()
    await hoja.getByRole('button', { name: g.saldos.marcarPagado }).click()
    const aviso = page.getByRole('status').filter({ hasText: g.saldos.pagaste('Martina') })
    await expect(aviso).toBeVisible()
    await expect(page.getByText(g.saldos.alDia).first()).toBeVisible()
    await aviso.getByRole('button', { name: es.deshacer }).click()
    await expect(page.getByText(g.saldos.debes, { exact: true }).first()).toBeVisible()
  })

  test('rendición: marcar y desmarcar gastos', async ({ page }) => {
    await abrir(page, GASTOS)
    if (esCelular(page)) await page.getByRole('tab', { name: g.pestanas.rendicion }).click()
    else await page.getByRole('button', { name: g.rendicion.prepararRendicion }).click()
    const cafe = page.getByRole('checkbox', { name: /Café con Laura Chen/ })
    await expect(cafe).toHaveAttribute('aria-checked', 'true')
    // El café es solo tuyo: no hay una parte que explicar
    await expect(page.getByText(g.rendicion.cuantos(1, false), { exact: true })).toBeVisible()
    await cafe.click()
    await expect(cafe).toHaveAttribute('aria-checked', 'false')
    await expect(page.getByText(g.rendicion.marca)).toBeVisible()
    const uber = page.getByRole('checkbox', { name: /Uber al Plug and Play/ })
    await uber.click()
    await expect(uber).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByText(g.rendicion.cuantos(1))).toBeVisible()
  })
})
