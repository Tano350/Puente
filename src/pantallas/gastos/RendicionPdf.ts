import type { PDFDocument, PDFFont, PDFImage, PDFPage, RGB } from 'pdf-lib'
import { conMayuscula, diaCorto, diaLargo, rango } from '../../datos/fechas.ts'
import { urlsDeBoletas, type Gasto } from '../../datos/gastos.ts'
import { es as textos } from '../../textos.ts'

// El PDF de la rendición va siempre en español (textos, fechas y montos), esté la app en el idioma que esté,
// porque es lo que se entrega a quien rinde. Armado en el navegador: tu nombre, el viaje y las fechas, una tabla con cada gasto (total y
// tu parte) y el total; después, la foto de cada boleta en su propia página. pdf-lib se carga recién al descargar.

export type LineaRendicion = { gasto: Gasto; monto: number }

// Hoja carta, en puntos
const ANCHO_HOJA = 612
const ALTO_HOJA = 792
const MARGEN = 54
const ANCHO = ANCHO_HOJA - 2 * MARGEN
// Hasta dónde baja el contenido; más abajo va el pie de cada página
const PISO = 76
const FILA = 22

export async function descargarRendicion(nombre: string, lineas: LineaRendicion[]): Promise<void> {
  const pdf = await armarRendicionPdf(nombre, lineas)
  bajar(pdf, textos.gastos.rendicion.pdf.archivo(nombre.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim()))
}

export async function armarRendicionPdf(nombre: string, lineas: LineaRendicion[]): Promise<Uint8Array> {
  const t = textos.gastos.rendicion.pdf
  // Del más viejo al más nuevo, como se lee una rendición
  const orden = [...lineas].sort((a, b) => a.gasto.fecha.localeCompare(b.gasto.fecha) || a.gasto.creado_en.localeCompare(b.gasto.creado_en))
  const conFoto = orden.filter((l) => l.gasto.boleta)
  const [{ PDFDocument, StandardFonts, rgb }, fotos] = await Promise.all([import('pdf-lib'), bajarBoletas(conFoto.map((l) => l.gasto.boleta ?? ''))])

  const color = (hex: number) => rgb(((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255)
  const tinta = color(0x1e242c)
  const sec = color(0x56606b)
  const borde = color(0xd5dce3)

  const pdf = await PDFDocument.create()
  const normal = await pdf.embedFont(StandardFonts.Helvetica)
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold)
  const letras = new Set(normal.getCharacterSet())
  const viaje = textos.entrar.viaje
  const persona = limpiar(nombre, letras)
  // Un título que es solo un emoji queda vacío en Helvetica: va el nombre de la categoría
  const categorias: Record<string, string> = textos.gastos.categorias
  const tituloDe = (gasto: Gasto) => limpiar(gasto.titulo, letras) || categorias[gasto.categoria] || categorias.otro

  type Estilo = { tamano?: number; fuente?: PDFFont; tono?: RGB; derecha?: boolean; ancho?: number }
  const escribir = (hoja: PDFPage, texto: string, x: number, y: number, { tamano = 10.5, fuente = normal, tono = tinta, derecha = false, ancho }: Estilo = {}) => {
    let linea = limpiar(texto, letras)
    if (ancho) linea = cortar(linea, fuente, tamano, ancho)
    const medida = fuente.widthOfTextAtSize(linea, tamano)
    hoja.drawText(linea, { x: derecha ? x - medida : x, y, size: tamano, font: fuente, color: tono })
  }
  const raya = (hoja: PDFPage, y: number, grosor: number, tono: RGB) =>
    hoja.drawLine({ start: { x: MARGEN, y }, end: { x: MARGEN + ANCHO, y }, thickness: grosor, color: tono })

  // ---------- La tabla ----------
  const columna = { fecha: MARGEN, gasto: MARGEN + 76, total: MARGEN + ANCHO - 92, parte: MARGEN + ANCHO }
  let hoja = pdf.addPage([ANCHO_HOJA, ALTO_HOJA])
  let y = ALTO_HOJA - MARGEN - 20
  escribir(hoja, t.titulo, MARGEN, y, { tamano: 24, fuente: negrita })
  y -= 27
  escribir(hoja, persona, MARGEN, y, { tamano: 13 })
  y -= 18
  escribir(hoja, `${viaje} · ${fechasDe(orden.map((l) => l.gasto.fecha))}`, MARGEN, y, { tamano: 11, tono: sec })
  y -= 42

  const cabeza = () => {
    const rotulo: Estilo = { tamano: 9, fuente: negrita, tono: sec }
    escribir(hoja, t.fecha, columna.fecha, y, rotulo)
    escribir(hoja, t.gasto, columna.gasto, y, rotulo)
    escribir(hoja, t.total, columna.total, y, { ...rotulo, derecha: true })
    escribir(hoja, t.tuParte, columna.parte, y, { ...rotulo, derecha: true })
    y -= 7
    raya(hoja, y, 0.75, sec)
  }
  const otraHoja = () => {
    hoja = pdf.addPage([ANCHO_HOJA, ALTO_HOJA])
    y = ALTO_HOJA - MARGEN - 10
  }

  cabeza()
  orden.forEach((l, i) => {
    if (y - FILA < PISO) {
      otraHoja()
      cabeza()
    }
    const base = y - 15
    escribir(hoja, `${diaCorto(l.gasto.fecha, 'es')} ${l.gasto.fecha.slice(0, 4)}`, columna.fecha, base)
    escribir(hoja, tituloDe(l.gasto), columna.gasto, base, { ancho: columna.total - 76 - columna.gasto })
    escribir(hoja, plata(l.gasto.monto), columna.total, base, { derecha: true, tono: sec })
    escribir(hoja, plata(l.monto), columna.parte, base, { derecha: true })
    y -= FILA
    if (i < orden.length - 1) raya(hoja, y, 0.5, borde)
  })
  if (y - 28 < PISO) otraHoja()
  raya(hoja, y, 1, tinta)
  y -= 18
  escribir(hoja, t.total, columna.gasto, y, { tamano: 11, fuente: negrita })
  escribir(hoja, plata(orden.reduce((suma, l) => suma + l.monto, 0)), columna.parte, y, { tamano: 11, fuente: negrita, derecha: true })

  // ---------- Las boletas, una por página ----------
  const imagenes = await Promise.all(fotos.map((foto) => incrustar(pdf, foto)))
  conFoto.forEach((l, i) => {
    const pagina = pdf.addPage([ANCHO_HOJA, ALTO_HOJA])
    let arriba = ALTO_HOJA - MARGEN - 14
    escribir(pagina, tituloDe(l.gasto), MARGEN, arriba, { tamano: 15, fuente: negrita, ancho: ANCHO })
    arriba -= 19
    const montos = t.montos(plata(l.gasto.monto), l.monto === l.gasto.monto ? null : plata(l.monto))
    escribir(pagina, `${conMayuscula(diaLargo(l.gasto.fecha, 'es'))} de ${l.gasto.fecha.slice(0, 4)} · ${montos}`, MARGEN, arriba, { tono: sec, ancho: ANCHO })
    arriba -= 18
    const imagen = imagenes[i]
    const escala = Math.min(ANCHO / imagen.width, (arriba - PISO) / imagen.height)
    const ancho = imagen.width * escala
    const alto = imagen.height * escala
    const x = MARGEN + (ANCHO - ancho) / 2
    pagina.drawImage(imagen, { x, y: arriba - alto, width: ancho, height: alto })
    pagina.drawRectangle({ x, y: arriba - alto, width: ancho, height: alto, borderColor: borde, borderWidth: 0.75 })
  })

  // ---------- El pie: quién y qué página ----------
  const paginas = pdf.getPages()
  paginas.forEach((pagina, i) => {
    escribir(pagina, `${persona} · ${t.titulo}`, MARGEN, 40, { tamano: 8.5, tono: sec, ancho: ANCHO - 60 })
    escribir(pagina, t.pie(i + 1, paginas.length), MARGEN + ANCHO, 40, { tamano: 8.5, tono: sec, derecha: true })
  })

  pdf.setTitle(`${t.titulo} - ${nombre}`, { showInWindowTitleBar: true })
  pdf.setAuthor(nombre)
  pdf.setSubject(viaje)
  pdf.setCreator('Puente')
  pdf.setProducer('Puente')
  pdf.setLanguage('es-CL')
  return pdf.save()
}

// "US$ 1.234,56", siempre en español
function plata(centavos: number): string {
  const abs = Math.abs(centavos)
  const enteros = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${centavos < 0 ? '-' : ''}US$ ${enteros},${String(abs % 100).padStart(2, '0')}`
}

// "5 al 12 de enero de 2027" (o un solo día)
function fechasDe(fechas: string[]): string {
  if (!fechas.length) return ''
  const desde = fechas.reduce((a, b) => (b < a ? b : a))
  const hasta = fechas.reduce((a, b) => (b > a ? b : a))
  const ano = hasta.slice(0, 4)
  return desde === hasta ? `${diaLargo(desde, 'es').replace(/^\S+ /, '')} de ${ano}` : `${rango(desde, hasta, 'es')} de ${ano}`
}

// Helvetica no tiene todas las letras (sí las del español): las demás van sin tilde o, si no se puede, se omiten
const PARECIDAS: Record<string, string> = { Ł: 'L', ł: 'l', Đ: 'D', đ: 'd', ı: 'i' }
function limpiar(texto: string, letras: Set<number>): string {
  let limpio = ''
  for (const letra of texto) {
    if (letras.has(letra.codePointAt(0) ?? 0)) limpio += letra
    else {
      const simple = PARECIDAS[letra] ?? letra.normalize('NFD').replace(/[̀-ͯ]/g, '')
      if (simple && [...simple].every((l) => letras.has(l.codePointAt(0) ?? 0))) limpio += simple
    }
  }
  return limpio.replace(/\s+/g, ' ').trim()
}

// Corta con "…" lo que no cabe en el ancho
function cortar(texto: string, fuente: PDFFont, tamano: number, ancho: number): string {
  if (fuente.widthOfTextAtSize(texto, tamano) <= ancho) return texto
  let corto = texto
  while (corto && fuente.widthOfTextAtSize(`${corto}…`, tamano) > ancho) corto = corto.slice(0, -1)
  return `${corto.trimEnd()}…`
}

// Las boletas están en un espacio privado: se piden las direcciones firmadas todas juntas y se bajan las fotos
async function bajarBoletas(rutas: string[]): Promise<Blob[]> {
  const direcciones = await urlsDeBoletas(rutas)
  return Promise.all(
    direcciones.map(async (direccion) => {
      const respuesta = await fetch(direccion)
      if (!respuesta.ok) throw new Error(`No se pudo bajar la boleta (${respuesta.status})`)
      return respuesta.blob()
    }),
  )
}

// Las boletas son JPEG; lo que no sea JPEG ni PNG (la boleta dibujada de la maqueta, en SVG) pasa por un lienzo
async function incrustar(pdf: PDFDocument, foto: Blob): Promise<PDFImage> {
  const bytes = new Uint8Array(await foto.arrayBuffer())
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return pdf.embedJpg(bytes)
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return pdf.embedPng(bytes)
  return pdf.embedJpg(await aJpeg(foto))
}

async function aJpeg(foto: Blob): Promise<Uint8Array> {
  const direccion = URL.createObjectURL(foto)
  try {
    const imagen = new Image()
    await new Promise((listo, falla) => {
      imagen.onload = listo
      imagen.onerror = () => falla(new Error('No se pudo leer la boleta'))
      imagen.src = direccion
    })
    const escala = Math.min(3, 1600 / Math.max(imagen.naturalWidth, imagen.naturalHeight))
    const lienzo = document.createElement('canvas')
    lienzo.width = Math.round(imagen.naturalWidth * escala)
    lienzo.height = Math.round(imagen.naturalHeight * escala)
    const contexto = lienzo.getContext('2d')
    if (!contexto) throw new Error('No se pudo preparar la boleta')
    contexto.fillStyle = '#ffffff'
    contexto.fillRect(0, 0, lienzo.width, lienzo.height)
    contexto.drawImage(imagen, 0, 0, lienzo.width, lienzo.height)
    const jpeg = await new Promise<Blob>((listo, falla) => lienzo.toBlob((b) => (b ? listo(b) : falla(new Error('No se pudo preparar la boleta'))), 'image/jpeg', 0.9))
    return new Uint8Array(await jpeg.arrayBuffer())
  } finally {
    URL.revokeObjectURL(direccion)
  }
}

// Descarga con un enlace; en el celular el archivo se guarda o se abre
function bajar(pdf: Uint8Array, archivo: string) {
  const direccion = URL.createObjectURL(new Blob([pdf as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }))
  const enlace = document.createElement('a')
  enlace.href = direccion
  enlace.download = archivo
  document.body.append(enlace)
  enlace.click()
  enlace.remove()
  // Safari lo abre después del clic: la dirección se libera al rato
  window.setTimeout(() => URL.revokeObjectURL(direccion), 60_000)
}
