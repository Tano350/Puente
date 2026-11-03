import { modoMaqueta } from './maqueta.ts'
import { supabase } from './supabase.ts'

// Fotos de perfil propias: se recortan cuadradas, se achican a 512 px y se suben a la carpeta de cada uno.

const LADO = 512

// El cuadrado de la foto original que se usa (en píxeles de la original)
export type Encuadre = { x: number; y: number; lado: number }

export function encuadreAlCentro(ancho: number, alto: number): Encuadre {
  const lado = Math.min(ancho, alto)
  return { x: (ancho - lado) / 2, y: (alto - lado) / 2, lado }
}

// Lee la foto elegida (ya derecha, aunque el teléfono la haya guardado girada)
export function leerFoto(archivo: Blob): Promise<ImageBitmap> {
  return createImageBitmap(archivo, { imageOrientation: 'from-image' })
}

export function prepararFoto(imagen: ImageBitmap, encuadre = encuadreAlCentro(imagen.width, imagen.height)): Promise<Blob> {
  const lienzo = document.createElement('canvas')
  lienzo.width = LADO
  lienzo.height = LADO
  const contexto = lienzo.getContext('2d')
  if (!contexto) return Promise.reject(new Error('No se pudo preparar la foto'))
  contexto.imageSmoothingQuality = 'high'
  contexto.drawImage(imagen, encuadre.x, encuadre.y, encuadre.lado, encuadre.lado, 0, 0, LADO, LADO)
  return new Promise((listo, fallo) => lienzo.toBlob((foto) => (foto ? listo(foto) : fallo(new Error('No se pudo preparar la foto'))), 'image/jpeg', 0.86))
}

// Sube la foto con un nombre al azar y devuelve su dirección
export async function subirFoto(persona: string, foto: Blob): Promise<string> {
  // Solo en desarrollo, con ?maqueta: la foto queda en el navegador
  if (import.meta.env.DEV && modoMaqueta) return URL.createObjectURL(foto)
  const ruta = `${persona}/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from('fotos').upload(ruta, foto, { contentType: 'image/jpeg', cacheControl: '31536000' })
  if (error) throw error
  return supabase.storage.from('fotos').getPublicUrl(ruta).data.publicUrl
}

// Borra las fotos propias que ya no se usan; si falla, no importa
export async function limpiarFotos(persona: string, enUso: string | null): Promise<void> {
  if (import.meta.env.DEV && modoMaqueta) return
  const { data } = await supabase.storage.from('fotos').list(persona)
  const sobran = (data ?? []).map((archivo) => `${persona}/${archivo.name}`).filter((ruta) => !enUso?.endsWith(`/fotos/${ruta}`))
  if (sobran.length > 0) await supabase.storage.from('fotos').remove(sobran)
}
