import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Avatar } from '../../componentes/Avatar.tsx'
import { BotonBorde, ErrorCampo, Hoja } from '../../componentes/Controles.tsx'
import { EncuadrarFoto } from '../../componentes/EncuadrarFoto.tsx'
import { Icono } from '../../componentes/Icono.tsx'
import type { Persona } from '../../datos/consultas.ts'
import { leerFoto } from '../../datos/fotos.ts'
import { useTextos } from '../../textos.ts'
import estilos from './formularios.module.css'

type Foto = { foto: string | null; fotoNueva: Blob | null }

// La foto del perfil: al tocarla se elige otra (y se encuadra), se vuelve a la de Google o se quita.
// Lo elegido se ve al tiro, pero se sube recién al guardar.
export function FotoDePerfil({ persona, foto, fotoNueva, onCambio }: Foto & { persona: Persona; onCambio: (cambio: Foto) => void }) {
  const textos = useTextos()
  const t = textos.perfil
  const [menu, setMenu] = useState(false)
  const [imagen, setImagen] = useState<ImageBitmap | null>(null)
  const [fallo, setFallo] = useState(false)
  const archivo = useRef<HTMLInputElement>(null)
  const nueva = useMemo(() => (fotoNueva ? URL.createObjectURL(fotoNueva) : null), [fotoNueva])
  useEffect(() => () => (nueva ? URL.revokeObjectURL(nueva) : undefined), [nueva])
  const vista = nueva ?? foto
  const google = persona.foto_google

  const elegir = () => {
    setMenu(false)
    archivo.current?.click()
  }
  const alElegir = async (e: ChangeEvent<HTMLInputElement>) => {
    const elegido = e.target.files?.[0]
    e.target.value = ''
    if (!elegido) return
    try {
      setFallo(false)
      setImagen(await leerFoto(elegido))
    } catch {
      setFallo(true)
    }
  }
  const cambiar = (cambio: Foto) => {
    setMenu(false)
    setFallo(false)
    onCambio(cambio)
  }
  const cerrarEncuadre = () => {
    imagen?.close()
    setImagen(null)
  }

  return (
    <>
      <div className={estilos.foto}>
        <button type="button" className={estilos.fotoBoton} aria-label={t.cambiarFoto} aria-haspopup="dialog" onClick={() => setMenu(true)}>
          <Avatar persona={{ ...persona, foto: vista }} medida={64} />
          <span className={estilos.fotoLapiz} aria-hidden="true">
            <Icono nombre="lapiz" medida={13} trazo={2.25} />
          </span>
        </button>
      </div>
      <ErrorCampo texto={fallo ? t.noSeAbrio : null} id="foto-error" />
      <input ref={archivo} type="file" accept="image/*" tabIndex={-1} aria-hidden="true" className={estilos.archivo} onChange={(e) => void alElegir(e)} />
      <Hoja abierta={menu} etiqueta={t.cambiarFoto} onCerrar={() => setMenu(false)}>
        <div className={estilos.opciones}>
          <button type="button" className={estilos.opcion} onClick={elegir}>
            <Icono nombre="foto" medida={22} />
            {t.elegirFoto}
          </button>
          {google && vista !== google && (
            <button type="button" className={estilos.opcion} onClick={() => cambiar({ foto: google, fotoNueva: null })}>
              <Icono nombre="google" medida={22} />
              {t.usarGoogle}
            </button>
          )}
          {vista && (
            <button type="button" className={estilos.opcion} data-peligro="true" onClick={() => cambiar({ foto: null, fotoNueva: null })}>
              <Icono nombre="basura" medida={22} />
              {t.quitarFoto}
            </button>
          )}
        </div>
        <div className={estilos.cancelar}>
          <BotonBorde onClick={() => setMenu(false)}>{textos.cancelar}</BotonBorde>
        </div>
      </Hoja>
      {imagen && (
        <EncuadrarFoto
          imagen={imagen}
          onUsar={(lista) => {
            cerrarEncuadre()
            cambiar({ foto, fotoNueva: lista })
          }}
          onCancelar={cerrarEncuadre}
        />
      )}
    </>
  )
}
