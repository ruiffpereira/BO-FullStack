import { defineConfig } from "@kubb/core";
import { pluginOas } from "@kubb/plugin-oas";
import { pluginTs } from "@kubb/plugin-ts";
import { pluginReactQuery } from "@kubb/plugin-react-query";
import { existsSync, readFileSync } from "node:fs";

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
  process.env.VITE_API_BASE_URL ?? dotEnv.VITE_API_BASE_URL ?? "http://localhost:3001/api";
const SWAGGER_KEY = process.env.SWAGGER_ACCESS_TOKEN ?? dotEnv.SWAGGER_ACCESS_TOKEN ?? "";

export default defineConfig({
  root: ".",
  input: {
    path: `${API_BASE}-docs/backoffice.json${SWAGGER_KEY ? `?key=${SWAGGER_KEY}` : ""}`,
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
