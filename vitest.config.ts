import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

// Configuração dos testes de COMPONENTES (unitários, isolados — sem servidor).
// Os testes end-to-end (Playwright) vivem em tests/e2e e correm com `pnpm test:e2e`.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/unit/setup.ts"],
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    css: false,
  },
});
