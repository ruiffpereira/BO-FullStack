import { defineConfig } from "@kubb/core";
import { pluginOas } from "@kubb/plugin-oas";
import { pluginTs } from "@kubb/plugin-ts";
import { pluginReactQuery } from "@kubb/plugin-react-query";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

function readDotEnv() {
  if (!existsSync(".env")) return {};
  return Object.fromEntries(
    readFileSync(".env", "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const [key, ...rest] = line.split("=");
        return [key, rest.join("=").replace(/^["']|["']$/g, "")];
      }),
  );
}

const dotEnv = readDotEnv();
const API_BASE =
  process.env.VITE_API_BASE_URL ??
  dotEnv.VITE_API_BASE_URL ??
  "http://localhost:3001/api";
const SWAGGER_KEY =
  process.env.SWAGGER_ACCESS_TOKEN ?? dotEnv.SWAGGER_ACCESS_TOKEN ?? "";
// Build-time only — NUNCA prefixar com VITE_ (senão o Vite inclui-o no bundle).
// Combina com uma WAF custom rule na Cloudflare: header presente => Skip Bot Fight.
const CF_BYPASS = process.env.CF_BYPASS_TOKEN ?? dotEnv.CF_BYPASS_TOKEN ?? "";

const SPEC_URL = `${API_BASE}-docs/backoffice.json${SWAGGER_KEY ? `?key=${SWAGGER_KEY}` : ""}`;
const LOCAL_SPEC = "spec.json";

// Pré-fetch do spec com o header de bypass (o suporte a headers custom do Kubb é
// limitado). O token só vai no header do pedido — não fica escrito em src/gen/ nem
// no spec.json descarregado.
//
// A geração é sempre feita a partir do FICHEIRO spec.json (input.path abaixo) — não
// precisa da API a correr. O fetch serve só para BUSCAR a versão mais fresca do spec.
//   • Normal (local/deploy): busca live → reescreve spec.json → gera. (Produção fica sempre atual.)
//   • Offline (CI, KUBB_OFFLINE=1) ou API indisponível: usa o spec.json JÁ versionado.
const OFFLINE = process.env.KUBB_OFFLINE === "1";
if (OFFLINE) {
  if (!existsSync(LOCAL_SPEC)) {
    throw new Error(`KUBB_OFFLINE=1 mas não existe ${LOCAL_SPEC} versionado no repo.`);
  }
  console.warn(`[kubb] Modo offline: a gerar a partir do ${LOCAL_SPEC} versionado.`);
} else {
  try {
    const res = await fetch(SPEC_URL, {
      headers: {
        "User-Agent": "kubb-codegen",
        ...(CF_BYPASS ? { "X-CI-Bypass": CF_BYPASS } : {}),
      },
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    writeFileSync(LOCAL_SPEC, await res.text());
  } catch (err) {
    if (!existsSync(LOCAL_SPEC)) {
      throw new Error(
        `Falha a obter o OpenAPI spec de ${SPEC_URL} (${err}) e não há ${LOCAL_SPEC} local. ` +
          `Se for a Cloudflare a bloquear, confirma CF_BYPASS_TOKEN e a WAF rule.`,
      );
    }
    console.warn(`[kubb] API indisponível (${err}); a usar o ${LOCAL_SPEC} versionado.`);
  }
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
