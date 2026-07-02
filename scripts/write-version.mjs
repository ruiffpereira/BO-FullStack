// Escreve dist/version.json com o SHA do commit deste build, para o smoke
// pós-deploy verificar que ficou live ESTE commit (o SPA é estático, por isso
// o SHA tem de ser servido num ficheiro).
//
// Resolve o SHA de forma robusta, por ordem, e VALIDA sempre o formato (só um
// SHA de git conta — assim um valor inválido, ex.: um "${SOURCE_COMMIT}" não
// expandido pelo Coolify, é ignorado e o smoke degrada em segurança, nunca
// falso-vermelho):
//   1) SOURCE_COMMIT (env de build-time — set no Coolify)
//   2) .git/HEAD lido com Node puro (não precisa do binário git)
//   3) `git rev-parse HEAD` (se o binário existir)
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const SHA = /^[0-9a-f]{7,40}$/i;
const valid = (s) => (s && SHA.test(String(s).trim()) ? String(s).trim() : "");

function fromEnv() {
  return valid(process.env.SOURCE_COMMIT);
}

// Lê o SHA do .git sem invocar o binário git (funciona no Nixpacks se o .git existir).
function fromDotGit() {
  try {
    const head = readFileSync(".git/HEAD", "utf8").trim();
    if (!head.startsWith("ref:")) return valid(head); // HEAD destacado = SHA
    const ref = head.slice(4).trim(); // ex.: refs/heads/main
    try {
      return valid(readFileSync(`.git/${ref}`, "utf8").trim());
    } catch {
      const packed = readFileSync(".git/packed-refs", "utf8");
      const line = packed
        .split("\n")
        .find((l) => !l.startsWith("#") && l.trim().endsWith(" " + ref));
      return valid(line ? line.trim().split(" ")[0] : "");
    }
  } catch {
    return "";
  }
}

function fromGitBinary() {
  try {
    return valid(
      execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] })
        .toString()
        .trim(),
    );
  } catch {
    return "";
  }
}

// Diagnóstico: mostra o valor CRU da env no build (vazio = não é build-time /
// não chega; "{{SOURCE_COMMIT}}" = Coolify não expandiu; um SHA = ok).
console.log(
  `[write-version] raw SOURCE_COMMIT = ${JSON.stringify(process.env.SOURCE_COMMIT ?? null)}`,
);

let commit = fromEnv();
let source = commit ? "SOURCE_COMMIT" : "";
if (!commit) { commit = fromDotGit(); if (commit) source = ".git/HEAD"; }
if (!commit) { commit = fromGitBinary(); if (commit) source = "git rev-parse"; }

mkdirSync("dist", { recursive: true });
writeFileSync("dist/version.json", JSON.stringify({ commit: commit || "unknown" }) + "\n");
console.log(`[write-version] commit = ${commit || "unknown"} (fonte: ${source || "nenhuma"})`);
