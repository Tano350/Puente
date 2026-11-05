// Íconos de trazo del lienzo, en una grilla de 24.
const trazos = {
  hoy: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M3 12h1M12 3v1M20 12h1M12 20v1M5.6 5.6l.7.7M18.4 5.6l-.7.7M17.7 17.7l.7.7M6.3 17.7l-.7.7" />
    </>
  ),
  agenda: (
    <>
      <rect x="4" y="5" width="16" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M4 11h16" />
    </>
  ),
  contactos: (
    <>
      <rect x="6" y="3" width="14" height="18" rx="2" />
      <path d="M10 16h6" />
      <circle cx="13" cy="10" r="2" />
      <path d="M4 8h3M4 12h3M4 16h3" />
    </>
  ),
  gastos: (
    <>
      <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16l-3-2-2 2-2-2-2 2-2-2-3 2" />
      <path d="M9 7h6M9 11h6M9 15h4" />
    </>
  ),
  grupo: (
    <>
      <circle cx="9" cy="7" r="4" />
      <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2M16 3.13a4 4 0 0 1 0 7.75M21 21v-2a4 4 0 0 0-3-3.85" />
    </>
  ),
  perfil: (
    <>
      <circle cx="12" cy="7" r="4" />
      <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
    </>
  ),
  izquierda: <path d="M15 6l-6 6l6 6" />,
  derecha: <path d="M9 6l6 6l-6 6" />,
  abajo: <path d="M6 9l6 6l6-6" />,
  check: <path d="M5 12l5 5L20 7" />,
  cerrar: <path d="M6 6l12 12M18 6L6 18" />,
  mas: <path d="M12 5v14M5 12h14" />,
  lapiz: (
    <>
      <path d="M4 20h4L18.5 9.5a2.83 2.83 0 0 0-4-4L4 16v4" />
      <path d="M13.5 6.5l4 4" />
    </>
  ),
  linkedin: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 11v5M8 8v.01M12 16v-5M16 16v-3a2 2 0 0 0-4 0" />
    </>
  ),
  compartir: <path d="M8 9H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1M12 14V3M9 6l3-3l3 3" />,
  agregarInicio: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M12 8v8M8 12h8" />
    </>
  ),
  alerta: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4M12 16h.01" />
    </>
  ),
  avisos: (
    <>
      <path d="M10 5a2 2 0 1 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3H4a4 4 0 0 0 2-3v-3a7 7 0 0 1 4-6" />
      <path d="M9 17v1a3 3 0 0 0 6 0v-1" />
    </>
  ),
  sinSenal: <path d="M12 18h.01M9.17 15.17a4 4 0 0 1 5.66 0M6.34 12.34a8 8 0 0 1 3.87-2.14M14.37 10.36a8 8 0 0 1 3.29 2M3.52 9.52a12 12 0 0 1 3.54-2.46M10.16 6.14a12 12 0 0 1 10.32 3.37M3 3l18 18" />,
  // Nube tachada: lo anotado sin señal que todavía no sube
  sinSubir: (
    <>
      <path d="M9.6 5.5a6 6 0 0 1 7.6 5h1A3.5 3.5 0 0 1 21 16.4M17.5 18H6.5A4.5 4.5 0 0 1 5.7 9.1" />
      <path d="M3 3l18 18" />
    </>
  ),
  instalar: (
    <>
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
      <path d="M7 11l5 5l5-5M12 4v12" />
    </>
  ),
  buscar: (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="M21 21l-6-6" />
    </>
  ),
  correo: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6l9-6" />
    </>
  ),
  opciones: (
    <>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </>
  ),
  copiar: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </>
  ),
  sacar: (
    <>
      <path d="M14 8V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-2" />
      <path d="M9 12h12l-3-3M18 15l3-3" />
    </>
  ),
  filtrar: (
    <>
      <path d="M4 6h8M16 6h4M4 12h2M10 12h10M4 18h11M19 18h1" />
      <circle cx="14" cy="6" r="2" />
      <circle cx="8" cy="12" r="2" />
      <circle cx="17" cy="18" r="2" />
    </>
  ),
  candado: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  telefono: <path d="M5 4h4l2 5l-2.5 1.5a11 11 0 0 0 5 5l1.5-2.5l5 2v4a2 2 0 0 1-2 2a16 16 0 0 1-15-15a2 2 0 0 1 2-2" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8h.01M11 12h1v4h1" />
    </>
  ),
  foto: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="10" r="1.5" />
      <path d="M21 16l-5-5L5 19" />
    </>
  ),
  google: <path d="M20.945 11a9 9 0 1 1-3.284-5.997l-2.655 2.392a5.5 5.5 0 1 0 2.119 6.605h-4.125v-3h7.945z" />,
  basura: <path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />,
  acercar: (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="M7 10h6M10 7v6M21 21l-6-6" />
    </>
  ),
  alejar: (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="M7 10h6M21 21l-6-6" />
    </>
  ),
  menos: <path d="M5 12h14" />,
  reloj: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </>
  ),
  lugar: (
    <>
      <path d="M9 11a3 3 0 1 0 6 0a3 3 0 0 0-6 0" />
      <path d="M17.66 16.66l-4.25 4.24a2 2 0 0 1-2.82 0l-4.25-4.24a8 8 0 1 1 11.32 0z" />
    </>
  ),
  ruta: <path d="M3 19a2 2 0 1 0 4 0a2 2 0 0 0-4 0M17 5a2 2 0 1 0 4 0a2 2 0 0 0-4 0M11 19h5.5a3.5 3.5 0 0 0 0-7h-8a3.5 3.5 0 0 1 0-7H13" />,
  transferir: <path d="M20 10H4l5.5-6M4 14h16l-5.5 6" />,
  camara: (
    <>
      <path d="M5 7h1a2 2 0 0 0 2-2a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1a2 2 0 0 0 2 2h1a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2" />
      <path d="M9 13a3 3 0 1 0 6 0a3 3 0 0 0-6 0" />
    </>
  ),
  // Categorías de los gastos ("otro" usa el de Gastos)
  auto: <path d="M5 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M15 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M5 17H3v-6l2-5h9l4 5h1a2 2 0 0 1 2 2v4h-2m-4 0H9m-6-6h15m-6 0V6" />,
  tren: <path d="M8 3h8a3 3 0 0 1 3 3v9a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V6a3 3 0 0 1 3-3zM5 11h14M9 15h.01M15 15h.01M8 19l-2 2M16 19l2 2" />,
  bici: <path d="M2 18a3 3 0 1 0 6 0a3 3 0 1 0 -6 0M16 18a3 3 0 1 0 6 0a3 3 0 1 0 -6 0M12 19v-4l-3-3l5-4l2 3h3M16 5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />,
  comida: <path d="M19 3v12h-5c-.02-3.68.18-7.41 5-12zm0 12v6h-1v-3M8 4v17M5 4v3a3 3 0 1 0 6 0V4" />,
  cafe: <path d="M3 10h14v5a6 6 0 0 1-6 6H9a6 6 0 0 1-6-6v-5zM16.75 16.73a3 3 0 1 0 .25-5.56M8 3a2.4 2.4 0 0 0-1 2a2.4 2.4 0 0 0 1 2M12 3a2.4 2.4 0 0 0-1 2a2.4 2.4 0 0 0 1 2" />,
  super: <path d="M4 19a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M15 19a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M17 17H6V3H4M6 5l14 1l-1 7H6" />,
  entrada: <path d="M15 5v2M15 11v2M15 17v2M5 5h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4V7a2 2 0 0 1 2-2" />,
  // Una cama
  alojamiento: <path d="M3 6v12M3 15h18M21 18v-5a3 3 0 0 0-3-3h-7v5M5 11a2 2 0 1 0 4 0a2 2 0 1 0-4 0" />,
}

export type NombreIcono = keyof typeof trazos

export function Icono({ nombre, medida = 24, trazo = 1.75 }: { nombre: NombreIcono; medida?: number; trazo?: number }) {
  return (
    <svg
      width={medida}
      height={medida}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={trazo}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flex: 'none' }}
    >
      {trazos[nombre]}
    </svg>
  )
}
