# App de Cliente Final Multi-Tenant — Design Brief

**Data:** 2026-07-23 · **Estado:** brief aprovado + **BUILD AUTORIZADO 2026-08-12 (âmbito: só módulo GINÁSIO)** · **Referência:** gymnoprado

---

## 0. CONFIRMADO 2026-08-12 (arranque do build — âmbito ginásio)

O dono autorizou o arranque, **só para o módulo ginásio** (o módulo Agenda, F3, fica para depois). Duas decisões que REFINAM o brief:

- **A app vive DENTRO do site-engine** (Next.js), não como deploy Vite à parte — porta-se o gymnoprado para o site-engine, 1 deploy multi-tenant, config por host. (Confirma a arquitetura D5.) **Nota de tecnologia:** o que importa (React, offline em `localStorage`, cronómetros wall-clock, wake-lock, vibração, push, fila offline) porta-se 1:1; muda o bundler (Vite→Next) e a cola do service worker (refeita no idioma do Next; o engine já serve manifest por host). É re-alojamento, não reescrita.
- **O SUBDOMÍNIO DO GINÁSIO É A APP (supersede o D1 `/app` para o gym):** abrir `ginasiox.rufvision.com` mostra logo a app (login→treino), como o gymnoprado hoje. **NÃO há site de marketing para tenants de ginásio** — o site de marketing atual do gym (blocos `Gym*`/`gym.css`/variantes "gym" no `BlockRenderer`) é **para APAGAR**. A bifurcação faz-se em `site-engine/app/[[...slug]]/page.tsx` (`CatchAllPage`) + `layout.tsx`: `if (site.template === "gym")` → serve o shell da app (SPA client-side) em vez dos blocos, em TODAS as rotas do host; a app usa o seu próprio router client-side (react-router) para `/`, `/treinos`, `/treino/:id/executar`, etc. SW/manifest com scope `/` (só em hosts de ginásio).
- **Isolamento confirmado (recon 2026-08-12):** barber (agenda) e loja (stand) ficam intactos — não partilham código específico do gym; apagar o gym não lhes toca. O trigger "este host é app" é `site.template === "gym"`.
- **Abordagem de porte (decidida):** hospedar a SPA do gymnoprado **client-side** dentro do Next (um catch-all do host de ginásio monta `<AppGym/>` como client component com `BrowserRouter`), preservando o router e a estrutura da app — em vez de converter react-router→Next routing. `import.meta.env` (VITE_*) → config injetada por host (D5).

O resto do brief (D2–D4, D6, arquitetura, riscos, "o que não muda") mantém-se. Fases relevantes agora: **F0 → F1 → F2** (F3 Agenda e F4 polimento ficam para depois).

---

## 1. Visão

As apps de cliente final (ginásio, agenda) deixam de ser deploys por cliente e passam a ser **UM produto da plataforma, igual para todos os tenants** — como o site-engine já é para os sites. O tenant escolhe o subdomínio no signup (já existe), e o engine liga a app a esse tenant automaticamente.

> **Frase-guia do user:** "quero que as apps de ginásio, agenda sejam iguais para todos; quem cria poderá escolher o subdomínio, e depois no engine, tratará de ligar a isso. O token será também a identificação do tenant."

## 2. Decisões fechadas

| # | Decisão | Racional |
|---|---------|----------|
| D1 | **URL: `{sub}.rufvision.com/app`** (path no subdomínio do site, não subdomínio de 2.º nível) | O wildcard DNS/Traefik e a resolução host→tenant JÁ existem no site-engine; `app.{sub}.` exigiria outro wildcard + certs. O link de convite fica óbvio. |
| D2 | **Identidade: host pré-login, token pós-login** | O JWT do `Customer` já carrega o tenant (`authenticateTokenCustomers` → customer → `userId`) — a app autenticada não precisa do host para NADA. O host serve só para: (a) scoping do login/registo (email de cliente final é único POR tenant — `Customers(userId,email)`; o mesmo email pode ser sócio de 2 ginásios); (b) branding pré-login. |
| D3 | **Branding por tenant** | Manifest dinâmico por host: a PWA instala como "Ginásio X" com o logo do tenant (`User.logoUrl`); ícones da plataforma como fallback. |
| D4 | **UMA app com módulos, não N apps** | O tenant tem `VIEW_GYM` → módulo ginásio; `VIEW_SCHEDULE` → módulo marcações; ambos → os dois na mesma app/instalação. Um deploy, uma app na home screen do cliente final. A gymnoprado atual torna-se o módulo ginásio. |
| D5 | **Config por host injetada pelo engine, não embutida no build** | Hoje a gymnoprado tem `VITE_USER_ID` + `VITE_SITE_TOKEN` embutidos no bundle (single-tenant por construção). Passa a: o site-engine serve/proxia `/app/*` e injeta a config do tenant (userId público de scoping, site token, branding) no HTML ao servir — mesmo padrão da injeção de analytics nos sites. Zero envs por tenant. |
| D6 | **Strings de UI da app: bundle da plataforma com OVERRIDE por tenant** (confirmado pelo user 2026-07-23) | Hoje as ~700 chaves `gym.app.*` vivem no CMS DO tenant ginásio (import manual do CSV) — não escala para N tenants. Passa a resolução em cascata: **`CMS do tenant (se a chave existir) → bundle i18n estático da plataforma (pt+en) → fallback PT no código`**. A app funciona out-of-the-box sem nenhum import; um tenant que queira renomear chrome da app ("Treinos"→"Aulas") cria SÓ essa chave no CMS dele e ela sobrepõe-se. **O CMS do WEBSITE (contexto `website`) e o de conteúdo do negócio (`gym`/`service`/`product` via `contentKey`) ficam intocados** — o cliente continua a mudar o que quiser no site dele exatamente como hoje. |

## 3. Arquitetura

```
Cliente final                    site-engine (Next.js)              API
─────────────                    ────────────────────               ───
ginasiox.rufvision.com/app  ──►  middleware resolve host→tenant
                                 serve shell da PWA com config
                                 injetada {userId, siteToken,
                                 branding, módulos}
    login/registo (scoped) ─────────────────────────────────►  /websites/customers (userId do host)
    app autenticada ────────────────────────────────────────►  /websites/gym/* + /websites/booking/*
                                                               (token → customer → tenant; host irrelevante)
    /app/manifest.webmanifest ◄─ gerado por host (nome+logo)
```

- **Rota `/app` reservada**: entra na lista de rotas reservadas do site-engine + validação do `PagesTab` no BO (par de `carrinho`/`entrar`/etc.).
- **Módulos por tenant**: a config injetada inclui os módulos ativos (derivados das permissões `VIEW_GYM`/`VIEW_SCHEDULE` do tenant) — a app mostra as áreas correspondentes; um tenant só-agenda nunca vê UI de ginásio.
- **Service worker/scope**: manifest com `scope: /app/`, SW registado em `/app/` — convive com o site no mesmo host sem interferência.
- **Convites e deep-links**: o email de convite de sócio e os `notificationclick` passam a apontar para `https://{sub}.{root}/app/...` — a API já sabe o subdomínio do tenant (claim do site). **Pré-condição**: tenant sem subdomínio reclamado não pode convidar sócios para a app (aviso no BO com CTA para reclamar — item novo do FirstValueChecklist do gym).

## 4. Módulo Agenda (novo, Fase 3)

Par do módulo ginásio, para clientes finais de tenants com `VIEW_SCHEDULE`: próximas marcações + histórico, remarcar/cancelar (a API pública de booking já tem cancel; a app usa a conta em vez do `cancelToken`), subscrever calendário (.ics já existe: `/websites/booking/customer/calendar/:token.ics`), notificações/lembretes. Reutiliza TODO o shell da app (auth, tema, PWA infra, i18n, fila offline como padrão).

## 5. Fases

- **F0 — Fundações no engine + API** · rota `/app/*` no site-engine (serve/proxy da PWA + injeção de config por host) · manifest dinâmico por host · endpoint/config de módulos por tenant · `app` reservado (engine + BO) · convites com URL por subdomínio + guard no BO.
- **F1 — Gymnoprado → app genérica** · matar `VITE_USER_ID`/`VITE_SITE_TOKEN` (runtime config) · branding por tenant (pré-login + manifest) · strings de UI para bundle i18n estático (D6) · registo/login scoped por host · testes.
- **F2 — Migração do GYMNOPRADO real** · garantir subdomínio do tenant ginásio · redirect do URL antigo → novo (PWA instalada antiga: aviso de "nova morada" + link) · tokens/contas dos sócios continuam válidos (nada muda na API) · desligar o deploy antigo.
- **F3 — Módulo Agenda** · área de marcações na app (lista/detalhe/cancelar/remarcar/ics) · gating por módulo · notificações.
- **F4 — Polimento** · ícones PWA gerados do logo do tenant (v1 usa fallback da plataforma) · onboarding do sócio · e2e multi-tenant (2 tenants, isolamento).

## 6. Riscos e pontos abertos

1. **Ícones do manifest por tenant** — gerar PNGs de vários tamanhos a partir do `logoUrl` exige processamento (sharp na API ou no engine). v1: nome do tenant + ícones da plataforma; geração fica para F4.
2. **`VITE_SITE_TOKEN` por host** — o site token é semi-público (já vai embutido nos bundles dos sites atuais); injetá-lo por host pelo engine mantém o mesmo nível de exposição. Confirmar que nenhum endpoint lhe dá mais poder do que os públicos.
3. **PWA instalada do GYMNOPRADO atual** — o SW antigo aponta ao host antigo; a migração precisa de uma página de despedida com deep-link para a nova morada (não há como migrar a instalação em si).
4. **Strings EN** — ao sair do CMS, as traduções EN das ~700 chaves têm de ser congeladas no bundle a partir do `content-import.csv` atual (script de conversão CSV→JSON, one-off).
5. **Coolify** — decidir serve estático dentro do engine vs proxy para app separada (rewrites Next). Preferência: proxy (deploys independentes; a app continua com o seu pipeline).

## 7. O que NÃO muda

- API de dados do gym/booking (token → tenant, já multi-tenant por construção; auditada no gym-recon 2026-07-21).
- CMS por-tenant para conteúdo do negócio (nomes de exercícios, serviços — `contentKey`).
- O Backoffice (fora: aviso de subdomínio nos convites + rota reservada no PagesTab).
- A fila offline/durabilidade/interação da PWA (P1-P3 do gym-recon) — herdada tal-e-qual pela app genérica.
