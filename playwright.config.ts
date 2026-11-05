import { defineConfig, devices } from '@playwright/test'

// Recorridos de Puente: cada prueba abre la maqueta de desarrollo (?maqueta=…), que guarda en memoria
// y parte de cero al cargar la página. Corren con el Edge instalado, en celular y en computador.
const PUERTO = 5181

export default defineConfig({
  testDir: './pruebas/recorridos',
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  // Con más navegadores a la vez, el servidor de desarrollo compila las secciones más lento y alguna prueba se pasa de tiempo
  workers: 3,
  forbidOnly: !!process.env.CI,
  // Otras personas editan src/ mientras corren: si el servidor recarga la página, la maqueta parte de cero y la prueba se repite una vez
  retries: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PUERTO}`,
    channel: 'msedge',
    locale: 'es-CL',
    timezoneId: 'America/Santiago',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'celular',
      use: {
        ...devices['iPhone 14'],
        // Edge no tiene WebKit: solo se parece en el tamaño, el agente y el toque
        browserName: 'chromium',
        channel: 'msedge',
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
      },
    },
    {
      name: 'computador',
      use: { viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: {
    command: `npx vite --port ${PUERTO} --strictPort`,
    url: `http://localhost:${PUERTO}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
