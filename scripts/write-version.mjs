// Escreve dist/version.json com o SHA do commit deste build, para o smoke
// pós-deploy verificar que ficou live ESTE commit (o SPA é estático, por isso
// o SHA tem de ser servido num ficheiro).
//
// Fonte do SHA (por ordem): SOURCE_COMMIT (se o build o expuser) → git do próprio
// checkout (o Coolify faz checkout do commit exacto que deploya). Corre no fim do
// `build`, depois do `vite build` ter criado a pasta dist/.
import { writeFileSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";

let commit = process.env.SOURCE_COMMIT || "";
if (!commit) {
  try {
    commit = execSync("git rev-parse HEAD", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    commit = "";
  }
}

mkdirSync("dist", { recursive: true });
writeFileSync("dist/version.json", JSON.stringify({ commit: commit || "unknown" }) + "\n");
console.log(`[write-version] commit = ${commit || "unknown"}`);
