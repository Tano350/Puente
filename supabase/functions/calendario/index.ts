// Función "calendario": la llama la base cada 10 minutos (pg_cron + pg_net) con la clave en "x-puente-clave"; sin esa
// clave no hace nada. Escribe en el calendario "The Bridge" de cada uno los eventos a los que va y guarda cuándo está
// ocupado cada uno según ese calendario. Entra a Google como quien administra, con el permiso guardado en Vault.
// Responde cuántas operaciones hizo de cada tipo y qué calendarios "The Bridge" falta asignar (sinDueno).
import postgres from 'npm:postgres@3.4.9'
import { cruzar, DESDE, HASTA, sinDueno, type CalendarioDe, type Evento, type Operacion, type Va } from './cruce.ts'
import { ErrorGoogle, google, pedirToken, RECONECTAR, type EventoGoogle, type Google } from './google.ts'

type Sql = ReturnType<typeof postgres>
type Conteo = Record<Operacion['tipo'] | 'errores', number>

// Falta una variable de entorno; el mensaje solo la nombra
class FaltaConfigurar extends Error {}

Deno.serve(async (pedido) => {
  if (!(await esLaClave(pedido.headers.get('x-puente-clave')))) return Response.json({ error: 'No autorizado.' }, { status: 401 })
  try {
    const { conteo, faltan } = await sincronizar()
    console.log('calendario:', JSON.stringify(conteo))
    if (conteo.errores > 0) return Response.json({ error: 'Algunas operaciones fallaron.', ...conteo, sinDueno: faltan }, { status: 500 })
    return Response.json({ ...conteo, sinDueno: faltan })
  } catch (error) {
    console.error('calendario:', error instanceof Error ? error.message : error)
    const corto = error instanceof ErrorGoogle || error instanceof FaltaConfigurar ? error.message : 'Falló la sincronización.'
    return Response.json({ error: corto }, { status: 500 })
  }
})

async function sincronizar() {
  const cliente = { client_id: variable('GOOGLE_CLIENT_ID'), client_secret: variable('GOOGLE_CLIENT_SECRET') }
  // La base con todos los permisos, por la dirección que Supabase le da a cada función
  const sql = postgres(variable('SUPABASE_DB_URL'), { prepare: false, max: 1 })
  try {
    // Sin el permiso de Google no se escribe nada
    const [guardado] = await sql<{ decrypted_secret: string | null }[]>`select decrypted_secret from vault.decrypted_secrets where name = 'google_acceso'`
    if (!guardado?.decrypted_secret) throw new ErrorGoogle(401, RECONECTAR)
    const g = google(await pedirToken({ ...cliente, refresh_token: guardado.decrypted_secret }))
    const { eventos, van, calendarios, ocupados } = await leerPuente(sql)

    const conteo: Conteo = { crear: 0, actualizar: 0, borrar: 0, ocupados: 0, errores: 0 }
    const fallo = (que: string, error: unknown) => {
      conteo.errores++
      console.error(`calendario: ${que}:`, error instanceof Error ? error.message : error)
    }
    // Cada calendario se lee por separado: si uno no se puede leer, ese queda como estaba y los demás siguen
    const listas = new Map<string, EventoGoogle[]>()
    await Promise.all(
      calendarios.map(async ({ google_id }) => {
        try {
          listas.set(google_id, await g.listar(google_id, DESDE, HASTA))
        } catch (error) {
          fallo(`leer ${google_id}`, error)
        }
      }),
    )
    let faltan: ReturnType<typeof sinDueno> | null = null
    try {
      faltan = sinDueno(await g.calendarios(), calendarios)
    } catch (error) {
      fallo('listar los calendarios', error)
    }
    // De a una: si una falla (por ejemplo, alguien no dio permiso para cambiar eventos), las demás siguen
    for (const op of cruzar({ eventos, van, calendarios, ocupados, listas })) {
      try {
        await aplicar(op, sql, g)
        conteo[op.tipo]++
      } catch (error) {
        fallo(op.tipo === 'ocupados' ? `ocupados de ${op.persona}` : `${op.tipo} en ${op.calendario}`, error)
      }
    }
    return { conteo, faltan }
  } finally {
    await sql.end()
  }
}

async function leerPuente(sql: Sql) {
  const [eventos, van, calendarios, ocupados] = await Promise.all([
    sql<(Omit<Evento, 'inicio' | 'fin'> & { inicio: Date; fin: Date })[]>`
      select id, titulo, lugar, direccion, notas, inicio, fin from public.eventos where cancelado_en is null`,
    // Solo los que van (no la lista de espera) y siguen en Puente
    sql<Va[]>`
      select a.evento, a.persona from public.asistentes a join public.personas p on p.id = a.persona
       where a.estado = 'va' and p.sacada_en is null`,
    sql<CalendarioDe[]>`select persona, google_id from public.calendarios`,
    sql<{ persona: string; inicio: Date; fin: Date }[]>`select persona, inicio, fin from public.ocupados_google`,
  ])
  return {
    eventos: eventos.map((e) => ({ ...e, inicio: e.inicio.toISOString(), fin: e.fin.toISOString() })),
    van,
    calendarios,
    ocupados: ocupados.map((o) => ({ persona: o.persona, inicio: o.inicio.toISOString(), fin: o.fin.toISOString() })),
  }
}

async function aplicar(op: Operacion, sql: Sql, g: Google): Promise<void> {
  switch (op.tipo) {
    case 'crear':
      return g.crear(op.calendario, op.cuerpo)
    case 'actualizar':
      return g.guardar(op.calendario, op.googleId, op.cuerpo)
    case 'borrar':
      return g.borrar(op.calendario, op.googleId)
    case 'ocupados':
      await sql.begin(async (tx) => {
        await tx`delete from public.ocupados_google where persona = ${op.persona}`
        if (op.ratos.length > 0) await tx`insert into public.ocupados_google ${tx(op.ratos.map((r) => ({ persona: op.persona, ...r })))}`
      })
      return
  }
}

function variable(nombre: string): string {
  const valor = Deno.env.get(nombre)
  if (!valor) throw new FaltaConfigurar(`Falta ${nombre}.`)
  return valor
}

// Compara huellas de la clave, para no dejar ver por el tiempo cuánto se acertó
async function esLaClave(recibida: string | null): Promise<boolean> {
  const clave = Deno.env.get('CALENDARIO_CLAVE')
  if (!clave) console.error('calendario: falta CALENDARIO_CLAVE')
  if (!clave || !recibida) return false
  const [a, b] = await Promise.all([clave, recibida].map(async (t) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)))))
  return a.reduce((distinto, byte, i) => distinto | (byte ^ b[i]), 0) === 0
}
