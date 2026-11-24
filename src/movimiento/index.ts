// El movimiento de Puente (intensidad B, "Con jugo"): lo que se usa desde las pantallas.
// - Resortes: cuerpo(el) con .meta/.pos/.vel/.fijar y alQuieto; empujon (un salto), sacudir ("no"), Valor, cadaCuadro.
// - Gestos: seguir(evento, opciones) desde un pointerdown (arrastrar, deslizar, girar), con toque largo en el celular.
// - Listas que se reacomodan: useFlip(contenedor) con data-flip="clave" en cada elemento.
// - Números que corren: <Numero valor formato />. Marca deslizante: usePastilla(contenedor) con [data-pastilla].
// - Tarjetas que se inclinan: data-carta + <Brillo /> (apretar.ts lo hace solo). Chispas: chispas(x, y) y chispasDesde(el).
// - Sonido y vibración (apagados por defecto): sonar(tipo), vibrar(patrón).
// Con "reducir movimiento" del teléfono todo llega al tiro y no hay chispas ni inclinación.
export { Brillo } from './Brillo.tsx'
export { chispas, chispasDesde, type OpcionesChispas } from './chispas.ts'
export {
  asentarGiro,
  cierraLaHoja,
  deslizoLoSuficiente,
  diaBajo,
  giroAlRodar,
  ladeo,
  masCercana,
  NIVEL,
  seVaElAviso,
  zonaBajo,
} from './fisica.ts'
export { hayGesto, seguir, type OpcionesGesto, type Puntero } from './gesto.ts'
export { Numero } from './Numero.tsx'
export { cadaCuadro, cuerpo, empujon, escala, sacudir, sinMovimiento, Valor } from './resortes.ts'
export { cambiarSonido, sonar, sonidoEncendido, useSonido, vibrar, type Sonido } from './sonido.ts'
export { useFlip } from './useFlip.ts'
export { usePastilla } from './usePastilla.ts'
export { cancelarApretar, instalarMovimiento } from './apretar.ts'
