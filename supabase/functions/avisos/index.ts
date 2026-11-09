// Función "avisos": manda los avisos push que la base dejó en public.avisos. La despiertan los triggers de la base
// (al encolar algo) y el reloj de cada 5 minutos (que además reintenta lo que falló), siempre con
// "Authorization: Bearer <AVISOS_CLAVE>"; sin esa clave no hace nada. En cada vuelta:
// 1. Reclama una tanda de avisos listos para salir (un UPDATE … RETURNING con SKIP LOCKED: dos vueltas a la vez nunca
//    toman el mismo) junto con lo que hace falta para escribirlos.
// 2. Revisa que cada uno siga teniendo sentido y lo escribe en el idioma de quien lo recibe (mensajes.ts).
// 3. Lo manda cifrado a cada dispositivo de esa persona (webpush.ts). Si el servicio responde 404 o 410, ese
//    dispositivo ya no existe y se borra su suscripción.
// 4. Lo marca enviado, descartado o con el error (se reintenta en la próxima vuelta, hasta 5 intentos).
// Si quedan avisos que todavía esperan sus 10 segundos para "Deshacer", espera y da otra vuelta.
import postgres from 'npm:postgres@3.4.9'
import { armar, type Fila, type Mensaje } from './mensajes.ts'
import { llavesVapid, pedidoPush, type Suscripcion, type Vapid } from './webpush.ts'

type Sql = ReturnType<typeof postgres>
type Dispositivo = Suscripcion & { persona: string }
type Cuenta = { enviados: number; descartados: number; fallidos: number; dispositivosBorrados: number }

const MAXIMO_INTENTOS = 5
const TANDA = 50
// Cuánto puede esperar una vuelta a los avisos que todavía no salen, antes de dejárselos al reloj
const ESPERA_MAXIMA_MS = 40_000

// Falta una variable de entorno; el mensaje solo la nombra
class FaltaConfigurar extends Error {}

Deno.serve(async (pedido) => {
  if (!(await esLaClave(pedido.headers.get('authorization')))) return Response.json({ error: 'No autorizado.' }, { status: 401 })
  try {
    const cuenta = await repartir()
    console.log('avisos:', JSON.stringify(cuenta))
    if (cuenta.fallidos > 0) return Response.json({ error: 'Algunos avisos no salieron.', ...cuenta }, { status: 500 })
    return Response.json(cuenta)
  } catch (error) {
    console.error('avisos:', error instanceof Error ? error.message : error)
    const corto = error instanceof FaltaConfigurar ? error.message : 'No se pudieron mandar los avisos.'
    return Response.json({ error: corto }, { status: 500 })
  }
})

async function repartir(): Promise<Cuenta> {
  const vapid = await llavesVapid(variable('VAPID_PUBLIC_KEY'), variable('VAPID_PRIVATE_KEY'), variable('VAPID_SUBJECT')).catch((error) => {
    throw new FaltaConfigurar(error instanceof Error ? error.message : String(error))
  })
  // La base con todos los permisos, por la dirección que Supabase le da a cada función
  const sql = postgres(variable('SUPABASE_DB_URL'), { prepare: false, max: 1 })
  const cuenta: Cuenta = { enviados: 0, descartados: 0, fallidos: 0, dispositivosBorrados: 0 }
  const limite = Date.now() + ESPERA_MAXIMA_MS
  try {
    for (;;) {
      const tanda = await reclamar(sql)
      if (tanda.length > 0) await mandarTanda(sql, vapid, tanda, cuenta)
      if (tanda.length === TANDA) continue
      // ¿Hay avisos que todavía esperan sus 10 segundos? Si salen pronto, se espera por ellos
      const [proximo] = await sql<{ falta: number | null }[]>`
        select extract(epoch from min(sale_en) - now())::float8 as falta from public.avisos
         where enviado_en is null and descartado is null and intentos = 0 and sale_en > now()`
      const falta = proximo?.falta
      if (falta === null || falta === undefined || Date.now() + falta * 1000 > limite) break
      await new Promise((listo) => setTimeout(listo, Math.max(0, falta * 1000) + 250))
    }
    return cuenta
  } finally {
    await sql.end()
  }
}

// Toma los avisos listos para salir y trae lo necesario para escribirlos
async function reclamar(sql: Sql): Promise<Fila[]> {
  return await sql<Fila[]>`
    with reclamados as (
      update public.avisos v
         set intentos = v.intentos + 1, reclamado_hasta = now() + interval '2 minutes'
       where v.id in (
         select x.id from public.avisos x
          where x.enviado_en is null and x.descartado is null and x.intentos < ${MAXIMO_INTENTOS}
            and x.sale_en <= now() and (x.reclamado_hasta is null or x.reclamado_hasta < now())
          order by x.sale_en
          limit ${TANDA}
          for update skip locked
       )
      returning v.id, v.tipo, v.persona, v.datos, v.creado_en, v.evento, v.contacto, v.pago, v.tarea
    )
    select r.id, r.tipo, r.persona, r.datos, r.creado_en,
           p.idioma, p.sacada_en is not null as sacada,
           -- 'sumado' se apaga con el interruptor de 'cambios'; 'tarea' y 'vence', con el de 'tareas'
           (p.avisos -> case when r.tipo = 'sumado' then 'cambios' when r.tipo in ('tarea', 'vence') then 'tareas' else r.tipo end)
             is distinct from 'false'::jsonb as quiere,
           e.id as evento_id, e.titulo, e.lugar, e.direccion, e.inicio, e.fin, e.modo, e.cupos, e.cancelado_en,
           (select a.estado from public.asistentes a where a.evento = e.id and a.persona = r.persona) as estado,
           (select count(*)::int from public.asistentes a where a.evento = e.id and a.estado = 'va') as van,
           (select q.nombre from public.personas q where r.tipo = 'sumado' and q.id = (r.datos ->> 'quien')::uuid) as suma,
           c.id as contacto_id, c.nombre as contacto_nombre, c.organizacion, c.responsable, asigna.nombre as asigna,
           g.id as pago_id, g.monto, g.borrado_en, de.nombre as paga,
           -- La fecha como texto ("2027-01-18"): es un día de California, sin hora
           t.id as tarea_id, t.titulo as tarea_titulo, t.para::text as para, t.borrada_en as tarea_borrada,
           exists (select 1 from public.asignados x where x.tarea = t.id and x.persona = r.persona) as asignado,
           -- En "cada uno", su parte; si basta con uno, si alguien la marcó
           case when t.cada_uno
                then exists (select 1 from public.asignados x where x.tarea = t.id and x.persona = r.persona and x.hecha_en is not null)
                else exists (select 1 from public.asignados x where x.tarea = t.id and x.hecha_en is not null)
           end as hecha,
           (select q.nombre from public.personas q where r.tipo = 'tarea' and q.id = (r.datos ->> 'quien')::uuid) as encarga
      from reclamados r
      join public.personas p on p.id = r.persona
      left join public.eventos e on e.id = r.evento
      left join public.contactos c on c.id = r.contacto
      left join public.personas asigna on asigna.id = c.asignado_por
      left join public.pagos g on g.id = r.pago
      left join public.personas de on de.id = g.de
      left join public.tareas t on t.id = r.tarea`
}

async function mandarTanda(sql: Sql, vapid: Vapid, tanda: Fila[], cuenta: Cuenta): Promise<void> {
  const ahora = new Date()
  const listos: { fila: Fila; mensaje: Mensaje }[] = []
  for (const fila of tanda) {
    const r = armar(fila, ahora)
    if ('descartar' in r) {
      await sql`update public.avisos set descartado = ${r.descartar} where id = ${fila.id}`
      cuenta.descartados++
    } else {
      listos.push({ fila, mensaje: r.mensaje })
    }
  }
  if (listos.length === 0) return
  const personas = [...new Set(listos.map((l) => l.fila.persona))]
  const dispositivos = await sql<Dispositivo[]>`
    select endpoint, persona, p256dh, auth from public.suscripciones where persona in ${sql(personas)}`
  const borrados = new Set<string>()

  for (const { fila, mensaje } of listos) {
    const suyos = dispositivos.filter((d) => d.persona === fila.persona && !borrados.has(d.endpoint))
    const contenido = JSON.stringify({ titulo: mensaje.titulo, cuerpo: mensaje.cuerpo, url: mensaje.url, etiqueta: mensaje.etiqueta })
    const errores: string[] = []
    let llegaron = 0
    for (const d of suyos) {
      const estado = await mandar(d, contenido, mensaje, vapid)
      if (estado.tipo === 'llego') llegaron++
      else if (estado.tipo === 'ya_no_existe') {
        await sql`delete from public.suscripciones where endpoint = ${d.endpoint}`
        borrados.add(d.endpoint)
        cuenta.dispositivosBorrados++
      } else errores.push(estado.error)
    }
    const error = errores.length > 0 ? errores.join(' | ').slice(0, 500) : null
    if (llegaron > 0) {
      // Llegó al menos a un dispositivo: no se reintenta (repetiría el aviso en los que sí llegó)
      await sql`update public.avisos set enviado_en = now(), ultimo_error = ${error} where id = ${fila.id}`
      cuenta.enviados++
    } else if (errores.length === 0) {
      await sql`update public.avisos set descartado = ${'Sin dispositivos.'} where id = ${fila.id}`
      cuenta.descartados++
    } else {
      // Queda pendiente: la próxima vuelta del reloj lo reintenta, hasta 5 intentos
      await sql`update public.avisos set ultimo_error = ${error} where id = ${fila.id}`
      cuenta.fallidos++
    }
  }
}

type Entrega = { tipo: 'llego' } | { tipo: 'ya_no_existe' } | { tipo: 'fallo'; error: string }

async function mandar(d: Dispositivo, contenido: string, mensaje: Mensaje, vapid: Vapid): Promise<Entrega> {
  const servicio = (() => {
    try {
      return new URL(d.endpoint).host
    } catch {
      return 'dirección inválida'
    }
  })()
  try {
    const { url, init } = await pedidoPush(d, contenido, vapid, { ttl: mensaje.ttl, urgencia: mensaje.urgencia })
    const respuesta = await fetch(url, init)
    const detalle = respuesta.ok ? '' : (await respuesta.text().catch(() => '')).slice(0, 200)
    if (respuesta.ok) return { tipo: 'llego' }
    if (respuesta.status === 404 || respuesta.status === 410) return { tipo: 'ya_no_existe' }
    return { tipo: 'fallo', error: `${servicio} respondió ${respuesta.status}${detalle ? `: ${detalle}` : ''}` }
  } catch (error) {
    return { tipo: 'fallo', error: `${servicio}: ${error instanceof Error ? error.message : String(error)}` }
  }
}

function variable(nombre: string): string {
  const valor = Deno.env.get(nombre)
  if (!valor) throw new FaltaConfigurar(`Falta ${nombre}.`)
  return valor
}

// "Bearer <clave>". Compara huellas de la clave, para no dejar ver por el tiempo cuánto se acertó.
async function esLaClave(encabezado: string | null): Promise<boolean> {
  const clave = Deno.env.get('AVISOS_CLAVE')
  if (!clave) console.error('avisos: falta AVISOS_CLAVE')
  const recibida = encabezado?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim()
  if (!clave || !recibida) return false
  const [a, b] = await Promise.all([clave, recibida].map(async (t) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)))))
  return a.reduce((distinto, byte, i) => distinto | (byte ^ b[i]), 0) === 0
}
