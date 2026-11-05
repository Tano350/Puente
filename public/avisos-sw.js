// Avisos push de Puente. El service worker de la app lo importa con importScripts.
// El servidor manda JSON: { titulo, cuerpo, url, etiqueta }.

const ICONO = '/iconos/icono-192.png'
const INSIGNIA = '/iconos/insignia-96.png'

function leerAviso(evento) {
  const base = { titulo: 'Puente', cuerpo: 'Tienes un aviso nuevo.', url: '/hoy', etiqueta: undefined }
  try {
    const datos = evento.data ? evento.data.json() : null
    if (!datos || typeof datos !== 'object') return base
    return {
      titulo: typeof datos.titulo === 'string' && datos.titulo ? datos.titulo : base.titulo,
      cuerpo: typeof datos.cuerpo === 'string' && datos.cuerpo ? datos.cuerpo : base.cuerpo,
      // Solo rutas de la propia app
      url: typeof datos.url === 'string' && datos.url.startsWith('/') && !datos.url.startsWith('//') ? datos.url : base.url,
      etiqueta: typeof datos.etiqueta === 'string' && datos.etiqueta ? datos.etiqueta : undefined,
    }
  } catch {
    return base
  }
}

// Siempre se muestra un aviso: el iPhone corta los avisos de una app que recibe push sin mostrar nada.
self.addEventListener('push', (evento) => {
  const aviso = leerAviso(evento)
  evento.waitUntil(
    self.registration.showNotification(aviso.titulo, {
      body: aviso.cuerpo,
      icon: ICONO,
      badge: INSIGNIA,
      tag: aviso.etiqueta,
      data: { url: aviso.url },
    }),
  )
})

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close()
  const destino = new URL(evento.notification.data?.url ?? '/hoy', self.location.origin).href
  evento.waitUntil(
    (async () => {
      const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const abierta = ventanas.find((v) => new URL(v.url).origin === self.location.origin)
      if (abierta) {
        const enfocada = await abierta.focus().catch(() => abierta)
        // navigate puede fallar (p. ej. en iPhone); entonces se abre una ventana nueva
        const llegada = await (enfocada ?? abierta).navigate(destino).catch(() => null)
        if (llegada) return
      }
      await self.clients.openWindow(destino)
    })(),
  )
})

// El navegador cambió o venció la suscripción: se renueva con la misma llave.
// Aquí no hay sesión; la app guarda la nueva suscripción la próxima vez que se abre.
self.addEventListener('pushsubscriptionchange', (evento) => {
  const anterior = evento.oldSubscription
  const llave = evento.newSubscription?.options?.applicationServerKey ?? anterior?.options?.applicationServerKey
  if (evento.newSubscription || !llave) return
  evento.waitUntil(self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: llave }).catch(() => null))
})
