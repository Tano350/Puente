import { expect, test, type Page } from '@playwright/test'
import { abrir, es, esCelular } from './ayuda.ts'

const t = es.intereses
const ev = es.agenda.evento
const cr = es.agenda.crear

// Miércoles 12 de enero de 2027: Josefa administra Puente y le interesan IA e Impacto (Impacto lo creó ella)
const TEMAS = '/grupo/intereses?maqueta=lista&hoy=2027-01-12'
const TEMAS_SIN_SENAL = `${TEMAS}&sinsenal`
const AGENDA = '/agenda?maqueta=lista&hoy=2027-01-12'
const PLAID = '/agenda/charla-plaid?maqueta=lista&hoy=2027-01-12'
const PLAID_MIEMBRO = '/agenda/charla-plaid?maqueta=miembro&hoy=2027-01-12'

// El aviso de abajo, por su texto
const aviso = (page: Page, texto: string) => page.getByRole('status').filter({ hasText: texto })
// El botón que abre un tema (su nombre empieza por el del tema)
const abre = (page: Page, tema: string) => page.getByRole('button', { name: new RegExp(`^${tema}\\b`) })
// La tarjeta de un tema en la lista, con su «Me interesa» o «Te interesa»
const tarjeta = (page: Page, tema: string) => page.getByRole('listitem').filter({ has: abre(page, tema) })
// El tema abierto: pantalla entera en el celular, tarjeta a la derecha en el computador
const abierto = (page: Page, tema: string) => (esCelular(page) ? page.getByRole('main') : page.getByRole('region', { name: tema }))
const abrirTema = async (page: Page, tema: string) => {
  await abre(page, tema).click()
  await expect(abierto(page, tema).getByRole('heading', { name: tema, exact: true })).toBeVisible()
}
// El detalle de un evento: pantalla entera en el celular, columna del lado en el computador
const detalle = (page: Page) => (esCelular(page) ? page.getByRole('main') : page.getByRole('complementary'))
// Un evento en la vista del día
const eventoDelDia = (page: Page, titulo: string) => page.getByRole('button', { name: new RegExp(`(^|, |\\d\\d:\\d\\d )${titulo}(,| |$)`) }).first()
// A otra sección con la barra de secciones
const irA = (page: Page, seccion: string) => page.getByRole('navigation', { name: es.navegacion }).getByRole('link', { name: seccion }).click()

test.describe('Intereses: temas', () => {
  test('Grupo tiene Estadías | Intereses y los 4 temas van por nombre', async ({ page }) => {
    await abrir(page, TEMAS)
    const vista = page.getByRole('group', { name: t.grupo.queVer })
    await expect(vista.getByRole('button', { name: t.comun.titulo })).toHaveAttribute('aria-pressed', 'true')
    await expect(vista.getByRole('button', { name: t.comun.estadias })).toHaveAttribute('aria-pressed', 'false')
    const nombres = page.getByRole('main').getByRole('listitem').getByRole('button', { name: /^(Fintech|Hardware|IA|Impacto)\b/ })
    await expect(nombres).toHaveCount(4)
    for (const [i, tema] of ['Fintech', 'Hardware', 'IA', 'Impacto'].entries()) await expect(nombres.nth(i)).toContainText(tema)
    // A Josefa le interesan IA e Impacto
    await expect(tarjeta(page, 'IA').getByText(t.comun.teInteresa)).toBeVisible()
    await expect(tarjeta(page, 'Impacto').getByText(t.comun.teInteresa)).toBeVisible()
    await expect(tarjeta(page, 'Fintech').getByRole('button', { name: t.comun.meInteresa })).toBeVisible()
    // Se vuelve a Estadías con el mismo control
    await vista.getByRole('button', { name: t.comun.estadias }).click()
    await expect(page.getByRole('group', { name: t.grupo.queVer }).getByRole('button', { name: t.comun.estadias })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByText(es.grupo.hayAlla(12, 14))).toBeVisible()
  })

  test('«Me interesa» te suma y «Deshacer» te saca', async ({ page }) => {
    await abrir(page, TEMAS)
    await tarjeta(page, 'Fintech').getByRole('button', { name: t.comun.meInteresa }).click()
    await expect(aviso(page, t.grupo.teSumaste('Fintech'))).toBeVisible()
    await expect(tarjeta(page, 'Fintech').getByText(t.comun.teInteresa)).toBeVisible()
    await expect(tarjeta(page, 'Fintech').getByRole('button', { name: t.comun.meInteresa })).toHaveCount(0)
    await aviso(page, t.grupo.teSumaste('Fintech')).getByRole('button', { name: es.deshacer }).click()
    await expect(tarjeta(page, 'Fintech').getByRole('button', { name: t.comun.meInteresa })).toBeVisible()
    await expect(tarjeta(page, 'Fintech').getByText(t.comun.teInteresa)).toHaveCount(0)
  })

  test('en un tema, «Ya no me interesa» te saca y «Deshacer» te devuelve', async ({ page }) => {
    await abrir(page, TEMAS)
    await abrirTema(page, 'IA')
    const d = abierto(page, 'IA')
    await d.getByRole('button', { name: t.comun.yaNoMeInteresa }).click()
    await expect(aviso(page, t.tema.saliste('IA'))).toBeVisible()
    await expect(d.getByRole('button', { name: t.comun.meInteresa })).toBeVisible()
    await aviso(page, t.tema.saliste('IA')).getByRole('button', { name: es.deshacer }).click()
    await expect(d.getByRole('button', { name: t.comun.yaNoMeInteresa })).toBeVisible()
  })

  test('un tema nuevo pide nombre, no repite y queda con «Te interesa»', async ({ page }) => {
    await abrir(page, TEMAS)
    await page.getByRole('button', { name: /^Nuevo/ }).first().click()
    const nombre = page.getByRole('textbox', { name: t.editar.nombre })
    const crear = page.getByRole('button', { name: t.editar.crear, exact: true })
    await crear.click()
    await expect(page.getByRole('alert').filter({ hasText: t.editar.faltaNombre })).toBeVisible()
    await expect(nombre).toHaveAttribute('aria-invalid', 'true')
    // Con minúsculas es el mismo nombre
    await nombre.fill('fintech')
    await crear.click()
    await expect(page.getByRole('alert').filter({ hasText: t.editar.repetido('fintech') })).toBeVisible()
    await nombre.fill('Educación')
    await page.getByRole('textbox', { name: new RegExp(`^${t.editar.deQueTrata}`) }).fill('Colegios y universidades.')
    await crear.click()
    await expect(aviso(page, t.grupo.creaste('Educación'))).toBeVisible()
    await expect(tarjeta(page, 'Educación').getByText(t.comun.teInteresa)).toBeVisible()
    await expect(tarjeta(page, 'Educación').getByText('Colegios y universidades.')).toBeVisible()
  })

  test('Impacto es de Josefa: se edita y se borra al tiro, con «Deshacer»', async ({ page }) => {
    await abrir(page, TEMAS)
    await abrirTema(page, 'Impacto')
    const d = abierto(page, 'Impacto')
    await expect(d.getByRole('button', { name: t.tema.editar })).toBeVisible()
    await expect(d.getByRole('button', { name: t.tema.borrar })).toBeVisible()
    // Editar el nombre
    await d.getByRole('button', { name: t.tema.editar }).click()
    const nombre = page.getByRole('textbox', { name: t.editar.nombre })
    await expect(nombre).toHaveValue('Impacto')
    await nombre.fill('Impacto social')
    await page.getByRole('button', { name: t.editar.guardar, exact: true }).click()
    await expect(abierto(page, 'Impacto social').getByRole('heading', { name: 'Impacto social', exact: true })).toBeVisible()
    // Borrar: sin pregunta, porque no tiene eventos que sean solo para él
    await abierto(page, 'Impacto social').getByRole('button', { name: t.tema.borrar }).click()
    await expect(aviso(page, t.tema.borraste('Impacto social'))).toBeVisible()
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    await expect(abre(page, 'Impacto social')).toHaveCount(0)
    await aviso(page, t.tema.borraste('Impacto social')).getByRole('button', { name: es.deshacer }).click()
    await expect(abre(page, 'Impacto social')).toBeVisible()
  })

  test('borrar Fintech pregunta por la Charla en Plaid y la abre a todos', async ({ page }) => {
    await abrir(page, TEMAS)
    await abrirTema(page, 'Fintech')
    // Sus próximos eventos: uno todavía solo para ellos y otro ya abierto
    const d = abierto(page, 'Fintech')
    await expect(d.getByRole('button', { name: /Charla en Plaid/ })).toContainText(t.tema.soloElTema)
    await expect(d.getByRole('button', { name: /Visita a Brex/ })).toContainText(t.tema.paraTodos)
    await d.getByRole('button', { name: t.tema.borrar }).click()
    const hoja = page.getByRole('alertdialog', { name: t.tema.borrarPregunta('Fintech') })
    await expect(hoja).toContainText(t.tema.borrarAviso('Charla en Plaid', false, 'Fintech'))
    await hoja.getByRole('button', { name: t.tema.borrar }).click()
    await expect(aviso(page, t.tema.borraste('Fintech'))).toBeVisible()
    await expect(abre(page, 'Fintech')).toHaveCount(0)
    // Charla en Plaid ya no es solo de Fintech
    await irA(page, es.secciones.agenda)
    await page.getByRole('button', { name: /^Miércoles 13 de enero/ }).click()
    await expect(eventoDelDia(page, 'Charla en Plaid')).toBeVisible()
    await expect(page.getByText(t.comun.soloParaLosDe('Fintech'))).toHaveCount(0)
  })

  test('sin señal, «Me interesa» avisa que falta conexión', async ({ page }) => {
    await abrir(page, TEMAS_SIN_SENAL)
    const boton = tarjeta(page, 'Fintech').getByRole('button', { name: t.comun.meInteresa })
    await expect(boton).toHaveAttribute('aria-disabled', 'true')
    // Se ve apagado, pero al tocarlo explica por qué
    await boton.click({ force: true })
    await expect(aviso(page, t.comun.necesitasConexion)).toBeVisible()
    await expect(tarjeta(page, 'Fintech').getByText(t.comun.teInteresa)).toHaveCount(0)
  })

  test('en el computador el tema queda a la derecha', async ({ page }) => {
    test.skip(esCelular(page), 'La columna del lado es del computador')
    await abrir(page, TEMAS)
    // Sin elegir ninguno, queda abierto el primero
    await expect(page.getByRole('region', { name: 'Fintech' })).toBeVisible()
    await abre(page, 'IA').click()
    const lado = page.getByRole('region', { name: 'IA' })
    await expect(lado.getByRole('heading', { name: 'IA', exact: true })).toBeVisible()
    await expect(lado.getByRole('heading', { name: t.tema.aQuienes })).toBeVisible()
    await expect(lado.getByRole('button', { name: /Meetup de IA/ })).toContainText(t.tema.soloElTema)
    // El tema nuevo se crea al lado, sin salir de la lista
    await page.getByRole('button', { name: t.grupo.nuevoTema, exact: true }).click()
    await expect(page.getByRole('region', { name: t.editar.nuevo })).toBeVisible()
    await expect(abre(page, 'IA')).toBeVisible()
  })
})

test.describe('Intereses: eventos primero para un tema', () => {
  test('en la Agenda, la Charla en Plaid es solo de Fintech y Josefa no puede tomar cupo', async ({ page }) => {
    await abrir(page, AGENDA)
    await page.getByRole('button', { name: /^Miércoles 13 de enero/ }).click()
    await expect(eventoDelDia(page, 'Charla en Plaid')).toBeVisible()
    await expect(page.getByText(t.comun.soloParaLosDe('Fintech'))).toBeVisible()
    await expect(page.getByRole('button', { name: /Tomar cupo/ })).toHaveCount(0)
  })

  test('quien administra abre la Charla en Plaid a todos y puede deshacerlo', async ({ page }) => {
    await abrir(page, PLAID)
    const d = detalle(page)
    await expect(d.getByText(t.comun.primeroPara('Fintech'))).toBeVisible()
    await expect(d.getByText(ev.todaviaNoSeAbre)).toBeVisible()
    await expect(d.getByRole('button', { name: ev.tomarCupo })).toHaveCount(0)
    await d.getByRole('button', { name: ev.abrirATodos }).click()
    await expect(aviso(page, ev.abriste('Charla en Plaid'))).toBeVisible()
    await expect(d.getByRole('button', { name: ev.abrirATodos })).toHaveCount(0)
    await expect(d.getByRole('button', { name: ev.tomarCupo })).toBeVisible()
    await aviso(page, ev.abriste('Charla en Plaid')).getByRole('button', { name: es.deshacer }).click()
    await expect(d.getByRole('button', { name: ev.abrirATodos })).toBeVisible()
    await expect(d.getByRole('button', { name: ev.tomarCupo })).toHaveCount(0)
  })

  test('sin administrar no hay «Abrir a todos» y la barra dice que todavía no se abre', async ({ page }) => {
    await abrir(page, PLAID_MIEMBRO)
    const d = detalle(page)
    await expect(d.getByText(t.comun.primeroPara('Fintech'))).toBeVisible()
    await expect(d.getByRole('button', { name: ev.abrirATodos })).toHaveCount(0)
    await expect(d.getByText(ev.todaviaNoSeAbre)).toBeVisible()
    await expect(d.getByRole('button', { name: ev.tomarCupo })).toHaveCount(0)
  })

  test('Crear evento: «Primero para» IA explica y el evento sale «Primero para los de IA»', async ({ page }) => {
    await abrir(page, AGENDA)
    await page.getByRole('button', { name: /^Nuevo/ }).first().click()
    const panel = detalle(page)
    await panel.getByLabel(cr.nombreEvento).fill('Demo de agentes')
    await panel.getByLabel(cr.dia, { exact: true }).fill('2027-01-15')
    await panel.getByLabel(cr.empieza).fill('18:00')
    await panel.getByLabel(cr.termina).fill('19:00')
    const primero = panel.getByRole('radiogroup', { name: cr.primeroPara })
    await expect(primero.getByRole('radio', { name: cr.todos })).toBeChecked()
    await primero.getByRole('radio', { name: 'IA', exact: true }).click()
    await expect(primero.getByRole('radio', { name: 'IA', exact: true })).toBeChecked()
    await expect(panel.getByText(cr.explicaTema('IA'))).toBeVisible()
    await panel.getByRole('button', { name: cr.crearEvento }).click()
    await expect(aviso(page, es.agenda.vista.creaste('Demo de agentes'))).toBeVisible()
    await expect(detalle(page).getByRole('heading', { name: 'Demo de agentes' })).toBeVisible()
    await expect(detalle(page).getByText(t.comun.primeroPara('IA'))).toBeVisible()
    // Lo organiza ella: puede abrirlo a todos
    await expect(detalle(page).getByRole('button', { name: ev.abrirATodos })).toBeVisible()
  })

  test('Crear evento cerrado: «Agregar a los de» Fintech marca a sus integrantes', async ({ page }) => {
    await abrir(page, AGENDA)
    await page.getByRole('button', { name: /^Nuevo/ }).first().click()
    const panel = detalle(page)
    await panel.getByRole('radio', { name: cr.modos.cerrado }).check({ force: true })
    // «Primero para» no va en uno cerrado
    await expect(panel.getByRole('radiogroup', { name: cr.primeroPara })).toHaveCount(0)
    const temas = panel.getByRole('group', { name: cr.agregarALosDe })
    const fintech = temas.getByRole('button', { name: 'Fintech' })
    await expect(fintech).toHaveAttribute('aria-pressed', 'false')
    await fintech.click()
    await expect(fintech).toHaveAttribute('aria-pressed', 'true')
    const personas = panel.getByRole('group', { name: cr.personasEtiqueta })
    for (const nombre of ['Diego', 'Paula', 'Sofía', 'Vicente']) await expect(personas.getByRole('button', { name: new RegExp(nombre) })).toHaveAttribute('aria-pressed', 'true')
    await expect(personas.getByRole('button', { pressed: true })).toHaveCount(4)
    // Tocarlo otra vez los saca
    await fintech.click()
    await expect(personas.getByRole('button', { pressed: true })).toHaveCount(0)
  })

  test('Hoy: «También hoy en el grupo» lista el Meetup de IA, primero para los de IA', async ({ page }) => {
    await abrir(page, '/hoy?maqueta=lista&hoy=2027-01-12')
    const fila = page.getByRole('button', { name: /^Meetup de IA/ })
    await expect(fila).toBeVisible()
    await expect(fila).toContainText(t.comun.primeroPara('IA'))
  })
})

test.describe('Intereses: perfiles', () => {
  test('el perfil de Diego muestra sus temas; de ahí se va al tema y se vuelve con su nombre', async ({ page }) => {
    test.skip(!esCelular(page), 'La vuelta con el nombre del tema es del celular')
    await abrir(page, '/grupo?maqueta=lista&hoy=2027-01-12')
    await page.getByRole('list', { name: es.grupo.estadias }).getByRole('button', { name: /Diego Larraín/ }).click()
    const perfil = page.getByRole('main')
    await expect(perfil.getByText(es.persona.intereses, { exact: true })).toBeVisible()
    await expect(perfil.getByRole('button', { name: 'Fintech', exact: true })).toBeVisible()
    await expect(perfil.getByRole('button', { name: 'Hardware', exact: true })).toBeVisible()
    await expect(perfil.getByRole('button', { name: 'IA', exact: true })).toHaveCount(0)
    // Desde el perfil, al tema
    await perfil.getByRole('button', { name: 'Fintech', exact: true }).click()
    await expect(abierto(page, 'Fintech').getByRole('heading', { name: 'Fintech', exact: true })).toBeVisible()
    // Abrir a Diego desde el tema y volver: regresa al tema, y el botón lleva su nombre
    await abierto(page, 'Fintech').getByRole('button', { name: /Diego Larraín/ }).click()
    // El de «atrás» va arriba del todo, antes que el «Fintech» de sus intereses
    const atras = page.getByRole('main').getByRole('button').first()
    await expect(atras).toHaveAccessibleName('Fintech')
    await expect(atras).toBeVisible()
    await expect(page.getByRole('button', { name: es.grupo.titulo, exact: true })).toHaveCount(0)
    await atras.click()
    await expect(abierto(page, 'Fintech').getByRole('heading', { name: 'Fintech', exact: true })).toBeVisible()
  })
})
