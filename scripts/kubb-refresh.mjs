// `pnpm kubb:refresh` — regenera os hooks Kubb BUSCANDO o spec fresco da API
// (define KUBB_REFRESH=1 e corre o kubb). Sem isto, o `kubb generate` é OFFLINE
// por defeito (usa o spec.json committado). Wrapper em Node para ser
// cross-platform (as npm scripts não sabem `VAR=1 cmd` no Windows).
import { execSync } from "node:child_process";

execSync("kubb generate", {
  stdio: "inherit",
  env: { ...process.env, KUBB_REFRESH: "1" },
});
