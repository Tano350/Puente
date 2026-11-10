// Función "calendario": la llama la base cada 10 minutos (pg_cron + pg_net) o cuando quien administra pide buscar
// calendarios, siempre con la clave en "x-puente-clave"; sin esa clave no hace nada. Entra a Google como quien
// administra, con el permiso guardado en Vault. En cada vuelta:
// 1. Anota en public.calendarios los calendarios del viaje que ve quien administra (solo nombres y permisos).
// 2. Solo si la sincronización está encendida: escribe en el calendario de cada uno los eventos a los que va (si quien
//    administra puede hacer cambios ahí) y guarda cuándo está ocupado. Apagada, no lee ni escribe en el de nadie.
// 3. Anota la vuelta en public.sincronizacion y responde cuántas operaciones hizo de cada tipo.
import postgres from 'npm:postgres@3.4.9'
import { cruzar, cruzarCalendarios, seLee, ventanaDeCruce, type CalendarioDe, type CalendarioGuardado, type Evento, type Operacion, type Va } from './cruce.ts'
import { ErrorGoogle, google, pedirToken, RECONECTAR, type EventoGoogle, type Google } from './google.ts'

type Sql = ReturnType<typeof postgres>
type Conteo = Record<Operacion['tipo'] | 'errores', number>
type Fallo = (que: string, error: unknown) => void

// Falta una variable de entorno; el mensaje solo la nombra
class FaltaConfigurar extends Error {}

Deno.serve(async (pedido) => {
  if (!(await esLaClave(pedido.headers.get('x-puente-clave')))) return Response.json({ error: 'No autorizado.' }, { status: 401 })
  try {
    const vuelta = await sincronizar()
    console.log('calendario:', JSON.stringify(vuelta))
    if (vuelta.errores > 0) return Response.json({ error: 'Algunas operaciones fallaron.', ...vuelta }, { status: 500 })
    return Response.json(vuelta)
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
    // Sin el permiso de Google no se escribe nada, ni siquiera el estado
    const [guardado] = await sql<{ decrypted_secret: string | null }[]>`select decrypted_secret from vault.decrypted_secrets where name = 'google_acceso'`
    if (!guardado?.decrypted_secret) throw new ErrorGoogle(401, RECONECTAR)
    const g = google(await pedirToken({ ...cliente, refresh_token: guardado.decrypted_secret }))

    const conteo: Conteo = { crear: 0, actualizar: 0, borrar: 0, ocupados: 0, errores: 0 }
    const fallo: Fallo = (que, error) => {
      conteo.errores++
      console.error(`calendario: ${que}:`, error instanceof Error ? error.message : error)
    }
    // 1. Los calendarios del viaje que ve quien administra; si la lista no se puede leer, la tabla queda como estaba
    let calendarios = 0
    try {
      calendarios = await anotarCalendarios(sql, g)
    } catch (error) {
      fallo('calendarios del viaje', error)
    }
    // 2. Solo con la sincronización encendida se leen y se escriben los calendarios de cada uno
    const [estado] = await sql<{ activa: boolean }[]>`select activa from public.sincronizacion`
    const activa = estado?.activa === true
    if (activa) await sincronizarEventos(sql, g, conteo, fallo)
    // 3. La vuelta queda anotada
    await sql`update public.sincronizacion set ultima_vez = now(), errores = ${conteo.errores}`
    return { calendarios, activa, ...conteo }
  } finally {
    await sql.end()
  }
}

// Anota los calendarios del viaje en public.calendarios y devuelve cuántos se vieron
async function anotarCalendarios(sql: Sql, g: Google): Promise<number> {
  const guardados = await sql<CalendarioGuardado[]>`select google_id, nombre, permiso, persona from public.calendarios`
  const { vistos, nuevos, cambiados, borrados } = cruzarCalendarios(await g.calendarios(), guardados)
  await sql.begin(async (tx) => {
    if (nuevos.length > 0) await tx`insert into public.calendarios ${tx(nuevos)} on conflict (google_id) do nothing`
    for (const c of cambiados) await tx`update public.calendarios set nombre = ${c.nombre}, permiso = ${c.permiso} where google_id = ${c.google_id}`
    if (vistos.length > 0) await tx`update public.calendarios set visto_en = now() where google_id in ${tx(vistos.map((c) => c.google_id))}`
    // Solo los que siguen sin dueño: si alguien acaba de asignar uno, se queda
    if (borrados.length > 0) await tx`delete from public.calendarios where persona is null and google_id in ${tx(borrados)}`
  })
  return vistos.length
}

// Copias de los eventos en el calendario de cada uno y sus ratos ocupados, para los calendarios asignados
async function sincronizarEventos(sql: Sql, g: Google, conteo: Conteo, fallo: Fallo): Promise<void> {
  const { eventos, van, calendarios, ocupados } = await leerPuente(sql)
  // La ventana cubre también las estadías de quienes siguen en Puente y todos los eventos, sean de la fecha que sean
  const [estadias] = await sql<{ llega: string | null; vuelve: string | null }[]>`
    select to_char(min(llega), 'YYYY-MM-DD') as llega, to_char(max(vuelve), 'YYYY-MM-DD') as vuelve
      from public.personas where sacada_en is null`
  const ventana = ventanaDeCruce(estadias?.llega, estadias?.vuelve, eventos)
  // Cada calendario se lee por separado: si uno no se puede leer, ese queda como estaba y los demás siguen.
  // Los de "solo libre u ocupado" no se leen.
  const listas = new Map<string, EventoGoogle[]>()
  await Promise.all(
    calendarios.filter((c) => seLee(c.permiso)).map(async ({ google_id }) => {
      try {
        listas.set(google_id, await g.listar(google_id, ventana.desde, ventana.hasta))
      } catch (error) {
        fallo(`leer ${google_id}`, error)
      }
    }),
  )
  // De a una: si una falla (por ejemplo, alguien no dio permiso para cambiar eventos), las demás siguen
  for (const op of cruzar({ eventos, van, calendarios, ocupados, listas, ventana })) {
    try {
      await aplicar(op, sql, g)
      conteo[op.tipo]++
    } catch (error) {
      fallo(op.tipo === 'ocupados' ? `ocupados de ${op.persona}` : `${op.tipo} en ${op.calendario}`, error)
    }
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
    sql<CalendarioDe[]>`select persona, google_id, permiso from public.calendarios where persona is not null`,
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
