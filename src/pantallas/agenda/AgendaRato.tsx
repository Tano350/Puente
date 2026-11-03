import { useEffect, useRef, useState } from 'react'
import { Aviso, BotonBorde, BotonPrincipal, Hoja, TituloHoja } from '../../componentes/Controles.tsx'
import { useHoraDeChile } from '../../componentes/HoraDeChile.tsx'
import { Icono } from '../../componentes/Icono.tsx'
import { useAviso } from '../../componentes/useAviso.ts'
import { borrarOcupado, marcarOcupado, type Ocupado } from '../../datos/eventos.ts'
import { CHILE, conMayuscula, diaDeLaSemana, diaEn, diaLargo, hora } from '../../datos/fechas.ts'
import { useTextos } from '../../textos.ts'
import estilos from './AgendaRato.module.css'

type Props = { rato: Ocupado | null; computador: boolean; onCerrar: () => void }

// Un rato ocupado abierto desde el Día o la Semana: cuándo es y "Borrar rato ocupado", con aviso y "Deshacer".
// Cada vista lo deja siempre puesto: así el aviso sigue en pantalla después de cerrar la hoja.
export function AgendaRato({ rato, computador, onCerrar }: Props) {
  const textos = useTextos()
  const t = textos.agenda.rato
  const [chile] = useHoraDeChile()
  const aviso = useAviso()
  const [borrando, setBorrando] = useState(false)
  // Al abrirse, el foco entra a la hoja; al cerrarse, la hoja lo devuelve al rato (si sigue ahí)
  const contenido = useRef<HTMLDivElement>(null)
  const abierto = rato?.id
  useEffect(() => {
    if (abierto) contenido.current?.focus({ preventScroll: true })
  }, [abierto])

  // "Deshacer" lo vuelve a marcar con el mismo nombre y la misma hora
  const devolver = async ({ titulo, inicio, fin }: Ocupado) => {
    aviso.cerrar()
    try {
      await marcarOcupado({ titulo, inicio, fin })
    } catch {
      aviso.mostrar(textos.noSeGuardo)
    }
  }
  const borrar = async (borrado: Ocupado) => {
    setBorrando(true)
    try {
      await borrarOcupado(borrado.id)
      aviso.mostrar(t.borraste(borrado.titulo), () => void devolver(borrado))
    } catch {
      aviso.mostrar(textos.noSeGuardo)
    }
    setBorrando(false)
    onCerrar()
  }

  // El día y las horas en California; con "Hora de Chile", también allá (como en el boleto)
  const cuando = (r: Ocupado) => t.cuando(conMayuscula(diaLargo(diaEn(r.inicio))), t.horario(hora(r.inicio), hora(r.fin)))
  const enChile = (r: Ocupado) => {
    const horario = t.horario(hora(r.inicio, CHILE), hora(r.fin, CHILE))
    const dia = diaEn(r.inicio, CHILE)
    return textos.agenda.enChile(dia === diaEn(r.inicio) ? horario : t.delDia(horario, diaDeLaSemana(dia)))
  }

  return (
    <>
      <Hoja abierta={rato !== null} etiqueta={rato?.titulo ?? ''} onCerrar={onCerrar}>
        {rato && (
          <div ref={contenido} tabIndex={-1} className={estilos.contenido}>
            <TituloHoja>{rato.titulo}</TituloHoja>
            <div className={estilos.cuando}>{cuando(rato)}</div>
            {chile && <div className={estilos.chile}>{enChile(rato)}</div>}
            <div className={estilos.solo}>
              <Icono nombre="candado" medida={16} trazo={2} />
              {t.soloTu}
            </div>
            <div className={estilos.botones}>
              <BotonPrincipal peligro ocupado={borrando} onClick={() => void borrar(rato)}>
                {t.borrar}
              </BotonPrincipal>
              <BotonBorde onClick={onCerrar}>{textos.cerrar}</BotonBorde>
            </div>
          </div>
        )}
      </Hoja>
      <Aviso texto={aviso.texto} onDeshacer={aviso.deshacer} conPanel={computador} />
    </>
  )
}
