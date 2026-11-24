// Las cuentas del movimiento, sin pantalla: se prueban con node --test src/movimiento/fisica.test.ts

// Cuánto se mueve Puente: la intensidad B, "Con jugo", elegida en la maqueta el 2026-11-24
export const NIVEL = {
  // El resorte: rigidez y amortiguación. Con 25 rebota un poco; sin rebote sería 2·√430 ≈ 41
  rigidez: 430,
  amortiguacion: 25,
  // Grados que se inclina una tarjeta hacia el dedo y que se ladea lo que se arrastra, según la velocidad
  inclinar: 9,
  ladeo: 13,
  // Escala de lo que se levanta, de un botón apretado y de lo que tiene el mouse encima
  levantar: 1.05,
  apretar: 0.95,
  encima: 1.02,
  // Fuerza de los saltos (el rebote al soltar, los números que cambian)
  empujon: 1.6,
  // Opacidad del brillo de las tarjetas (0 a 1)
  brillo: 0.6,
  // Tuercas chicas que saltan al terminar algo
  chispas: 16,
  // Lo que tardan los números en llegar a su valor nuevo
  rodarMs: 650,
  // El giro de la tuerca de Hoy: el impulso al tocarla (grados por segundo) y cuánto frena
  giro: 830,
  roce: 2.4,
  // En el celular, lo que se arrastra a otro lugar se levanta después de mantenerlo apretado
  mantener: 300,
} as const

// El paso fijo de la simulación, en segundos
export const PASO = 1 / 120

// Un paso de un resorte (Euler semi-implícito): la posición y la velocidad nuevas
export function pasoResorte(x: number, v: number, meta: number, k: number, c: number, dt: number): [number, number] {
  const fuerza = -k * (x - meta) - c * v
  const velocidad = v + fuerza * dt
  return [x + velocidad * dt, velocidad]
}

// Llegó: está en la meta (con tolerancia) y casi sin velocidad
export function llego(x: number, v: number, meta: number, tolerancia: number): boolean {
  return Math.abs(x - meta) <= tolerancia && Math.abs(v) <= tolerancia * 4
}

// Lo ancho (una fila, una tarjeta) se agranda y achica menos que un botón
export function escalaSegunAncho(escala: number, ancho: number): number {
  return 1 + (escala - 1) * Math.min(1, 140 / Math.max(1, ancho))
}

// La tuerca tiene seis lados: se asienta en el múltiplo de 60° siguiente en el sentido en que giraba
export function asentarGiro(grados: number, velocidad: number): number {
  const lados = grados / 60
  return (velocidad >= 0 ? Math.ceil(lados - 1e-9) : Math.floor(lados + 1e-9)) * 60
}

// Qué día queda bajo el dedo en una línea de `dias` días que empieza en `izquierda` y mide `ancho`
export function diaBajo(x: number, izquierda: number, ancho: number, dias: number): number {
  if (dias <= 0 || ancho <= 0) return 0
  return Math.min(dias - 1, Math.max(0, Math.floor(((x - izquierda) / ancho) * dias)))
}

// En cuál de las zonas cae la altura y (-1 si en ninguna)
export function zonaBajo(y: number, zonas: { arriba: number; abajo: number }[]): number {
  return zonas.findIndex((z) => y >= z.arriba && y <= z.abajo)
}

// La parada más cercana a x en una fila de paradas
export function masCercana(x: number, paradas: number[]): number {
  let mejor = 0
  for (let i = 1; i < paradas.length; i++) if (Math.abs(paradas[i] - x) < Math.abs(paradas[mejor] - x)) mejor = i
  return mejor
}

// Una tuerca de ese diámetro que avanza dx rodando gira dx / (π·diámetro) vueltas
export function giroAlRodar(dx: number, diametro: number): number {
  return (dx / (Math.PI * diametro)) * 360
}

// Deslizar una fila: cuenta si pasó un tercio del ancho o si se soltó rápido en ese sentido
export function deslizoLoSuficiente(dx: number, ancho: number, velocidad: number): boolean {
  return dx > ancho * 0.34 || (dx > 24 && velocidad > 900)
}

// Bajar una hoja: se cierra si bajó más de un 28 % de su alto o si se soltó rápido hacia abajo
export function cierraLaHoja(dy: number, alto: number, velocidad: number): boolean {
  return dy > alto * 0.28 || (dy > 12 && velocidad > 650)
}

// Tirar un aviso hacia el lado: se va si pasó un 35 % del ancho o si se soltó rápido
export function seVaElAviso(dx: number, ancho: number, velocidad: number): boolean {
  return Math.abs(dx) > ancho * 0.35 || (Math.abs(dx) > 16 && Math.abs(velocidad) > 700)
}

// Lo que se arrastra se ladea según la velocidad horizontal, con un tope
export function ladeo(vx: number, maximo: number): number {
  return Math.max(-maximo, Math.min(maximo, (vx / 1000) * maximo))
}

// Los números corren rápido al principio y frenan al llegar
export function rodado(desde: number, hasta: number, t: number): number {
  const u = Math.min(1, Math.max(0, t))
  return desde + (hasta - desde) * (1 - Math.pow(1 - u, 3))
}

// La velocidad del dedo se suaviza para que un movimiento brusco no la dispare
export function suavizar(anterior: number, nueva: number): number {
  return anterior * 0.55 + nueva * 0.45
}
