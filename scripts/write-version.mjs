// Escreve dist/version.json com o SHA do commit deste build, para o smoke
// pós-deploy verificar que ficou live ESTE commit (o SPA é estático, por isso
// o SHA tem de ser servido num ficheiro).
//
// Resolver o SHA de forma robusta, por ordem:
//   1) SOURCE_COMMIT (se o build o expuser)
//   2) .git/HEAD lido com Node puro — NÃO precisa do binário `git` (o Nixpacks
//      não o traz na imagem de build, mas o .git do checkout está presente)
//   3) `git rev-parse HEAD` (se o binário existir)
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";

function fromEnv() {
  return (process.env.SOURCE_COMMIT || "").trim();
}

// Lê o SHA do .git sem invocar o binário git (funciona no Nixpacks).
function fromDotGit() {
  try {
    const head = readFileSync(".git/HEAD", "utf8").trim();
    if (!head.startsWith("ref:")) {
      // HEAD destacado → é diretamente o SHA (caso típico de um deploy)
      return /^[0-9a-f]{7,40}$/i.test(head) ? head : "";
    }
    const ref = head.slice(4).trim(); // ex.: refs/heads/main
    try {
      return readFileSync(`.git/${ref}`, "utf8").trim();
    } catch {
      // ref empacotada
      const packed = readFileSync(".git/packed-refs", "utf8");
      const line = packed
        .split("\n")
        .find((l) => !l.startsWith("#") && l.trim().endsWith(" " + ref));
      return line ? line.trim().split(" ")[0] : "";
    }
  } catch {
    return "";
  }
}

function fromGitBinary() {
  try {
    return execSync("git rev-parse HEAD", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return "";
  }
}

let commit = fromEnv();
let source = commit ? "SOURCE_COMMIT" : "";
if (!commit) {
  commit = fromDotGit();
  if (commit) source = ".git/HEAD";
}
if (!commit) {
  commit = fromGitBinary();
  if (commit) source = "git rev-parse";
}

mkdirSync("dist", { recursive: true });
writeFileSync("dist/version.json", JSON.stringify({ commit: commit || "unknown" }) + "\n");
console.log(`[write-version] commit = ${commit || "unknown"} (fonte: ${source || "nenhuma"})`);
