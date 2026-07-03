// @ts-nocheck — ficheiro de TOOLING (Node, build-time), corrido pelo CLI do Kubb
// e FORA do tsconfig da app (`include: ["src"]`). Usa globals de Node (`process`,
// `fetch`, `node:fs`); o `@types/node` NÃO está na app de propósito (senão os
// globals de Node vazavam para o código do browser e mascaravam erros). Isto só
// silencia o "inferred project" do IDE — não afeta o build nem o `pnpm lint`.
import { defineConfig } from "@kubb/core";
import { pluginOas } from "@kubb/plugin-oas";
import { pluginTs } from "@kubb/plugin-ts";
import { pluginReactQuery } from "@kubb/plugin-react-query";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

function readDotEnv(file: string) {
  if (!existsSync(file)) return {};
  return Object.fromEntries(
    readFileSync(file, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const [key, ...rest] = line.split("=");
        return [key, rest.join("=").replace(/^["']|["']$/g, "")];
      }),
  );
}

// Mesma precedência do Vite: env real > .env (local, gitignored) > .env.development.
const dotEnv = { ...readDotEnv(".env.development"), ...readDotEnv(".env") };

// OBRIGATÓRIA e sem default (regra do projeto): a base da API é o `baseURL` dos
// hooks gerados. Vem do ambiente / `.env.development`. Falta → ERRO.
const API_BASE = process.env.VITE_API_BASE_URL ?? dotEnv.VITE_API_BASE_URL;
if (!API_BASE) {
  throw new Error(
    "[kubb] Env obrigatória em falta: VITE_API_BASE_URL " +
      "(prod/CI: variável de ambiente; dev: .env.development) — sem default.",
  );
}

const LOCAL_SPEC = "spec.json";

// OFFLINE POR DEFEITO. A geração usa SEMPRE o `spec.json` committado (fonte de
// verdade, reprodutível, sem depender da API estar de pé) — por isso `pnpm dev`/
// `build`/`kubb` nunca esperam por um fetch. Só se re-busca o spec da API quando
// EXPLICITAMENTE pedido: `pnpm kubb:refresh` (define `KUBB_REFRESH=1`).
const REFRESH = process.env.KUBB_REFRESH === "1";

if (REFRESH) {
  // Tokens OPCIONAIS — lidos SÓ AQUI (no fetch do refresh), nunca no caminho
  // normal. Não são defaults "errados": ausentes = não enviados.
  //  - SWAGGER_ACCESS_TOKEN: só se o endpoint do swagger estiver protegido por key.
  //  - CF_BYPASS_TOKEN: header X-CI-Bypass p/ atravessar o Bot Fight Mode da
  //    Cloudflare (build atrás do edge). Em localhost/sem Cloudflare não é preciso.
  // O token só vai no header/query do pedido — nunca fica escrito em spec.json/src/gen.
  const SWAGGER_KEY =
    process.env.SWAGGER_ACCESS_TOKEN ?? dotEnv.SWAGGER_ACCESS_TOKEN ?? "";
  const CF_BYPASS = process.env.CF_BYPASS_TOKEN ?? dotEnv.CF_BYPASS_TOKEN ?? "";
  const SPEC_URL = `${API_BASE}-docs/backoffice.json${SWAGGER_KEY ? `?key=${SWAGGER_KEY}` : ""}`;
  try {
    const res = await fetch(SPEC_URL, {
      headers: {
        "User-Agent": "kubb-codegen",
        ...(CF_BYPASS ? { "X-CI-Bypass": CF_BYPASS } : {}),
      },
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    writeFileSync(LOCAL_SPEC, await res.text());
    console.warn(`[kubb] refresh: ${LOCAL_SPEC} atualizado a partir de ${SPEC_URL}`);
  } catch (err) {
    if (!existsSync(LOCAL_SPEC)) {
      throw new Error(
        `[kubb] refresh falhou (${err}) e não há ${LOCAL_SPEC} local. ` +
          `Se for a Cloudflare a bloquear, confirma CF_BYPASS_TOKEN e a WAF rule.`,
      );
    }
    console.warn(`[kubb] refresh falhou (${err}); mantém o ${LOCAL_SPEC} committado.`);
  }
} else if (!existsSync(LOCAL_SPEC)) {
  throw new Error(
    `[kubb] Falta o ${LOCAL_SPEC} committado (offline por defeito). ` +
      `Corre 'pnpm kubb:refresh' com a API acessível para o gerar.`,
  );
}

export default defineConfig({
  root: ".",
  input: {
    path: LOCAL_SPEC,
  },
  output: {
    path: "./src/gen/backoffice",
    extension: { ".ts": ".js" },
    clean: true,
  },
  plugins: [
    pluginOas(),
    pluginTs(),
    pluginReactQuery({
      client: {
        baseURL: API_BASE,
      },
    }),
  ],
});
