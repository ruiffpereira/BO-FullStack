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

// Pré-fetch do spec com o header de bypass (em vez de deixar o Kubb buscar o URL
// diretamente, cujo suporte a headers custom é limitado). O token só vai no header
// do pedido — não fica escrito em src/gen/ nem no spec.json descarregado.
const res = await fetch(SPEC_URL, {
  headers: {
    "User-Agent": "kubb-codegen",
    ...(CF_BYPASS ? { "X-CI-Bypass": CF_BYPASS } : {}),
  },
});
if (!res.ok) {
  throw new Error(
    `Falha a obter o OpenAPI spec (${res.status} ${res.statusText}) de ${SPEC_URL}. ` +
      `Se for a Cloudflare a bloquear, confirma CF_BYPASS_TOKEN e a WAF rule.`,
  );
}
writeFileSync(LOCAL_SPEC, await res.text());

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
