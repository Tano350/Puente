import { expect, test, type Page } from '@playwright/test'
import { abrir, arrastrar, centroDe, es, esCelular, llevar } from './ayuda.ts'

const c = es.contactos
const CONTACTOS = '/contactos?maqueta=lista&hoy=2027-01-12'
// La misma Josefa, sin administrar: solo puede cambiar sus contactos
const CONTACTOS_MIEMBRO = '/contactos?maqueta=miembro&hoy=2027-01-12'

// Un contacto de la lista, por su nombre
const fila = (page: Page, nombre: string) => page.getByRole('main').getByRole('button', { name: new RegExp(`^${nombre}`) })

// El detalle abierto: pantalla entera en el celular, columna del lado en el computador
const detalle = (page: Page) => (esCelular(page) ? page.getByRole('main') : page.getByRole('complementary'))

// Un estado de la lista (celular) o una columna del tablero (computador), por su nombre
const estado = (page: Page, nombre: string) => page.getByRole('main').locator('section').filter({ has: page.getByRole('heading', { name: new RegExp(`^${nombre}`) }) })

// La línea de etapas del detalle
const linea = (page: Page) => detalle(page).getByRole('group', { name: c.detalle.estado })

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
    await expect(nuevo.getByRole('heading', { name: es.agenda.crear.tituloReunion })).toBeVisible()
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

  test('llevar un contacto a otro estado y deshacerlo', async ({ page }) => {
    await abrir(page, CONTACTOS)
    // En el celular se mantiene apretado y se lleva; en el computador se arrastra con el mouse
    await llevar(page, fila(page, 'Rodrigo Pérez'), fila(page, 'Kevin Park'))
    await expect(page.getByRole('status').filter({ hasText: c.paso('Rodrigo', c.etapas.por_contactar) })).toBeVisible()
    await expect(estado(page, c.etapas.por_contactar).getByRole('button', { name: /^Rodrigo Pérez/ })).toBeVisible()
    await expect(estado(page, c.etapas.contactado).getByRole('button', { name: /^Rodrigo Pérez/ })).toHaveCount(0)
    await page.getByRole('status').getByRole('button', { name: es.deshacer }).click()
    await expect(estado(page, c.etapas.contactado).getByRole('button', { name: /^Rodrigo Pérez/ })).toBeVisible()
    // Tocar sigue abriendo el contacto
    await fila(page, 'Rodrigo Pérez').click()
    await expect(linea(page).getByRole('button', { name: new RegExp(c.etapas.contactado) })).toHaveAttribute('aria-current', 'step')
  })

  test('un contacto de otra persona no se mueve y el aviso dice por qué', async ({ page }) => {
    await abrir(page, CONTACTOS_MIEMBRO)
    await llevar(page, fila(page, 'Kevin Park'), fila(page, 'David Levin'))
    await expect(page.getByRole('status').filter({ hasText: c.detalle.soloPuede('Sofía') })).toBeVisible()
    await expect(estado(page, c.etapas.por_contactar).getByRole('button', { name: /^Kevin Park/ })).toBeVisible()
    await expect(estado(page, c.etapas.contactado).getByRole('button', { name: /^Kevin Park/ })).toHaveCount(0)
    // En el detalle, las tuercas tampoco cambian nada, pero explican por qué
    await fila(page, 'Kevin Park').click()
    const tuerca = linea(page).getByRole('button', { name: c.etapas.contactado })
    await expect(tuerca).toHaveAttribute('aria-disabled', 'true')
    await tuerca.click({ force: true })
    await expect(page.getByRole('status').filter({ hasText: c.detalle.soloPuede('Sofía') })).toBeVisible()
    await expect(linea(page).getByRole('button', { name: new RegExp(c.etapas.por_contactar) })).toHaveAttribute('aria-current', 'step')
  })

  test('desplazar la lista no levanta ningún contacto', async ({ page }) => {
    test.skip(!esCelular(page), 'En el computador no hay lista que desplazar con el dedo')
    await abrir(page, CONTACTOS)
    const main = page.getByRole('main')
    const desde = await centroDe(fila(page, 'Rodrigo Pérez'))
    // Sin mantener apretado: el dedo desplaza la pantalla
    await arrastrar(page, desde, { x: desde.x, y: desde.y - 300 })
    await expect.poll(() => main.evaluate((el) => el.scrollTop)).toBeGreaterThan(0)
    await expect(page.locator('body > [inert]')).toHaveCount(0)
    await expect(page.getByRole('status')).toHaveCount(0)
    await expect(estado(page, c.etapas.contactado).getByRole('button', { name: /^Rodrigo Pérez/ })).toBeVisible()
  })

  test('llevar la tuerca por la línea del detalle', async ({ page }) => {
    await abrir(page, CONTACTOS)
    await fila(page, 'Rodrigo Pérez').click()
    const actual = linea(page).getByRole('button', { name: new RegExp(c.etapas.contactado) })
    await expect(actual).toHaveAttribute('aria-current', 'step')
    // La tuerca rueda de lado: no hace falta mantenerla apretada
    await arrastrar(page, await centroDe(actual), await centroDe(linea(page).getByRole('button', { name: c.etapas.respondio })))
    await expect(page.getByRole('status').filter({ hasText: c.paso('Rodrigo', c.etapas.respondio) })).toBeVisible()
    await expect(linea(page).getByRole('button', { name: new RegExp(c.etapas.respondio) })).toHaveAttribute('aria-current', 'step')
  })
})

test.describe('Contactos con movimiento', () => {
  test.use({ reducedMotion: 'no-preference' })

  test('el contacto vuela a su estado nuevo y queda quieto', async ({ page }) => {
    await abrir(page, CONTACTOS)
    await llevar(page, fila(page, 'Rodrigo Pérez'), fila(page, 'Kevin Park'))
    await expect(page.getByRole('status').filter({ hasText: c.paso('Rodrigo', c.etapas.por_contactar) })).toBeVisible()
    const movido = estado(page, c.etapas.por_contactar).getByRole('button', { name: /^Rodrigo Pérez/ })
    await expect(movido).toBeVisible()
    await expect(movido).toHaveCSS('translate', 'none')
    // La copia levantada ya no está
    await expect(page.locator('body > [inert]')).toHaveCount(0)
  })
})

