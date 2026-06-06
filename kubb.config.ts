import { defineConfig } from "@kubb/core";
import { pluginOas } from "@kubb/plugin-oas";
import { pluginTs } from "@kubb/plugin-ts";
import { pluginReactQuery } from "@kubb/plugin-react-query";

const API_BASE = process.env.VITE_API_BASE_URL ?? "http://localhost:3001/api";
const SWAGGER_KEY = process.env.SWAGGER_ACCESS_TOKEN ?? "";

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
