import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Envs obrigatórias em QUALQUER ambiente (regra do projeto: sem defaults
// silenciosos). O build/dev-server recusa arrancar se faltarem — assim o
// Coolify falha o deploy em vez de embutir um valor errado no bundle.
// Valores por ambiente: prod = build-time variables no Coolify ·
// dev = .env.development (commitado) · e2e = .env.test.
const REQUIRED_ENVS = ['VITE_API_BASE_URL']

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '')
  const missing = REQUIRED_ENVS.filter((k) => !env[k]?.trim())
  if (missing.length) {
    throw new Error(
      `[backoffice] Envs obrigatórias em falta (mode "${mode}"): ${missing.join(', ')}. ` +
        'Define-as no ambiente do build (Coolify: build-time variables; dev: .env.development) — sem default.',
    )
  }

  return {
    plugins: [react()],
    // O watcher não vigia o que o Playwright escreve (relatório HTML, traces, capturas): apagar essas pastas a meio
    // de uma corrida derrubava o servidor Vite (ENOENT no chokidar) e as páginas seguintes do e2e davam ERR_CONNECTION_REFUSED.
    server: { port: 5173, open: true, watch: { ignored: ['**/playwright-report/**', '**/test-results/**', '**/.design/**'] } },
    resolve: {
      alias: { '@': path.resolve(__dirname, './src') },
    },
  }
})
