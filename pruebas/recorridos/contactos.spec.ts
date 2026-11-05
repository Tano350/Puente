import { expect, test, type Page } from '@playwright/test'
import { abrir, es, esCelular } from './ayuda.ts'

const c = es.contactos
const CONTACTOS = '/contactos?maqueta=lista&hoy=2027-01-12'

// Un contacto de la lista, por su nombre
const fila = (page: Page, nombre: string) => page.getByRole('main').getByRole('button', { name: new RegExp(`^${nombre}`) })

// El detalle abierto: pantalla entera en el celular, columna del lado en el computador
const detalle = (page: Page) => (esCelular(page) ? page.getByRole('main') : page.getByRole('complementary'))

test.describe('Contactos', () => {
  test('buscar por nombre u organización', async ({ page }) => {
    await abrir(page, CONTACTOS)
    const buscador = page.getByRole('searchbox', { name: es.buscar })
    await buscador.fill('stripe')
    await expect(fila(page, 'Camila Reyes')).toBeVisible()
    await expect(fila(page, 'Ana Rojas')).toBeVisible()
    await expect(fila(page, 'Kevin Park')).toHaveCount(0)
    await buscador.fill('zzzz')
    await expect(page.getByText(c.lista.ningunoCoincide('zzzz'))).toBeVisible()
    await page.getByLabel(es.borrarBusqueda).click()
    await expect(fila(page, 'Kevin Park')).toBeVisible()
  })

  test('filtrar por estado y limpiar', async ({ page }) => {
    await abrir(page, CONTACTOS)
    if (esCelular(page)) {
      await page.getByRole('button', { name: c.lista.filtrar, exact: true }).click()
      const hoja = page.getByRole('dialog', { name: c.lista.filtrarContactos })
      await hoja.getByRole('button', { name: c.etapas.respondio }).click()
      await hoja.getByRole('button', { name: c.lista.ver(2) }).click()
    } else {
      await page.getByRole('button', { name: c.lista.estado }).click()
      await page.getByRole('group', { name: c.lista.estado }).getByRole('button', { name: c.etapas.respondio }).click()
    }
    await expect(fila(page, 'Felipe Araya')).toBeVisible()
    await expect(fila(page, 'Valentina Ortiz')).toBeVisible()
    await expect(fila(page, 'Kevin Park')).toHaveCount(0)
    if (esCelular(page)) {
      await page.getByRole('button', { name: c.lista.filtrar }).click()
      await page.getByRole('dialog', { name: c.lista.filtrarContactos }).getByRole('button', { name: c.lista.limpiar }).click()
      await page.getByRole('dialog', { name: c.lista.filtrarContactos }).getByRole('button', { name: /^Ver / }).click()
    } else {
      // El menú sigue abierto después de elegir
      await page.getByRole('group', { name: c.lista.estado }).getByRole('button', { name: c.lista.limpiar }).click()
    }
    await expect(fila(page, 'Kevin Park')).toBeVisible()
  })

  test('"Míos" muestra solo los contactos a mi cargo', async ({ page }) => {
    await abrir(page, CONTACTOS)
    await page.getByRole('group', { name: c.lista.queVer }).getByRole('button', { name: c.lista.mios }).click()
    await expect(fila(page, 'Matías Lagos')).toBeVisible()
    await expect(fila(page, 'Kevin Park')).toHaveCount(0)
  })

  test('agregar un contacto', async ({ page }) => {
    await abrir(page, CONTACTOS)
    await page.getByRole('button', { name: c.lista.nuevoContacto }).click()
    const d = detalle(page)
    await d.getByLabel(c.nuevo.organizacion).fill('Empresa de prueba')
    await d.getByLabel(c.nuevo.nombre, { exact: true }).fill('Persona de Prueba')
    await d.getByRole('group', { name: c.nuevo.canal }).getByRole('button', { name: c.canales.correo }).click()
    await d.getByLabel(c.canales.correo, { exact: true }).last().fill('prueba@example.com')
    await d.getByRole('button', { name: c.nuevo.agregar }).click()
    await expect(page.getByRole('status').filter({ hasText: c.lista.agregaste('Persona de Prueba') })).toBeVisible()
    await expect(fila(page, 'Persona de Prueba')).toBeVisible()
  })

  test('cambiar el estado de un contacto', async ({ page }) => {
    await abrir(page, CONTACTOS)
    await fila(page, 'Rodrigo Pérez').click()
    const d = detalle(page)
    await d.getByRole('button', { name: c.detalle.marcarRespondio }).click()
    await expect(page.getByRole('status').filter({ hasText: c.paso('Rodrigo', c.etapas.respondio) })).toBeVisible()
    await expect(d.getByRole('group', { name: c.detalle.estado }).getByRole('button', { name: c.etapas.respondio })).toHaveAttribute('aria-current', 'step')
    // Ahora el paso siguiente es agendar la reunión
    await expect(d.getByRole('button', { name: c.detalle.agendarReunion })).toBeVisible()
  })

  test('escribir una nota', async ({ page }) => {
    await abrir(page, CONTACTOS)
    await fila(page, 'Felipe Araya').click()
    const d = detalle(page)
    await d.getByRole('button', { name: c.detalle.agregarNota }).click()
    await d.getByLabel(c.detalle.notaNueva).fill('Quedamos en escribirle el lunes.')
    await d.getByRole('button', { name: c.detalle.guardarNota }).click()
    await expect(page.getByRole('status').filter({ hasText: c.detalle.agregasteNota })).toBeVisible()
    await expect(d.getByText('Quedamos en escribirle el lunes.')).toBeVisible()
  })

  test('agendar una reunión desde un contacto', async ({ page }) => {
    await abrir(page, CONTACTOS)
    await fila(page, 'Felipe Araya').click()
    await detalle(page).getByRole('button', { name: c.detalle.agendarReunion }).click()
    // El evento nuevo ya trae el nombre y avisa a qué estado pasa el contacto
    const nuevo = esCelular(page) ? page.getByRole('main') : page.getByRole('complementary')
    await expect(nuevo.getByLabel(es.agenda.crear.nombreEvento)).toHaveValue(es.agenda.crear.reunionCon('Felipe Araya'))
    await expect(nuevo.getByText(es.agenda.crear.pasara('Felipe Araya', c.etapas.reunion_agendada))).toBeVisible()
    await nuevo.getByLabel(es.agenda.crear.dia, { exact: true }).fill('2027-01-14')
    await nuevo.getByLabel(es.agenda.crear.empieza).fill('11:00')
    await nuevo.getByLabel(es.agenda.crear.termina).fill('12:00')
    await nuevo.getByRole('button', { name: es.agenda.crear.crearEvento }).click()
    await expect(page.getByRole('status').filter({ hasText: es.agenda.vista.creaste(es.agenda.crear.reunionCon('Felipe Araya')) })).toBeVisible()
    // El contacto quedó con la reunión agendada
    await page.getByRole('navigation', { name: es.navegacion }).getByRole('link', { name: es.secciones.contactos }).click()
    await fila(page, 'Felipe Araya').click()
    await expect(detalle(page).getByRole('group', { name: c.detalle.estado }).getByRole('button', { name: new RegExp(c.etapas.reunion_agendada) })).toHaveAttribute('aria-current', 'step')
  })
})
