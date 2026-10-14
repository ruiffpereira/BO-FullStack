# F07 · API — Uploads de PDF e dono dos ficheiros

**Repo:** API-FullStack · **Tamanho:** S · **Depende:** F02 (pode correr em qualquer altura depois)
**Agentes:** 1 Sonnet · `seguranca-api`
**Contrato:** §3.1 (media), §6.6

## Objetivo
O componente Documentos precisa de PDF (hoje o upload só aceita imagem e vídeo — `controllers/uploads/uploadController.ts:24,53,55`).
E a validação de media do construtor precisa de saber se um URL é do storage do tenant.

## Ficheiros
- Mexe: `controllers/uploads/uploadController.ts`, `routes/uploads/uploadRoutes.ts`.
- Novo: `src/utils/ownedMedia.ts` (`isOwnedUrl(userId, url)` — mesmo critério do `isOwnedKey`, a partir do URL
  público do storage) e ligá-lo aos validadores do construtor (substituir o stub do F05).
- Testes: `tests/backoffice/uploadsPdf.test.ts`, `tests/backoffice/ownedMedia.test.ts`.

## Brief para o agente (copiar)
> No upload, aceita `application/pdf` até 20 MB **só quando o conteúdo começa por `%PDF-`** (verificação dos bytes,
> não só do mimetype/extensão). Guarda sem processar, com chave `<userId>/site/<uuid>-<nome-limpo>.pdf`. Mantém o
> limite de 30/min por utilizador. Cria `src/utils/ownedMedia.ts` com `isOwnedUrl(userId, url)` (host do storage +
> prefixo `<userId>/`) e liga-o aos validadores de `src/pageBuilder/` no lugar do stub. Testes: PDF válido; HTML com
> extensão `.pdf` recusado; 21 MB recusado; `isOwnedUrl` com URL de outro tenant, de outro host, com `../`. ≤ 300 palavras.

## Brief para `seguranca-api`
> Upload: ficheiro disfarçado (HTML/JS com `%PDF-` só no início e script depois — aceitável porque é servido como
> `application/pdf` de outro domínio; confirmar o `Content-Type` guardado), nomes com `../`, zip bombs não se aplicam.

## Gates · Fecho
API gates (+ `pnpm kubb:refresh` se o swagger do upload mudar). Commit — **sem push** (PLANO §5). `FUNCIONALIDADES.md`. `TASKS.md`: F07 ✅.
