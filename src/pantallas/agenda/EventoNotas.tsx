import { CampoTexto, Etiqueta } from '../../componentes/Controles.tsx'
import { usePersonas } from '../../datos/consultas.ts'
import { useNotasReunion, type NotaReunion } from '../../datos/eventos.ts'
import { conMayuscula, diaCorto, diaLocal, hoyAqui } from '../../datos/fechas.ts'
import { primerNombre } from '../../datos/nombres.ts'
import { useTextos } from '../../textos.ts'
import estilos from './EventoNotas.module.css'

export type Borrador = { aprendi: string; sigue: string }

// Las notas de reunión del evento: qué aprendió cada uno y qué sigue. Al escribir la tuya, las dos preguntas.
export function EventoNotas({ evento, yo, borrador, computador, onBorrador, onGuardar }: { evento: string; yo: string; borrador: Borrador | null; computador: boolean; onBorrador: (borrador: Borrador) => void; onGuardar: () => void }) {
  const textos = useTextos()
  const t = textos.agenda.evento
  const { data: todas } = useNotasReunion()
  const { data: personas } = usePersonas()
  // La tuya primero (mientras la escribes, no se repite); después las demás, de la más nueva a la más vieja
  const notas = (todas ?? [])
    .filter((n) => n.evento === evento && !(borrador && n.autor === yo))
    .sort((a, b) => (a.autor === yo ? -1 : b.autor === yo ? 1 : b.escrita_en.localeCompare(a.escrita_en)))
  if (!borrador && notas.length === 0) return null

  const hoy = hoyAqui()
  const autorYDia = (nota: NotaReunion) => {
    const dia = diaLocal(nota.escrita_en)
    const cuando = dia === hoy ? t.hoy : diaCorto(dia)
    if (nota.autor === yo) return t.autorYDia(t.tu, cuando)
    const autor = personas?.find((p) => p.id === nota.autor)
    return autor ? t.autorYDia(primerNombre(autor), cuando) : conMayuscula(cuando)
  }
  const campo = `nota-${evento}`

  return (
    <section className={estilos.notas} data-pc={computador} aria-labelledby={`${campo}-rotulo`}>
      <div id={`${campo}-rotulo`} className={estilos.rotulo}>
        {t.notas}
      </div>
      {borrador && (
        // Ctrl o Cmd + Enter guarda, como en las notas de Contactos
        <div
          className={estilos.redactar}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) onGuardar()
          }}
        >
          <Etiqueta texto={t.queAprendiste} para={`${campo}-aprendi`} />
          <CampoTexto id={`${campo}-aprendi`} valor={borrador.aprendi} onCambio={(aprendi) => onBorrador({ ...borrador, aprendi })} multilinea autoFocus />
          <Etiqueta texto={t.queSigue} para={`${campo}-sigue`} />
          <CampoTexto id={`${campo}-sigue`} valor={borrador.sigue} onCambio={(sigue) => onBorrador({ ...borrador, sigue })} multilinea />
        </div>
      )}
      {notas.map((n) => (
        <div key={n.autor} className={estilos.nota}>
          {n.aprendi && (
            <>
              <div className={estilos.pregunta}>{n.autor === yo ? t.queAprendiste : t.queAprendio}</div>
              <div className={estilos.texto}>{n.aprendi}</div>
            </>
          )}
          {n.sigue && (
            <>
              <div className={estilos.pregunta}>{t.queSigue}</div>
              <div className={estilos.texto}>{n.sigue}</div>
            </>
          )}
          <div className={estilos.meta}>{autorYDia(n)}</div>
        </div>
      ))}
    </section>
  )
}
