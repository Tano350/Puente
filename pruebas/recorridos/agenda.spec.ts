import { expect, test, type Page } from '@playwright/test'
import { abrir, es, esCelular } from './ayuda.ts'

const a = es.agenda
const ev = a.evento

const AGENDA = '/agenda?maqueta=lista&hoy=2027-01-12'

// El botón de un evento en cualquiera de las vistas ("Plug and Play" en el día, "10:30, Plug and Play, Vas" en la semana)
function evento(page: Page, titulo: string) {
  return page.getByRole('button', { name: new RegExp(`(^|, |\\d\\d:\\d\\d )${titulo}(,| |$)`) }).first()
}

// El detalle del evento abierto: pantalla entera en el celular, columna del lado en el computador
function detalle(page: Page) {
  return esCelular(page) ? page.getByRole('main') : page.getByRole('complementary')
}

test.describe('Agenda', () => {
  test('vistas: día, semana y mes, y filtrar a los que voy', async ({ page }) => {
    await abrir(page, AGENDA)
    await expect(page.getByRole('heading', { name: a.titulo, level: 1 })).toBeVisible()
    const vistas = page.getByRole('tablist', { name: a.vista.vistas })
    for (const nombre of [a.vista.nombres.mes, a.vista.nombres.semana, a.vista.nombres.dia]) {
      await vistas.getByRole('tab', { name: nombre }).click()
      await expect(vistas.getByRole('tab', { name: nombre })).toHaveAttribute('aria-selected', 'true')
      await expect(page.getByRole('tabpanel', { name: nombre })).toBeVisible()
    }
    // El día de hoy: una reunión cerrada a la que Josefa no va
    await expect(evento(page, 'Reunión con Sequoia')).toBeVisible()
    const filtro = page.getByRole('group', { name: a.vista.queVer })
    await filtro.getByRole('button', { name: a.vista.aLosQueVoy }).click()
    await expect(evento(page, 'Reunión con Sequoia')).toHaveCount(0)
    await expect(evento(page, 'Plug and Play')).toBeVisible()
    await filtro.getByRole('button', { name: a.vista.todo }).click()
    await expect(evento(page, 'Reunión con Sequoia')).toBeVisible()
    // En la semana, ir a la siguiente
    if (!esCelular(page)) {
      await vistas.getByRole('tab', { name: a.vista.nombres.semana }).click()
      await page.getByRole('button', { name: a.vista.siguiente.semana }).click()
      await expect(page.getByText('Semana del 18 al 24 de enero')).toBeVisible()
      await expect(evento(page, 'Visita a Tesla')).toHaveCount(0)
    }
  })

  test('el boleto de un evento al que voy', async ({ page }) => {
    await abrir(page, AGENDA)
    await evento(page, 'Plug and Play').click()
    const d = detalle(page)
    await expect(d.getByRole('heading', { name: 'Plug and Play' })).toBeVisible()
    await expect(d.getByText(ev.tuCupo)).toBeVisible()
    await expect(d.getByText(ev.cupos(3, 8))).toBeVisible()
    await expect(d.getByText(ev.tienesCupo)).toBeVisible()
    await expect(d.getByRole('link', { name: ev.comoLlegar })).toBeVisible()
    await expect(d.getByRole('button', { name: ev.soltarCupo })).toBeVisible()
  })

  test('tomar un cupo y deshacer', async ({ page }) => {
    await abrir(page, AGENDA)
    await evento(page, 'Charla en Stripe').click()
    const d = detalle(page)
    await expect(d.getByRole('heading', { name: 'Charla en Stripe' })).toBeVisible()
    await d.getByRole('button', { name: ev.tomarCupo }).click()
    const aviso = page.getByRole('status').filter({ hasText: ev.tomaste })
    await expect(aviso).toBeVisible()
    await expect(d.getByText(ev.tienesCupo)).toBeVisible()
    await aviso.getByRole('button', { name: es.deshacer }).click()
    await expect(d.getByRole('button', { name: ev.tomarCupo })).toBeVisible()
    await expect(d.getByText(ev.tienesCupo)).toHaveCount(0)
  })

  test('anotarse en la lista de espera de un evento lleno', async ({ page }) => {
    await abrir(page, AGENDA)
    // Visita a Google es el 13 de enero y está llena, con dos en espera
    await page.getByRole('tab', { name: a.vista.nombres.semana }).click()
    await evento(page, 'Visita a Google').click()
    const d = detalle(page)
    await expect(d.getByRole('button', { name: ev.anotarme })).toBeVisible()
    await d.getByRole('button', { name: ev.anotarme }).click()
    await expect(page.getByRole('status').filter({ hasText: ev.quedaste(3) })).toBeVisible()
    await expect(d.getByText(ev.enLaListaDeEspera, { exact: true })).toBeVisible()
  })

  test('al crear sin lo necesario, cada error sale bajo su línea', async ({ page }) => {
    await abrir(page, AGENDA)
    await page.getByRole('button', { name: /^Nuevo/ }).first().click()
    const panel = detalle(page)
    await panel.getByRole('button', { name: a.crear.crearEvento }).click()
    const nombre = panel.getByText(a.crear.faltaNombre)
    const hora = panel.getByText(a.crear.faltaInicio)
    await expect(nombre).toBeVisible()
    await expect(hora).toBeVisible()
    // El del nombre queda arriba de la hora, los dos dentro del boleto
    const [y1, y2] = [(await nombre.boundingBox())?.y ?? 0, (await hora.boundingBox())?.y ?? 0]
    expect(y1).toBeLessThan(y2)
    await expect(panel.getByLabel(a.crear.nombreEvento)).toHaveAttribute('aria-invalid', 'true')
  })

  test('crear un evento, editarlo, cancelarlo y deshacer', async ({ page }) => {
    await abrir(page, AGENDA)
    await page.getByRole('button', { name: /^Nuevo/ }).first().click()
    const panel = detalle(page)
    await panel.getByLabel(a.crear.tipo).selectOption('visita')
    await panel.getByLabel(a.crear.nombreEvento).fill('Visita de prueba')
    await panel.getByLabel(a.crear.dia, { exact: true }).fill('2027-01-13')
    await panel.getByLabel(a.crear.empieza).fill('15:00')
    await panel.getByLabel(a.crear.termina).fill('16:00')
    await panel.getByRole('button', { name: a.crear.agregaLugar }).click()
    await page.getByRole('dialog', { name: a.crear.lugar }).getByLabel(a.crear.nombreLugar).fill('Oficina de prueba')
    await page.getByRole('dialog', { name: a.crear.lugar }).getByRole('button', { name: a.crear.listo }).click()
    // Con la máquina cargada, la hoja del lugar tarda en cerrarse y devuelve el foco: se espera antes de seguir
    await expect(page.getByRole('dialog', { name: a.crear.lugar })).toBeHidden()
    const conCupo = panel.getByRole('radio', { name: a.crear.modos.con_cupo })
    await expect(async () => {
      await conCupo.check({ force: true })
      await expect(conCupo).toBeChecked({ timeout: 1000 })
    }).toPass()
    await panel.getByRole('button', { name: a.crear.crearEvento }).click()

    // Queda abierto el evento nuevo, con el aviso
    await expect(page.getByRole('status').filter({ hasText: a.vista.creaste('Visita de prueba') })).toBeVisible()
    await expect(detalle(page).getByRole('heading', { name: 'Visita de prueba' })).toBeVisible()
    await expect(detalle(page).getByText(ev.organizasTu)).toBeVisible()

    // Editarlo
    await detalle(page).getByRole('button', { name: a.editar.editar }).click()
    await detalle(page).getByLabel(a.crear.nombreEvento).fill('Visita cambiada')
    await detalle(page).getByRole('button', { name: a.editar.guardar }).click()
    await expect(page.getByRole('status').filter({ hasText: a.editar.guardaste })).toBeVisible()
    await expect(detalle(page).getByRole('heading', { name: 'Visita cambiada' })).toBeVisible()

    // Cancelarlo y deshacer
    await detalle(page).getByRole('button', { name: a.editar.editar }).click()
    await detalle(page).getByRole('button', { name: a.editar.cancelarEvento }).click()
    const pregunta = page.getByRole('alertdialog')
    await expect(pregunta).toContainText(a.editar.cancelarPregunta('Visita cambiada'))
    await pregunta.getByRole('button', { name: a.editar.cancelarEvento }).click()
    const aviso = page.getByRole('status').filter({ hasText: a.editar.cancelaste('Visita cambiada') })
    await expect(aviso).toBeVisible()
    await aviso.getByRole('button', { name: es.deshacer }).click()
    await expect(detalle(page).getByRole('heading', { name: 'Visita cambiada' })).toBeVisible()
  })
})

