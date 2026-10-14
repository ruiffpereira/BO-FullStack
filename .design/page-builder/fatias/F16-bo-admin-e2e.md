# F16 · Backoffice — Admin do construtor + e2e completo nas três larguras

**Repo:** Backoffice (+ seed e2e na API se faltar) · **Tamanho:** M · **Depende:** F15
**Agentes:** 1 Sonnet · `e2e-backoffice`
**Contrato:** §5.4, §8

## O que tem de fazer
- **Admin → Utilizadores → "Construtor de páginas"** (molde: o modal "Domínio do site", `src/pages/Admin.tsx:312-330, 617-645`):
  activar/desactivar · carregar manifest (ficheiro JSON ou colar) com os erros de validação legíveis e, no
  `409 MANIFEST_IN_USE`, a lista do que está em uso · publicação: modo (Em runtime | GitHub Actions), repo, workflow,
  ref, token (só de escrita: "definido" / "trocar") · "Testar" · estado da última publicação.
- **Estado da publicação** na barra da página Páginas: "Alterações por guardar" → "A publicar no site…" →
  "No ar · hh:mm" / "Falhou: <motivo>" (a partir do `publish` do `GET`, com refetch enquanto `running`); "Publicar agora".
- Lembrete no admin: dar `VIEW_SITE_PAGES` à role do tenant (link para Admin → Permissões).

## Brief para o agente construtor (copiar)
> Implementa a fatia F16 (`Backoffice/.design/page-builder/fatias/F16-bo-admin-e2e.md`), parte "O que tem de fazer".
> Admin só visível com `VIEW_ADMIN`; em sessão de suporte as rotas respondem `IMPERSONATION_FORBIDDEN` — mostrar a
> mensagem. O token nunca é lido de volta. Responsivo. ≤ 300 palavras.

## Brief para `e2e-backoffice`
> Specs novos `tests/e2e/paginas*.spec.ts`, projectos Playwright nas larguras 1440, 834 e 390. Fluxos: criar página,
> criar subpágina e arrastá-la para outra mãe; adicionar bloco por ponto de partida, por "usar" e por "copiar";
> adicionar componente novo e copiado; arrastar componentes e blocos; mudar estilo/coluna/disposição; preencher
> traduções com "Ver onde" até o Guardar desbloquear; gravar e recarregar (persistiu); desfazer/refazer; apagar
> bloco em uso (recusado) e página referenciada (recusado); Definições e SEO (pontuação muda ao pôr um 2.º H1);
> RBAC (sem permissão não vê; tenant A não vê nada do B); admin activa o construtor e carrega um manifest.
> Seed: tenant com construtor activo e manifest da Winterplateau (`scripts/seedE2e.ts` na API, se for preciso).
> Uma corrida antes de corrigir e uma depois; reportar bugs reais sem os mascarar.

## Revisão do supervisor
- [ ] Capturas das três larguras revistas a olho (lista, conteúdo, editor, definições, admin)
- [ ] Nenhum spec com `waitForTimeout` fixo

## Gates · Fecho
`pnpm lint && pnpm test:unit && pnpm exec playwright test tests/e2e/paginas*.spec.ts`. Commits (API se mexeu no
seed → Backoffice) — **sem push** (PLANO §5). `REFERENCIA-PAGINAS.md` e `CLAUDE.md` do Backoffice actualizados. `TASKS.md`: F16 ✅.
