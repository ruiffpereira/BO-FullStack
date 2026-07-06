import { test } from "./fixtures/auth";
import * as fs from "fs";

// Screenshot harness (manual): captura cada página em light/dark a 2 larguras.
// Usa o fixture de auth (login por teste via API). Output fora do repo (scratchpad).
const OUT =
  "C:/Users/r_f/AppData/Local/Temp/claude/d--Projetos-Projectos-Backoffice/4d747702-a6cc-46f0-9fae-d792e614dcce/scratchpad/shots";

const ROUTES: [string, string][] = [
  ["dashboard", "/dashboard"],
  ["agenda", "/agenda"],
  ["clientes", "/clientes"],
  ["financeiro", "/financeiro"],
  ["conteudos", "/conteudos"],
  ["loja", "/loja"],
  ["ginasio", "/ginasio"],
  ["admin", "/admin"],
];

const WIDTHS: Record<string, [number, number]> = {
  desktop: [1280, 900],
  mobile: [390, 844],
};

fs.mkdirSync(OUT, { recursive: true });

for (const theme of ["light", "dark"] as const) {
  for (const wName of Object.keys(WIDTHS)) {
    test(`shots ${theme} ${wName}`, async ({ page }) => {
      test.setTimeout(180_000);
      const [w, h] = WIDTHS[wName];
      await page.setViewportSize({ width: w, height: h });
      // Determinismo do tema: o Backoffice agora PERSISTE o tema em
      // localStorage e o anti-flash do index.html lê-o sincronamente antes do
      // 1.º paint. Sem semear, o lote dependeria do `prefers-color-scheme` do
      // runner (Chromium headless emula light) e/ou de um valor deixado por um
      // lote anterior — em vez disso, semeia-se explicitamente ANTES de cada
      // navegação (addInitScript corre a cada novo document, cobrindo todos os
      // page.goto() abaixo). A chave "bo.theme" espelha
      // src/lib/uiTheme.ts::THEME_STORAGE_KEY — literal aqui de propósito (o
      // e2e não importa código da app); mantém em sincronia se mudares lá.
      await page.addInitScript((t) => {
        try {
          window.localStorage.setItem("bo.theme", t);
        } catch {
          // localStorage bloqueado — sem forma de semear; o teste cai no
          // fallback do sistema/anti-flash.
        }
      }, theme);
      for (const [name, path] of ROUTES) {
        await page.goto(path);
        // A app mantém um stream SSE aberto (/events/stream) → a rede NUNCA fica
        // idle. Limitar o wait para não pendurar até ao timeout do teste.
        await page.waitForLoadState("networkidle", { timeout: 2_500 }).catch(() => {});
        await page.waitForTimeout(800);
        await page.screenshot({
          path: `${OUT}/${theme}-${wName}-${name}.png`,
          fullPage: true,
        });
      }
    });
  }
}
