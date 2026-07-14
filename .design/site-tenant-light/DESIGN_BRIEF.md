# Brief — Modelo "feito por mim, afinado por eles" (Fase 3.8-3.10)

**Data:** 2026-07-14 · **Decisão do dono:** sites dos clientes são montados PELO DONO (templates por vertical +
editor completo + domínio próprio via Coolify); os tenants ficam com **afinação leve** (marca, conteúdo,
toggles) — nunca com poder de partir o design. O self-serve (signup → subdomínio + template) continua vivo
como entrada barata; os dois modelos coexistem. Autorização total do dono para executar (2026-07-14),
EXCETO: faturação (BILLING_LIVE fica false, Fase 6) e o container Umami (dono trata a 2026-07-15).

## 3.8 revisto — Un-gate seletivo do /website (permissão `VIEW_SITE_BUILDER`)

- **Permissão RBAC nova `VIEW_SITE_BUILDER`** (mesmo mecanismo dos VIEW_SCHEDULE/VIEW_GYM/... — estudar como
  os componentes/permissões existentes são semeados e verificados na API e consumidos no BO via hasPermission).
- **`/website` volta a CORE** (todos os tenants autenticados) mas com a superfície dividida:
  - **Tenant (sem a permissão):** "O meu site" (estado/URL, SEM botão Publicar) · **Marca** (completa) ·
    **Rodapé & Nav** · **Páginas em modo conteúdo**: lista de páginas read-only, pode abrir o editor de
    conteúdo dos blocos (BlockContentModal — textos/imagens) mas NÃO pode adicionar/remover/reordenar
    páginas ou blocos, nem mudar slug/título/nav/variante.
  - **Com `VIEW_SITE_BUILDER` (ou VIEW_ADMIN):** tudo — Template, Páginas completo, Domínio, Publicar.
- **Defaults:** signup self-serve CONCEDE a permissão (self-serve mantém o poder total); tenants criados à
  mão pelo dono NÃO a têm (ele atribui enquanto monta o site na conta do cliente e revoga na entrega).
- Gate é de UI (a API /website continua tenant-open, security-review de 2026-07-04 válida — mesmo trust
  model do gate atual). `/estatisticas` mantém o gate VIEW_ADMIN até o Umami estar live (un-gate à parte).

## 3.9 — Domínio próprio (confirmado 2026-07-14)

**Estado (2026-07-14, mesma tarde): CONSTRUÍDO mas DESATIVADO na UI.** Decisão do dono: sites são
SEMPRE por subdomínio, nunca domínio próprio — a feature fica pronta (API completa + testada, card do
BO extraído e testado) atrás da flag `CUSTOM_DOMAIN_UI` (`false`) em `src/pages/Website.tsx`. Reativar =
pôr a flag a `true` (zero mudanças de código extra necessárias). Ver `RUNBOOK-custom-domain.md`.

- API: endpoint dedicado para definir `Site.customDomain` (o PUT /website tem whitelist anti-mass-assignment
  — customDomain fica FORA dela, endpoint próprio). Validações: hostname válido (regex conservadora,
  lowercase, sem esquema/porta/path), NUNCA o siteRootDomain nem subdomínio dele, único entre tenants
  (409 se outro tenant o tem). Ao definir: sincroniza Estatísticas/analytics como o claim do subdomínio
  (provisionAnalyticsSite com o host novo, mesma regra "não pisa domínio próprio"). Limpar (null) permitido.
- Verificar que o endpoint público que o renderer usa (GET /websites/site?host=) resolve TAMBÉM por
  customDomain (se só resolve por subdomínio, corrigir) + revalidação ISR nos dois hosts (siteHosts já junta).
- BO: secção "Domínio próprio" na tab Domínio (que já fica atrás de VIEW_SITE_BUILDER) — input + guardar +
  limpar + instruções curtas inline. RUNBOOK-custom-domain.md em .design/site-tenant-light/: passos Coolify
  (adicionar o domínio à app do renderer → cert Let's Encrypt) + DNS no registrar (A/CNAME) + definir no BO.
- Swagger + testes (validações, unicidade, isolamento, resolução por host, preview não afetado).

## 3.10 — Afinação leve do tenant (toggles)

Objeto novo de topo no Site JSON: `settings` (o renderer IGNORA chaves desconhecidas — forward-compat).
Textos visíveis ao público são por-locale (Record<locale,string>, mesmo padrão do content dos blocos).

```
settings: {
  announcement?: { enabled: boolean; text: Record<locale,string>; href?: string | null };
  whatsapp?:     { enabled: boolean; number: string };            // botão flutuante
  social?:       { instagram?: string; facebook?: string; tiktok?: string };  // URLs completos, http(s) only
  vacation?:     { enabled: boolean; message: Record<locale,string> };
  seo?:          { title?: Record<locale,string>; description?: Record<locale,string>; ogImage?: string };
  radius?:       "rounded" | "square";
}
```

- **Leva 3.10a (mais valiosa):** announcement (barra no topo do site, dispensável por sessão), whatsapp
  (botão flutuante canto inferior, link wa.me, esconder em /preview? NÃO — preview deve mostrar o site real),
  social (ícones no rodapé, allowlist http(s), rel noopener).
- **Leva 3.10b:** vacation (faixa proeminente + agenda/booking mostra aviso; NÃO despublica), seo
  (metadata/OG do layout — merge com o que o renderer já gera), radius (attr `data-radius` no html +
  tokens CSS; default rounded = visual atual, square muda border-radius global).
- BO: tab nova **"Definições"** no /website (tenant-open, é a casa da afinação leve) com estes grupos;
  guarda via useSaveSite({ settings }) com spread do atual. Validações client-side (número WhatsApp dígitos
  internacionais; URLs http(s)).
- Renderer: componentes pequenos no layout (announcement bar, whatsapp float, vacation notice), social no
  Footer, seo no metadata, radius nos tokens. Sanitização: URLs http(s) only (padrão do mapEmbedUrl).

## Fora de âmbito (explícito)
- Faturação/monetização (Fase 6, decisão do dono).
- Umami container/envs (dono, 2026-07-15) e un-gate /estatisticas (depois da prova Umami).
- Guest checkout da loja + prova de pagamento real (precisa das chaves Stripe test do dono).
- Impersonation/login-as (o fluxo do dono é entrar na conta do cliente com a permissão atribuída).

## Gates por fatia
build-review-fix por batch: tsc + suites completas nos repos tocados; testes novos por feature; CLAUDE.md
atualizados; commits por repo; push + CI da API/site-engine verdes; /api/health confirma deploy.
