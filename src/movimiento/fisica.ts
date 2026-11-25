// Las cuentas del movimiento, sin pantalla: se prueban con node --test src/movimiento/fisica.test.ts

// Cuánto se mueve Puente: la intensidad B+, "Al dedo", elegida en la maqueta el 2026-11-25. Es la B "Con jugo" del
// 2026-11-24 con más respuesta bajo el dedo, porque en el celular B casi no se notaba.
export const NIVEL = {
  // El resorte: rigidez y amortiguación. Con 22 rebota un poco; sin rebote sería 2·√430 ≈ 41
  rigidez: 430,
  amortiguacion: 22,
  // Grados que se inclina una tarjeta hacia el dedo y que se ladea lo que se arrastra, según la velocidad
  inclinar: 9,
  ladeo: 13,
  // Escala de lo que se levanta, de un botón apretado y de lo que tiene el mouse encima
  levantar: 1.05,
  apretar: 0.9,
  encima: 1.02,
  // Al apretar se hunde con un resorte firme, para que se vea antes de levantar el dedo
  rigidezApretar: 1100,
  amortiguacionApretar: 52,
  // Hasta este ancho se hunde entero; lo más ancho (una fila, una tarjeta), menos
  anchoApretar: 180,
  // Con el dedo, lo apretado espera estos ms antes de hundirse: si el dedo empieza a desplazar la pantalla, no se hunde
  // (lo mismo que espera Android para marcar algo apretado). Un toque más corto se hunde y tiembla al soltar.
  esperaDedo: 100,
  // El temblor al soltar, como las cartas de Balatro: cuánto cambia la escala y cuántos grados gira, y en cuántos ms se
  // apaga. Es algo más que en la maqueta (0,09) porque aquí, al soltar, la escala viene volviendo de hundida
  jugo: 0.11,
  giroJugo: 3.2,
  jugoMs: 400,
  // Fuerza de los saltos (los números que cambian, el ícono de la sección)
  empujon: 1.6,
  // Al cambiar de pantalla: desde cuántos pixeles llega (al abrir algo, al volver, al pasar a otra sección), con qué
  // opacidad parte y en cuántos ms la recupera
  entraAbrir: 100,
  entraVolver: -55,
  entraSeccion: 16,
  entraOpacidad: 0.3,
  entraMs: 180,
  // Y sus tarjetas y filas se reparten: parten más abajo, giradas y chicas, una cada `paso` ms, hasta `max`
  reparto: { y: 16, giro: 3, escala: 0.96, paso: 24, max: 14 },
  // Cuánto se estira, como máximo, la marca de lo elegido mientras se desliza
  estirar: 14,
  // Ms que vibra al apretar (con "Sonido y vibración" encendido; solo en Android)
  vibrarApretar: 8,
  // Opacidad del brillo de las tarjetas (0 a 1)
  brillo: 0.6,
  // Tuercas chicas que saltan al terminar algo
  chispas: 20,
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

// Lo ancho (una fila, una tarjeta) se agranda y achica menos que un botón: entero hasta `referencia` pixeles
export function escalaSegunAncho(escala: number, ancho: number, referencia = 140): number {
  return 1 + (escala - 1) * Math.min(1, referencia / Math.max(1, ancho))
}

// El temblor al soltar, a los t segundos: cuánto de la escala y del giro se suma (entre -1 y 1). Oscila rápido y se
// apaga en `duracion` segundos, más fuerte al principio (como el "juice" de las cartas de Balatro).
export function ondaDeJugo(t: number, duracion: number): { s: number; r: number } {
  const queda = 1 - t / duracion
  if (t <= 0 || queda <= 0) return { s: 0, r: 0 }
  const f = queda * queda * queda
  return { s: Math.sin(50.8 * t) * f, r: Math.sin(40.8 * t) * f }
}

// Lo ancho tiembla menos que un botón, pero siempre algo
export function fuerzaDeJugo(ancho: number): { s: number; r: number } {
  const f = Math.min(1, 140 / Math.max(1, ancho))
  return { s: 0.35 + 0.65 * f, r: 0.3 + 0.7 * f }
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
