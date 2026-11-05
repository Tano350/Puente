import { useRef, useState } from 'react'
import { BotonPrincipal } from '../../componentes/Controles.tsx'
import { Icono } from '../../componentes/Icono.tsx'
import { PanelEncima, PantallaConPie } from '../../componentes/Paneles.tsx'
import { SinConexion } from '../../componentes/SinConexion.tsx'
import { useConectado } from '../../datos/conexion.ts'
import { usePersonas, type Persona } from '../../datos/consultas.ts'
import {
  anotarGasto,
  cambiarGasto,
  categoriaDe,
  partesDe,
  prepararBoleta,
  quitarBoleta,
  subirBoleta,
  usePartes,
  type DatosGasto,
  type Division,
  type Gasto,
  type Parte,
} from '../../datos/gastos.ts'
import { integrantes } from '../../datos/grupo.ts'
import { primerNombre } from '../../datos/nombres.ts'
import { useSesion } from '../../datos/sesion.tsx'
import { useTextos } from '../../textos.ts'
import {
  borradorDe,
  borradorNuevo,
  cuentaDe,
  datosDe,
  datosGuardados,
  hayErrores,
  mismosDatos,
  nombresCortos,
  ordenarMonto,
  sinMoneda,
  soloMonto,
  validar,
  type Borrador,
  type Errores,
} from './AnotarBorrador.ts'
import { AnotarCategoria, AnotarQuienPago } from './AnotarElegir.tsx'
import { AnotarEntreQuienes } from './AnotarEntreQuienes.tsx'
import { AnotarFechaFoto, type Boleta } from './AnotarFechaFoto.tsx'
import { iconoDe } from './categorias.ts'
import estilos from './AnotarGasto.module.css'

type Props = { computador: boolean; gasto?: Gasto; onCerrar: () => void; onListo: (gasto: Gasto, como: 'anotado' | 'guardado') => void }

// Tocar "dividido" pasa por las tres formas
const DIVISIONES = ['iguales', 'exactos', 'solo'] as const satisfies readonly Division[]

// "Nuevo gasto" y, con "gasto", "Editar gasto". En el celular tapa todo, también la barra de secciones;
// en el computador es el panel encima de la lista. Al terminar llama a onListo; cancelar, a onCerrar.
export function AnotarGasto({ gasto, ...resto }: Props) {
  const sesion = useSesion()
  const { data: personas } = usePersonas()
  const { data: partes } = usePartes()
  // Parte cuando están las personas (todas quedan marcadas) y, al editar, las partes del gasto
  if (sesion.tipo !== 'dentro' || !personas || (gasto && !partes)) return null
  return <Formulario key={gasto?.id ?? 'nuevo'} {...resto} gasto={gasto} yo={sesion.persona} personas={personas} partes={gasto ? partesDe(gasto.id, partes ?? []) : []} />
}

function Formulario({ computador, gasto, onCerrar, onListo, yo, personas, partes }: Props & { yo: Persona; personas: Persona[]; partes: Parte[] }) {
  const textos = useTextos()
  const conectado = useConectado()
  const tg = textos.gastos
  const t = tg.anotar
  const gente = integrantes([yo, ...personas.filter((p) => p.id !== yo.id)], yo.id)
  const nombres = nombresCortos(gente)
  const [antes] = useState(() => (gasto ? datosGuardados(gasto, partes) : undefined))
  const [borrador, setBorrador] = useState<Borrador>(() => (gasto ? borradorDe(gasto, partes) : borradorNuevo(yo.id, gente.map((p) => p.id))))
  const [errores, setErrores] = useState<Errores>({})
  const [boleta, setBoleta] = useState<Boleta>(gasto?.boleta ? { tipo: 'guardada', ruta: gasto.boleta } : { tipo: 'nada' })
  const [preparando, setPreparando] = useState(false)
  const [fotoMala, setFotoMala] = useState(false)
  const [eligiendo, setEligiendo] = useState<'pago' | 'categoria' | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [fallo, setFallo] = useState<'gasto' | 'foto' | null>(null)
  // Para no anotarlo dos veces si tocan el botón seguido, antes de que se vea "ocupado"
  const enviando = useRef(false)
  // Lo que ya quedó guardado en esta pantalla: si la foto no sube, reintentar no anota el gasto otra vez
  const guardado = useRef<{ gasto: Gasto; datos: DatosGasto } | null>(null)

  const cuenta = cuentaDe(borrador, gente.map((p) => p.id), yo.id, antes)
  const solo = borrador.division === 'solo'
  // "No se divide" es de quien lo anota: al editar el de otra persona no se ofrece
  const divisiones: readonly Division[] = !gasto || gasto.creado_por === yo.id ? DIVISIONES : DIVISIONES.filter((d) => d !== 'solo')
  const pagador = cuenta.pagador === yo.id ? tg.ti : (nombres.get(cuenta.pagador) ?? primerNombre(personas.find((p) => p.id === cuenta.pagador) ?? { nombre: null, correo: '' }))
  const titulo = gasto ? t.editar : t.titulo

  // "soloFormato": el mismo monto, ordenado al salir del campo; no corrige nada, así que los errores siguen
  const cambiar = (cambios: Partial<Borrador>, soloFormato = false) => {
    setBorrador((b) => {
      const nuevo = { ...b, ...cambios }
      // La categoría sigue a lo que se escribe, hasta que la eligen a mano
      if ('titulo' in cambios && !nuevo.categoriaFija) nuevo.categoria = categoriaDe(nuevo.titulo)
      return nuevo
    })
    if (soloFormato) return
    // Lo que se corrige deja de marcarse
    const reparte = 'exactos' in cambios || 'elegidos' in cambios || 'division' in cambios
    setErrores((e) => ({
      titulo: 'titulo' in cambios ? undefined : e.titulo,
      monto: 'monto' in cambios ? undefined : e.monto,
      personas: 'elegidos' in cambios || 'division' in cambios ? undefined : e.personas,
      partes: reparte ? undefined : e.partes,
      cuadra: reparte || 'monto' in cambios ? false : e.cuadra,
    }))
  }

  const dividir = () => {
    const division = divisiones[(divisiones.indexOf(borrador.division) + 1) % divisiones.length]
    // Al pasar a montos exactos sin ninguno escrito, cada uno parte con su parte igual
    const escritos = cuenta.marcados.some((id) => borrador.exactos[id]?.trim())
    if (division === 'exactos' && cuenta.total && !escritos) {
      cambiar({ division, exactos: { ...borrador.exactos, ...Object.fromEntries(cuenta.partes.map((p) => [p.persona, sinMoneda(p.monto)])) } })
    } else cambiar({ division })
  }

  // La foto se achica al elegirla, para mostrarla y subirla después de anotar
  const elegirFoto = async (archivo: File) => {
    setFotoMala(false)
    setPreparando(true)
    try {
      setBoleta({ tipo: 'nueva', foto: await prepararBoleta(archivo) })
    } catch {
      setFotoMala(true)
    } finally {
      setPreparando(false)
    }
  }

  const enfocar = (e: Errores) => {
    const campo = e.titulo ? 'anotar-titulo' : e.monto ? 'anotar-monto' : e.partes?.length ? `anotar-parte-${e.partes[0]}` : e.cuadra ? `anotar-parte-${cuenta.marcados[0]}` : null
    if (campo) document.getElementById(campo)?.focus()
    else if (e.personas) document.querySelector<HTMLElement>('#anotar-entre input[type="checkbox"]')?.focus()
  }

  const guardar = async () => {
    if (enviando.current || preparando) return
    const nuevos = validar(borrador, cuenta, t)
    setErrores(nuevos)
    if (hayErrores(nuevos)) return enfocar(nuevos)
    const datos = datosDe(borrador, cuenta)
    const base = guardado.current ?? (gasto && antes ? { gasto, datos: antes } : null)
    const cambiaFoto = boleta.tipo === 'nueva' || (boleta.tipo === 'nada' && Boolean(base?.gasto.boleta))
    // Al editar sin cambiar nada, solo se vuelve
    if (base && !guardado.current && !cambiaFoto && mismosDatos(datos, base.datos)) return onCerrar()
    enviando.current = true
    setGuardando(true)
    setFallo(null)
    const terminar = () => {
      enviando.current = false
      setGuardando(false)
    }
    let listo: Gasto
    try {
      listo = !base ? await anotarGasto(datos) : mismosDatos(datos, base.datos) ? base.gasto : await cambiarGasto(base.gasto.id, datos)
      guardado.current = { gasto: listo, datos }
    } catch {
      terminar()
      setFallo('gasto')
      return
    }
    // La foto va cuando el gasto ya existe
    try {
      if (boleta.tipo === 'nueva') await subirBoleta(listo, boleta.foto)
      else if (boleta.tipo === 'nada' && listo.boleta) await quitarBoleta(listo)
    } catch {
      terminar()
      setFallo('foto')
      return
    }
    terminar()
    onListo(listo, gasto ? 'guardado' : 'anotado')
  }

  const error = (id: string, texto: string | undefined, sangria: boolean) =>
    texto && (
      <div id={id} className={`${estilos.error} ${sangria ? estilos.sangria : ''}`} role="alert">
        <Icono nombre="alerta" medida={15} trazo={2} />
        {texto}
      </div>
    )

  const elegirPago = (
    <AnotarQuienPago
      computador={computador}
      abierto={eligiendo === 'pago'}
      gente={gente}
      nombres={nombres}
      yo={yo.id}
      elegido={cuenta.pagador}
      onElegir={(persona) => {
        cambiar({ pagadoPor: persona })
        setEligiendo(null)
      }}
      onCerrar={() => setEligiendo(null)}
    />
  )
  const elegirCategoria = (
    <AnotarCategoria
      computador={computador}
      abierto={eligiendo === 'categoria'}
      elegida={borrador.categoria}
      onElegir={(categoria) => {
        cambiar({ categoria, categoriaFija: true })
        setEligiendo(null)
      }}
      onCerrar={() => setEligiendo(null)}
    />
  )

  const formulario = (
    <div className={estilos.formulario} data-computador={computador}>
      <div className={estilos.queFue}>
        <div className={estilos.ancla}>
          <button
            type="button"
            className={estilos.categoria}
            aria-label={t.cambiarCategoria(tg.categorias[borrador.categoria])}
            aria-haspopup="dialog"
            aria-expanded={eligiendo === 'categoria'}
            onClick={() => setEligiendo(eligiendo === 'categoria' ? null : 'categoria')}
          >
            <Icono nombre={iconoDe(borrador.categoria)} medida={24} />
          </button>
          {computador && elegirCategoria}
        </div>
        <input
          id="anotar-titulo"
          className={estilos.descripcion}
          value={borrador.titulo}
          placeholder={t.queFue}
          aria-label={t.queFue}
          aria-invalid={Boolean(errores.titulo)}
          aria-describedby={errores.titulo ? 'anotar-titulo-error' : undefined}
          autoComplete="off"
          enterKeyHint="next"
          autoFocus={computador && !gasto}
          onChange={(e) => cambiar({ titulo: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') document.getElementById('anotar-monto')?.focus()
          }}
        />
      </div>
      {error('anotar-titulo-error', errores.titulo, true)}

      <div className={estilos.monto}>
        <span className={estilos.moneda} aria-hidden="true">
          US$
        </span>
        <input
          id="anotar-monto"
          className={estilos.montoCampo}
          value={borrador.monto}
          placeholder={t.cero}
          aria-label={t.monto}
          aria-invalid={Boolean(errores.monto)}
          aria-describedby={errores.monto ? 'anotar-monto-error' : undefined}
          inputMode="decimal"
          autoComplete="off"
          maxLength={13}
          onChange={(e) => cambiar({ monto: soloMonto(e.target.value) })}
          onBlur={(e) => {
            const ordenado = ordenarMonto(e.target.value)
            if (ordenado !== e.target.value) cambiar({ monto: ordenado }, true)
          }}
        />
      </div>
      {error('anotar-monto-error', errores.monto, !computador)}

      <div className={estilos.frase}>
        {t.pagadoPor}{' '}
        <button
          type="button"
          className={estilos.fraseBoton}
          aria-disabled={solo}
          aria-haspopup="dialog"
          aria-expanded={eligiendo === 'pago'}
          onClick={() => {
            if (!solo) setEligiendo(eligiendo === 'pago' ? null : 'pago')
          }}
        >
          {pagador}
        </button>{' '}
        {solo ? t.y : t.yDividido}{' '}
        <span className={estilos.juntos}>
          <button type="button" className={estilos.fraseBoton} onClick={dividir}>
            {t.divisiones[borrador.division]}
          </button>
          .
        </span>
        {computador && elegirPago}
      </div>

      <AnotarFechaFoto
        computador={computador}
        fecha={borrador.fecha}
        boleta={boleta}
        onFecha={(fecha) => cambiar({ fecha })}
        onArchivo={(archivo) => void elegirFoto(archivo)}
        onQuitar={() => {
          setFotoMala(false)
          setBoleta({ tipo: 'nada' })
        }}
      />
      {error('anotar-foto-error', fotoMala ? t.noSeAbrio : undefined, false)}

      <AnotarEntreQuienes computador={computador} borrador={borrador} cuenta={cuenta} gente={gente} nombres={nombres} yo={yo.id} errores={errores} onCambio={cambiar} />
    </div>
  )

  const boton = (
    <BotonPrincipal onClick={() => void guardar()} ocupado={guardando || preparando}>
      {gasto ? t.guardar : t.anotar}
    </BotonPrincipal>
  )
  // Anotar un gasto nuevo sin señal sí se puede: queda en este celular y sube cuando vuelva la conexión
  const seSube = !conectado && !gasto && <div className={estilos.seSube}>{t.seSube}</div>
  const noSeGuardo = fallo && (
    <div className={estilos.fallo} role="alert">
      {fallo === 'foto' ? t.sinFoto : textos.noSeGuardo}
    </div>
  )

  if (computador) {
    return (
      <PanelEncima
        etiqueta={titulo}
        onCerrar={onCerrar}
        cabecera={
          <div className={estilos.cabeceraPanel}>
            <h2 className={estilos.tituloPanel}>{titulo}</h2>
            <SinConexion />
          </div>
        }
        pie={
          <div className={estilos.piePanel}>
            {boton}
            {seSube}
            {noSeGuardo}
          </div>
        }
      >
        {formulario}
      </PanelEncima>
    )
  }

  return (
    <>
      <PantallaConPie
        encima
        pie={
          <>
            {boton}
            {seSube}
            {noSeGuardo}
          </>
        }
      >
        <div className={estilos.cabeza}>
          <div className={estilos.cabezaFila}>
            <button type="button" className={estilos.cancelar} onClick={onCerrar}>
              {textos.cancelar}
            </button>
            <SinConexion sobrePanel />
          </div>
          <h1 className={estilos.titulo}>{titulo}</h1>
        </div>
        {formulario}
      </PantallaConPie>
      {elegirPago}
      {elegirCategoria}
    </>
  )
}
