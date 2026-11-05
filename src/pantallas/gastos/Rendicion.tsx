import { useRef, useState } from 'react'
import { Aviso } from '../../componentes/Controles.tsx'
import { Icono } from '../../componentes/Icono.tsx'
import { PanelEncima } from '../../componentes/Paneles.tsx'
import { useAviso } from '../../componentes/useAviso.ts'
import { estaConectado, useConectado } from '../../datos/conexion.ts'
import { plata, rendir } from '../../datos/gastos.ts'
import { useSesion } from '../../datos/sesion.tsx'
import { useTextos } from '../../textos.ts'
import { diaDelGasto, resumir, usePorRendir, type PorRendir } from './RendicionDatos.ts'
import { descargarRendicion } from './RendicionPdf.ts'
import estilos from './Rendicion.module.css'

// La rendición (forma "Lista"): arriba "Vas a rendir" con el total y "Descargar rendición"; abajo, cada gasto en que
// tienes parte, con su casilla (la misma que "Rindo este gasto" en el detalle del gasto).
// En el celular es el contenido de la pestaña "Rendición"; en el computador, el panel encima de la lista que abre "Preparar".
export function VistaRendicion({ computador, onCerrar }: { computador: boolean; onCerrar?: () => void }) {
  const textos = useTextos()
  const t = textos.gastos.rendicion
  const sesion = useSesion()
  const lista = usePorRendir()
  const aviso = useAviso()
  const conectado = useConectado()
  // Lo recién marcado se ve al tiro, mientras la base responde (cuenta solo el último toque de cada gasto)
  const [cambios, setCambios] = useState<Record<string, boolean>>({})
  const toques = useRef<Record<string, number>>({})
  const [descargando, setDescargando] = useState(false)
  const ocupado = useRef(false)

  const filas = (lista ?? []).map((x) => (x.gasto.id in cambios ? { ...x, marcado: cambios[x.gasto.id] } : x))
  const { marcados, total, sinFoto } = resumir(filas)

  const alternar = async ({ gasto, marcado }: PorRendir) => {
    const toque = (toques.current[gasto.id] ?? 0) + 1
    toques.current[gasto.id] = toque
    setCambios((antes) => ({ ...antes, [gasto.id]: !marcado }))
    aviso.cerrar()
    try {
      await rendir(gasto.id, !marcado)
    } catch {
      if (toques.current[gasto.id] === toque) aviso.mostrar(textos.noSeGuardo)
    }
    if (toques.current[gasto.id] !== toque) return
    setCambios((antes) => {
      const quedan = { ...antes }
      delete quedan[gasto.id]
      return quedan
    })
  }

  const descargar = async () => {
    if (!marcados.length || ocupado.current || sesion.tipo !== 'dentro' || !estaConectado()) return
    ocupado.current = true
    setDescargando(true)
    aviso.cerrar()
    try {
      await descargarRendicion(sesion.persona.nombre ?? sesion.persona.correo, marcados)
      aviso.mostrar(t.descargaste(marcados.length, plata(total)))
    } catch {
      aviso.mostrar(t.noSeDescargo)
    } finally {
      ocupado.current = false
      setDescargando(false)
    }
  }

  let cuerpo = null
  if (lista && !filas.length) cuerpo = <p className={estilos.vacio}>{t.vacio}</p>
  else if (lista)
    cuerpo = (
      <>
        <div className={estilos.tarjeta}>
          <div className={estilos.arriba}>
            <span className={estilos.textos}>
              <span className={estilos.etiqueta}>{t.vasARendir}</span>
              <span className={estilos.detalle}>{marcados.length ? t.cuantos(marcados.length) : t.marca}</span>
            </span>
            <span className={estilos.total} aria-live="polite">
              {plata(total)}
            </span>
          </div>
          {sinFoto > 0 && (
            <div className={estilos.faltan}>
              <Icono nombre="alerta" medida={15} trazo={2} />
              {t.sinFoto(sinFoto)}
            </div>
          )}
          <button type="button" className={estilos.descargar} aria-disabled={!marcados.length || descargando || !conectado} onClick={() => void descargar()}>
            <Icono nombre="instalar" medida={18} trazo={2.25} />
            {descargando ? t.descargando : t.descargar}
          </button>
          {!conectado && <div className={estilos.necesita}>{t.necesitasConexion}</div>}
        </div>
        <div className={estilos.lista}>
          {filas.map((x) => (
            <Fila key={x.gasto.id} fila={x} onAlternar={() => void alternar(x)} />
          ))}
        </div>
      </>
    )

  if (computador) {
    const titulo = textos.gastos.pestanas.rendicion
    return (
      <>
        <PanelEncima etiqueta={titulo} cabecera={<h2 className={estilos.tituloPanel}>{titulo}</h2>} onCerrar={onCerrar ?? (() => {})}>
          <div className={estilos.raiz} data-computador="true">
            {cuerpo}
          </div>
        </PanelEncima>
        <Aviso texto={aviso.texto} conPanel />
      </>
    )
  }
  return (
    <div className={estilos.raiz}>
      {cuerpo}
      {/* Arriba del botón "Anotar gasto" */}
      <Aviso texto={aviso.texto} sobrePie />
    </div>
  )
}

// Un gasto con su casilla: "Hoy, tu parte" (o "solo tuyo"), lo que rindes y si tiene foto de la boleta
function Fila({ fila, onAlternar }: { fila: PorRendir; onAlternar: () => void }) {
  const t = useTextos().gastos.rendicion
  const { gasto, monto, marcado } = fila
  const dia = diaDelGasto(gasto.fecha, t)
  return (
    <button type="button" role="checkbox" aria-checked={marcado} className={estilos.fila} onClick={onAlternar}>
      <span className={estilos.caja} aria-hidden="true">
        {marcado && <Icono nombre="check" medida={14} trazo={3} />}
      </span>
      <span className={estilos.textos}>
        <span className={estilos.titulo}>{gasto.titulo}</span>
        <span className={estilos.sub}>{gasto.division === 'solo' ? t.soloTuyo(dia) : t.tuParte(dia)}</span>
      </span>
      <span className={estilos.derecha}>
        <span className={estilos.monto}>{plata(monto)}</span>
        {gasto.boleta ? (
          <span className={estilos.foto}>
            <span className={estilos.boleta} aria-hidden="true" />
            {t.foto}
          </span>
        ) : (
          <span className={estilos.sinFoto}>
            <Icono nombre="alerta" medida={12} trazo={2.25} />
            {t.sinFotoCorto}
          </span>
        )}
      </span>
    </button>
  )
}

// En el computador, el resumen que va siempre en la columna de la derecha; "Preparar" abre la rendición encima
export function ResumenRendicion({ onPreparar }: { onPreparar: () => void }) {
  const textos = useTextos()
  const t = textos.gastos.rendicion
  const lista = usePorRendir()
  const { marcados, total } = resumir(lista ?? [])
  // Mientras se carga queda en blanco, para que no salte de "Sin gastos marcados" al total
  const detalle = !lista ? ' ' : marcados.length ? t.resumen(marcados.length, plata(total)) : t.sinMarcar
  return (
    <div className={estilos.resumen}>
      <span className={estilos.textos}>
        <span className={estilos.etiqueta}>{textos.gastos.pestanas.rendicion}</span>
        <span className={estilos.detalle}>{detalle}</span>
      </span>
      <button type="button" className={estilos.preparar} aria-label={t.prepararRendicion} onClick={onPreparar}>
        {t.preparar}
      </button>
    </div>
  )
}
