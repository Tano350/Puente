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

// Deja marcadas solo a estas personas (por su nombre en la lista)
async function soloEntre(p: ReturnType<typeof panel>, nombres: string[]) {
  await p.getByRole('button', { name: an.ninguno }).click()
  for (const nombre of nombres) await p.getByRole('checkbox', { name: new RegExp(`^${nombre} `) }).check({ force: true })
}

test.describe('Gastos', () => {
  test('anotar un gasto en partes iguales', async ({ page }) => {
    await abrir(page, GASTOS)
    const p = await anotar(page)
    await p.getByRole('textbox', { name: an.queFue }).fill('Taxi de prueba')
    await p.getByRole('textbox', { name: an.monto }).fill('30')
    await soloEntre(p, ['Tú', 'Andrés', 'Benjamín'])
    await expect(p.getByRole('status')).toContainText(an.cadaUna(3, 'US$ 10,00'))
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
    await p.getByRole('button', { name: an.divisiones.iguales }).click()
    await expect(p.getByRole('button', { name: an.divisiones.exactos })).toBeVisible()
    // Solo yo: con 10 de los 30, faltan 20
    await p.getByRole('button', { name: an.ninguno }).click()
    await p.getByRole('checkbox', { name: /^Tú / }).check({ force: true })
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
    await p.getByRole('button', { name: an.divisiones.iguales }).click()
    await p.getByRole('button', { name: an.divisiones.exactos }).click()
    await expect(p.getByText(an.soloTu)).toBeVisible()
    await p.getByRole('button', { name: an.anotar }).click()
    await expect(gasto(page, 'Café de prueba')).toHaveAccessibleName(new RegExp(g.lista.conmigo.solotuyo))
    await gasto(page, 'Café de prueba').click()
    await expect(panel(page, 'Café de prueba').getByText(g.detalle.soloTuyo)).toBeVisible()
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
    await expect(page.getByText('Tú −84,00').or(page.getByText('−84,00')).first()).toBeVisible()
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
    await expect(page.getByText(g.rendicion.cuantos(1))).toBeVisible()
    await cafe.click()
    await expect(cafe).toHaveAttribute('aria-checked', 'false')
    await expect(page.getByText(g.rendicion.marca)).toBeVisible()
    const uber = page.getByRole('checkbox', { name: /Uber al Plug and Play/ })
    await uber.click()
    await expect(uber).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByText(g.rendicion.cuantos(1))).toBeVisible()
  })
})
