import { useEffect, useMemo, useRef } from 'react'
import { Icono } from '../../componentes/Icono.tsx'
import { diaConSemana, hoyEnCalifornia, sumarDias } from '../../datos/fechas.ts'
import { useUrlBoleta } from '../../datos/gastos.ts'
import { useTextos } from '../../textos.ts'
import estilos from './AnotarFechaFoto.module.css'

// La foto de la boleta: la que ya tenía el gasto, una nueva (todavía sin subir) o ninguna
export type Boleta = { tipo: 'nada' } | { tipo: 'guardada'; ruta: string } | { tipo: 'nueva'; foto: Blob }

type Props = { computador: boolean; fecha: string; boleta: Boleta; onFecha: (fecha: string) => void; onArchivo: (archivo: File) => void; onQuitar: () => void }

// "Hoy" abre el calendario del dispositivo; "Foto de la boleta", la cámara o la galería (los archivos, en el computador).
// Con foto, se ve la miniatura y tocarla la quita.
export function AnotarFechaFoto({ computador, fecha, boleta, onFecha, onArchivo, onQuitar }: Props) {
  const textos = useTextos()
  const t = textos.gastos.anotar
  const archivo = useRef<HTMLInputElement>(null)
  const nueva = useMemo(() => (boleta.tipo === 'nueva' ? URL.createObjectURL(boleta.foto) : null), [boleta])
  useEffect(() => () => (nueva ? URL.revokeObjectURL(nueva) : undefined), [nueva])
  const { data: guardada } = useUrlBoleta(boleta.tipo === 'guardada' ? boleta.ruta : null)
  const miniatura = boleta.tipo === 'nueva' ? nueva : boleta.tipo === 'guardada' ? guardada : null
  const hoy = hoyEnCalifornia()
  const dia = fecha === hoy ? t.hoy : fecha === sumarDias(hoy, -1) ? t.ayer : diaConSemana(fecha)

  return (
    <div className={estilos.fila} data-computador={computador}>
      <label className={estilos.ficha}>
        <Icono nombre="agenda" medida={16} trazo={2} />
        {dia}
        <input
          type="date"
          className={estilos.fechaNativa}
          value={fecha}
          aria-label={t.fecha}
          onClick={(e) => e.currentTarget.showPicker?.()}
          onChange={(e) => {
            if (e.target.value) onFecha(e.target.value)
          }}
        />
      </label>
      {boleta.tipo === 'nada' ? (
        <button type="button" className={estilos.ficha} onClick={() => archivo.current?.click()}>
          <Icono nombre="camara" medida={16} trazo={2} />
          {t.fotoBoleta}
        </button>
      ) : (
        <button type="button" className={`${estilos.ficha} ${estilos.conFoto}`} aria-label={t.quitarFoto} onClick={onQuitar}>
          {miniatura ? <img className={estilos.miniatura} src={miniatura} alt="" /> : <span className={estilos.miniatura} />}
          {t.boleta}
          <Icono nombre="cerrar" medida={16} trazo={2} />
        </button>
      )}
      <input
        ref={archivo}
        id="anotar-foto"
        type="file"
        accept="image/*"
        tabIndex={-1}
        aria-hidden="true"
        className={estilos.archivo}
        onChange={(e) => {
          const elegido = e.target.files?.[0]
          e.target.value = ''
          if (elegido) onArchivo(elegido)
        }}
      />
    </div>
  )
}
