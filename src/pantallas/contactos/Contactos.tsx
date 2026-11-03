import { useState } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router'
import { Buscador } from '../../componentes/Buscador.tsx'
import { Aviso } from '../../componentes/Controles.tsx'
import { Icono } from '../../componentes/Icono.tsx'
import { useAviso } from '../../componentes/useAviso.ts'
import { useEsComputador } from '../../componentes/useEsComputador.ts'
import escritorio from '../../componentes/Escritorio.module.css'
import { usePersonas } from '../../datos/consultas.ts'
import { borrarContacto, cambiarContacto, ETAPAS, puedeCambiar, useContactos, type Contacto, type Etapa } from '../../datos/contactos.ts'
import { plano } from '../../datos/grupo.ts'
import { primerNombre } from '../../datos/nombres.ts'
import { useSesion } from '../../datos/sesion.tsx'
import { useTextos } from '../../textos.ts'
import { DetalleContacto } from './DetalleContacto.tsx'
import { ListaFiltrar, type Filtros } from './ListaFiltrar.tsx'
import { ListaPorEtapa, type Responsable } from './ListaPorEtapa.tsx'
import { NuevoContacto } from './NuevoContacto.tsx'
import { TableroContactos } from './TableroContactos.tsx'
import { TableroMenu } from './TableroMenu.tsx'
import estilos from './Contactos.module.css'

const SIN_FILTROS: Filtros = { estados: [], responsables: [] }
const ESTADOS: Etapa[] = [...ETAPAS, 'descartado']

// Contactos: la lista por estado en el celular y el tablero en el computador.
// Rutas: /contactos, /contactos/nuevo, /contactos/:id y /contactos/:id/editar. En el celular el contacto ocupa
// la pantalla; en el computador se abre en un panel encima del tablero.
export function Contactos() {
  const textos = useTextos()
  const sesion = useSesion()
  const navigate = useNavigate()
  const location = useLocation()
  const { id, accion } = useParams()
  const esComputador = useEsComputador()
  const { data: contactos } = useContactos()
  const { data: personas } = usePersonas()
  const aviso = useAviso()
  const [busqueda, setBusqueda] = useState('')
  const [mios, setMios] = useState(false)
  const [filtros, setFiltros] = useState<Filtros>(SIN_FILTROS)
  const [filtrando, setFiltrando] = useState(false)
  // Mientras se guarda un cambio de estado hecho arrastrando, la tarjeta ya se ve en su columna nueva
  const [movido, setMovido] = useState<{ id: string; etapa: Etapa } | null>(null)
  if (sesion.tipo !== 'dentro') return null
  const yo = sesion.persona
  const t = textos.contactos
  const tl = t.lista

  // ---------- Navegación ----------
  // Abrir agrega una entrada al historial; cerrar vuelve atrás si se abrió desde aquí, así el "atrás" del teléfono hace lo mismo
  const desdeAqui = (location.state as { desdeAqui?: boolean } | null)?.desdeAqui === true
  const ir = (ruta: string, reemplazar = false) => navigate(ruta, { replace: reemplazar, state: { desdeAqui: reemplazar ? desdeAqui : true } })
  const volver = (ruta: string) => (desdeAqui ? navigate(-1) : navigate(ruta, { replace: true }))
  const cerrar = () => volver('/contactos')
  // En el computador, abrir otro contacto reemplaza al que estaba abierto
  const abrir = (ruta: string) => {
    if (location.pathname === ruta) return
    aviso.cerrar()
    ir(ruta, esComputador && Boolean(id))
  }

  const deshacer = async (cambio: () => Promise<unknown>) => {
    try {
      await cambio()
      aviso.cerrar()
    } catch {
      aviso.mostrar(textos.noSeGuardo)
    }
  }
  // Después de agregar, en el computador queda abierto el contacto nuevo; en el celular se vuelve a la lista
  const alTerminar = (contacto: Contacto, como: 'agregado' | 'guardado') => {
    if (como === 'guardado') {
      volver(`/contactos/${contacto.id}`)
      return
    }
    if (esComputador) ir(`/contactos/${contacto.id}`, true)
    else volver('/contactos')
    aviso.mostrar(tl.agregaste(contacto.nombre), () => void deshacer(() => borrarContacto(contacto.id)))
  }
  const mover = async (contacto: Contacto, etapa: Etapa) => {
    const antes = { etapa: contacto.etapa, etapa_en: contacto.etapa_en }
    setMovido({ id: contacto.id, etapa })
    try {
      await cambiarContacto(contacto.id, { etapa })
      const texto = etapa === 'descartado' ? t.descartaste(contacto.nombre) : t.paso(contacto.nombre.trim().split(/\s+/)[0], t.etapas[etapa])
      aviso.mostrar(texto, () => void deshacer(() => cambiarContacto(contacto.id, antes)))
    } catch {
      aviso.mostrar(textos.noSeGuardo)
    }
    setMovido(null)
  }

  const abierto = id && id !== 'nuevo' ? contactos?.find((c) => c.id === id) : undefined
  // Un contacto que ya no está (deshecho, o una dirección vieja) lleva a la lista
  if (contactos && id && id !== 'nuevo' && !abierto) return <Navigate to="/contactos" replace />
  const panel =
    id === 'nuevo' ? (
      <NuevoContacto computador={esComputador} onCerrar={cerrar} onListo={alTerminar} />
    ) : abierto && accion === 'editar' && puedeCambiar(abierto, yo) ? (
      <NuevoContacto computador={esComputador} contacto={abierto} onCerrar={() => volver(`/contactos/${abierto.id}`)} onListo={alTerminar} />
    ) : abierto ? (
      <DetalleContacto contacto={abierto} computador={esComputador} onCerrar={cerrar} onEditar={() => ir(`/contactos/${abierto.id}/editar`)} />
    ) : null

  // Celular: el contacto, nuevo o abierto, ocupa la pantalla
  if (!esComputador && panel) return panel
  if (!esComputador && id && !contactos) return null

  // ---------- Qué se ve ----------
  const todos = (contactos ?? []).map((c) => (c.id === movido?.id ? { ...c, etapa: movido.etapa } : c))
  const nombres = new Map((personas ?? []).map((p) => [p.id, primerNombre(p)]))
  const responsable = (c: Contacto): Responsable => (c.responsable === yo.id ? { texto: t.tu, tuyo: true } : { texto: nombres.get(c.responsable) ?? '', tuyo: false })
  // Con "Míos" ya se ve lo tuyo, así que se filtra entre los demás
  const responsables = (personas ?? [])
    .filter((p) => p.id !== yo.id && !p.sacada_en)
    .map((p) => ({ id: p.id, texto: primerNombre(p) }))
    .sort((a, b) => a.texto.localeCompare(b.texto, 'es'))
  const buscado = plano(busqueda.trim())
  const pasa = (c: Contacto, f: Filtros) =>
    (!mios || c.responsable === yo.id) &&
    (f.estados.length === 0 || f.estados.includes(c.etapa)) &&
    (mios || f.responsables.length === 0 || f.responsables.includes(c.responsable)) &&
    (!buscado || plano(`${c.nombre} ${c.organizacion ?? ''}`).includes(buscado))
  const visibles = todos.filter((c) => pasa(c, filtros)).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  const activos = [
    ...ESTADOS.filter((e) => filtros.estados.includes(e)).map((e) => ({ clave: e, texto: t.etapas[e] })),
    ...(mios ? [] : responsables.filter((r) => filtros.responsables.includes(r.id)).map((r) => ({ clave: r.id, texto: r.texto }))),
  ]
  const hay = (contactos?.length ?? 0) > 0
  const vacio = contactos?.length === 0

  // ---------- Piezas de las dos formas ----------
  const segmento = (
    <div role="group" aria-label={tl.queVer} className={estilos.segmento}>
      <button type="button" aria-pressed={!mios} onClick={() => setMios(false)}>
        {tl.todos}
      </button>
      <button type="button" aria-pressed={mios} onClick={() => setMios(true)}>
        {tl.mios}
      </button>
    </div>
  )
  const nada = busqueda.trim()
    ? { texto: tl.ningunoCoincide(busqueda.trim()), boton: textos.borrarBusqueda, accion: () => setBusqueda('') }
    : activos.length > 0
      ? { texto: tl.ningunoConFiltros, boton: tl.limpiarFiltros, accion: () => setFiltros(SIN_FILTROS) }
      : { texto: tl.sinMios, boton: tl.verTodos, accion: () => setMios(false) }
  const sinResultados = (
    <div className={estilos.sinResultados}>
      <div className={estilos.sinResultadosTexto}>{nada.texto}</div>
      <button type="button" className={estilos.botonBorde} onClick={nada.accion}>
        {nada.boton}
      </button>
    </div>
  )
  const sinContactos = (
    <div className={estilos.vacio}>
      <span className={estilos.tuercaVacia} aria-hidden="true" />
      <div className={estilos.vacioTexto}>{tl.vacio}</div>
      <button type="button" className={estilos.agregar} onClick={() => abrir('/contactos/nuevo')}>
        {tl.agregar}
      </button>
    </div>
  )

  // ---------- Computador ----------
  if (esComputador) {
    return (
      <div className={`${escritorio.pantalla} ${estilos.pc}`} data-panel={Boolean(panel)}>
        <div className={estilos.cabeceraPc}>
          <h1 className={escritorio.titulo}>{t.titulo}</h1>
          <button type="button" className={estilos.nuevo} aria-pressed={id === 'nuevo'} onClick={() => (id === 'nuevo' ? cerrar() : abrir('/contactos/nuevo'))}>
            <Icono nombre="mas" medida={18} trazo={2.25} />
            {tl.nuevoContacto}
          </button>
        </div>
        {hay && (
          <div className={estilos.filtrosPc}>
            <Buscador valor={busqueda} onCambio={setBusqueda} clase={estilos.buscadorPc} />
            {segmento}
            <TableroMenu
              etiqueta={tl.estado}
              opciones={ESTADOS.map((e) => ({ valor: e, texto: t.etapas[e] }))}
              elegidas={filtros.estados}
              onCambiar={(estados) => setFiltros({ ...filtros, estados })}
            />
            {!mios && (
              <TableroMenu
                etiqueta={t.responsable}
                opciones={responsables.map((r) => ({ valor: r.id, texto: r.texto }))}
                elegidas={filtros.responsables}
                onCambiar={(elegidos) => setFiltros({ ...filtros, responsables: elegidos })}
              />
            )}
          </div>
        )}
        <div className={estilos.cuerpoPc}>
          {hay &&
            (visibles.length > 0 ? (
              <TableroContactos
                contactos={visibles}
                mios={mios}
                elegido={abierto?.id}
                responsable={responsable}
                puedeMover={(c) => puedeCambiar(c, yo)}
                onAbrir={(c) => abrir(`/contactos/${c.id}`)}
                onMover={(c, etapa) => void mover(c, etapa)}
              />
            ) : (
              sinResultados
            ))}
          {vacio && sinContactos}
          {panel}
        </div>
        <Aviso texto={aviso.texto} onDeshacer={aviso.deshacer} conPanel={Boolean(panel)} />
      </div>
    )
  }

  // ---------- Celular ----------
  return (
    <div className={estilos.celular}>
      <div className={estilos.cabecera}>
        <div className={estilos.titular}>
          <h1 className={estilos.titulo}>{t.titulo}</h1>
          <button type="button" className={estilos.nuevo} aria-label={tl.nuevoContacto} onClick={() => abrir('/contactos/nuevo')}>
            <Icono nombre="mas" medida={18} trazo={2.25} />
            {tl.nuevo}
          </button>
        </div>
        {hay && <Buscador valor={busqueda} onCambio={setBusqueda} clase={estilos.buscador} />}
      </div>
      {hay && (
        <>
          <div className={estilos.controles}>
            {segmento}
            <button type="button" className={estilos.filtrar} aria-haspopup="dialog" onClick={() => setFiltrando(true)}>
              <Icono nombre="filtrar" medida={18} trazo={2} />
              {tl.filtrar}
              {activos.length > 0 && <span className={estilos.cuenta}>{activos.length}</span>}
            </button>
          </div>
          {activos.length > 0 && (
            <div className={estilos.activos}>
              {activos.map((a) => (
                <span key={a.clave} className={estilos.chip}>
                  {a.texto}
                </span>
              ))}
              <button type="button" className={estilos.limpiar} onClick={() => setFiltros(SIN_FILTROS)}>
                {tl.limpiar}
              </button>
            </div>
          )}
          {visibles.length > 0 ? <ListaPorEtapa contactos={visibles} mios={mios} responsable={responsable} onAbrir={(c) => abrir(`/contactos/${c.id}`)} /> : sinResultados}
        </>
      )}
      {vacio && sinContactos}
      {filtrando && (
        <ListaFiltrar
          filtros={filtros}
          mios={mios}
          responsables={responsables}
          cuantos={(f) => todos.filter((c) => pasa(c, f)).length}
          onAplicar={(f) => {
            setFiltros(f)
            setFiltrando(false)
          }}
          onCerrar={() => setFiltrando(false)}
        />
      )}
      <Aviso texto={aviso.texto} onDeshacer={aviso.deshacer} />
    </div>
  )
}
