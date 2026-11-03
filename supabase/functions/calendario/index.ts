// Función "calendario": cruza la Agenda de Puente con el calendario compartido de Google. La llama la base cada
// 10 minutos (pg_cron + pg_net) con la clave en "x-puente-clave"; sin esa clave no hace nada.
// Responde cuántas operaciones hizo de cada tipo. Solo lee public.eventos: los ratos ocupados nunca van a Google.
import postgres from 'npm:postgres@3.4.9'
import { cruzar, DESDE, HASTA, type FilaEvento, type Operacion } from './cruce.ts'
import { calendario, ErrorGoogle, pedirToken, type Calendario, type CuentaDeServicio } from './google.ts'

type Sql = ReturnType<typeof postgres>
type Conteo = Record<Operacion['tipo'] | 'errores', number>

// Falta o está mal una variable de entorno; el mensaje solo nombra la variable
class FaltaConfigurar extends Error {}

Deno.serve(async (pedido) => {
  if (!(await esLaClave(pedido.headers.get('x-puente-clave')))) return Response.json({ error: 'No autorizado.' }, { status: 401 })
  try {
    const conteo = await sincronizar()
    console.log('calendario:', JSON.stringify(conteo))
    if (conteo.errores > 0) return Response.json({ error: 'Algunas operaciones fallaron.', ...conteo }, { status: 500 })
    return Response.json(conteo)
  } catch (error) {
    console.error('calendario:', error instanceof Error ? error.message : error)
    const corto = error instanceof ErrorGoogle || error instanceof FaltaConfigurar ? error.message : 'Falló la sincronización.'
    return Response.json({ error: corto }, { status: 500 })
  }
})

async function sincronizar(): Promise<Conteo> {
  const cuenta = cuentaDeServicio()
  const calendarioId = variable('GOOGLE_CALENDARIO_ID')
  // La base con todos los permisos, por la dirección que Supabase le da a cada función
  const sql = postgres(variable('SUPABASE_DB_URL'), { prepare: false, max: 1 })
  try {
    const google = calendario(await pedirToken(cuenta), calendarioId)
    const [filas, eventos] = await Promise.all([leerEventos(sql), google.listar(DESDE, HASTA)])
    const conteo: Conteo = { crear: 0, actualizar: 0, borrar: 0, enlazar: 0, traer: 0, cambiar: 0, cancelar: 0, errores: 0 }
    // De a una: si una falla, las demás siguen y la vuelta siguiente la vuelve a intentar
    for (const op of cruzar(filas, eventos)) {
      try {
        await aplicar(op, sql, google)
        conteo[op.tipo]++
      } catch (error) {
        conteo.errores++
        console.error(`calendario: ${op.tipo}:`, error instanceof Error ? error.message : error)
      }
    }
    return conteo
  } finally {
    await sql.end()
  }
}

async function leerEventos(sql: Sql): Promise<FilaEvento[]> {
  const filas = await sql<(Omit<FilaEvento, 'inicio' | 'fin' | 'cancelado_en'> & { inicio: Date; fin: Date; cancelado_en: Date | null })[]>`
    select id, titulo, lugar, direccion, notas, inicio, fin, google_id, desde_google, cancelado_en from public.eventos`
  return filas.map((f) => ({ ...f, inicio: f.inicio.toISOString(), fin: f.fin.toISOString(), cancelado_en: f.cancelado_en?.toISOString() ?? null }))
}

async function aplicar(op: Operacion, sql: Sql, google: Calendario): Promise<void> {
  switch (op.tipo) {
    case 'crear':
      return enlazar(sql, op.evento, (await google.crear(op.cuerpo)).id)
    case 'actualizar': {
      const copia = await google.guardar(op.googleId, op.cuerpo)
      // Google lo había perdido y quedó con otro id
      if (copia.id !== op.googleId) await enlazar(sql, op.evento, copia.id)
      return
    }
    case 'borrar':
      return google.borrar(op.googleId)
    case 'enlazar':
      return enlazar(sql, op.evento, op.googleId)
    case 'traer':
      await sql`insert into public.eventos ${sql(op.fila)} on conflict (google_id) do nothing`
      return
    case 'cambiar':
      await sql`update public.eventos set ${sql(op.cambios)} where id = ${op.evento} and desde_google`
      return
    case 'cancelar':
      await sql`update public.eventos set cancelado_en = now() where id = ${op.evento} and desde_google and cancelado_en is null`
      return
  }
}

async function enlazar(sql: Sql, evento: string, googleId: string): Promise<void> {
  await sql`update public.eventos set google_id = ${googleId} where id = ${evento} and not desde_google`
}

function cuentaDeServicio(): CuentaDeServicio {
  const json = variable('GOOGLE_CUENTA')
  let cuenta: Partial<CuentaDeServicio> | null = null
  try {
    cuenta = JSON.parse(json)
  } catch {
    // El mensaje de JSON.parse puede traer un pedazo de la llave: no se muestra
  }
  if (typeof cuenta?.client_email !== 'string' || typeof cuenta.private_key !== 'string') {
    throw new FaltaConfigurar('GOOGLE_CUENTA no es el JSON de la cuenta de servicio.')
  }
  return { client_email: cuenta.client_email, private_key: cuenta.private_key }
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
