# Build Tasks: App do Cliente Final — Módulo Ginásio (gymnoprado → site-engine)

Generated from: .design/app-cliente-final/DESIGN_BRIEF.md
Date: 2026-08-12
Âmbito: **só o módulo GINÁSIO**, fases F0→F2. A app vive DENTRO do site-engine (Next.js); o **subdomínio do ginásio É a app** (sem site de marketing); barber/stand intactos. Porte da SPA gymnoprado hospedada **client-side** no Next.

> **Escala:** ~11.6k LOC a portar + offline + PWA + config multi-tenant. É uma epopeia de vários lotes — construir e rever fase a fase, verificando cada fatia no site VIVO (os gates tsc/vitest/build NÃO cobrem PWA/offline/host-routing).

## Estado — 2026-08-12 (o núcleo está VIVO e commitado)

**Feito + verificado ao vivo** (host `devgym.localhost`, API docker + site-engine): F0 completo (bifurcação `template==="gym"` → `AppGymShell` client, `lib/appConfig.ts`, injeção `window.__APP_CONFIG__`, manifest/scope por host) · F1 núcleo (gymnoprado inteiro em `components/appgym/`, gen Kubb restaurado, config runtime via window+`NEXT_PUBLIC_API_BASE_URL`, auth do sócio, **i18n cascata CMS→bundle pt/en→PT**, **SW offline** `public/gym-sw.js`) · F2 apagar marketing gym (blocos + variantes BlockRenderer + template mínimo na API). **Login + dashboard 100% localizados em PT com dados reais do sócio, SW ativo, 0 erros JS.** Typecheck+449 testes verdes; `next build` compila+gera+emite o chunk do gym (só falha o standalone-symlink do Windows, ambiental — Linux/Coolify ok).

Commits (LOCAIS→ a fazer push): site-engine `1117983`(F0) `8d8982d`(F1a) `a76058f`(F2) `7cf2edd`(F1c+F1d) · API `6053c0e`(CORS subdomínios) `e8b1ce6`(template gym mínimo).

**Armadilhas resolvidas (guardar):** o porte F1a LARGOU `LanguageProvider`+`CmsProvider` (→ todos os `t()` vazios, login/dashboard sem texto) e criou um `queryClient` inline (2 clients → invalidações não refrescavam) — F1d repõe os providers + singleton `lib/queryClient` + `applyStoredTheme()` no `GymApp`. CORS bloqueava o registo/login a partir dos subdomínios da plataforma → `isPlatformOrigin` na API. `.next` corrompe se misturar `next build` com `next dev` (limpar antes de cada um).

**Falta (adiado, NÃO bloqueia o núcleo):** Web Push (`lib/push.ts`+`push-sw.js` — o `gym-sw.js` é só offline, sem eventos push) · migração do gymnoprado REAL (reclamar subdomínio do tenant real + página de despedida no deploy antigo + desligar) · guard de convite sem subdomínio (BO) · e2e multi-tenant automatizado + design/security review por fase · re-verificar `WorkoutExec` ao vivo com um programa semeado (código transplantado, provado em produção no gymnoprado).

## Convenções de referência
- **Bifurcação** (o coração de F0): `site-engine/app/[[...slug]]/page.tsx` (`CatchAllPage`, ~L166) + `app/layout.tsx` (~L194). `if (site.template === "gym")` → shell da app, senão → blocos (como hoje).
- **Fonte a portar:** `gymnoprado/src/` — `screens/` (Dashboard, Workouts, WorkoutDetail, **WorkoutExec**, WorkoutEditor, History, Progress, Profile, CalendarSync, auth), `store/` (Zustand: `useActiveWorkout`, `usePendingLogs`, `useTheme`, …), `hooks/` (`usePendingLogsSync`, …), `api/` (axios + Kubb `src/gen/`), `lib/` (`feedback`, `statusBar`, `push`, `appConfig`), `index.css`.
- **Config por host:** gymnoprado já consome `GET /websites/app/config?host=` + header `X-Site-Token`. Matar `VITE_USER_ID`/`VITE_SITE_TOKEN` → config injetada pelo engine (D5).
- **Apagar (F2):** `site-engine/components/blocks/{Gym,GymPlans,HeroGym,AboutGym,GalleryGym}.tsx`, `app/gym.css`, variantes "gym" em `BlockRenderer.tsx`.

---

## F0 — Fundações (de-risking: provar que o Next serve a app do gym por host)

- [x] **Config-por-host na API**: garantir `GET /websites/app/config?host=` → `{ userId, siteToken, name, logoUrl, modules[] }`, com `modules` derivado das permissões do tenant (`VIEW_GYM` → `"gym"`). Verificar se já existe (gymnoprado chama-o); se não, criar no controller de websites. Isolamento por host→tenant, sem segredos além do site-token (semi-público). Testes de integração. _Modifica/cria API._
- [x] **Bifurcação gym no engine**: em `CatchAllPage` + `layout.tsx`, `if (site.template === "gym")` renderiza um `<AppGymShell/>` (client component) para TODAS as rotas do host, em vez de blocos/chrome de site; barber/stand/generic inalterados. `<AppGymShell/>` v0 = ecrã "olá" que lê a config injetada e mostra o nome do tenant. _Cria `components/appgym/AppGymShell.tsx`; modifica page/layout._
- [x] **Injeção de config no HTML (D5)**: o `layout.tsx` (ou a page do gym) injeta `window.__APP_CONFIG__ = {userId, siteToken, branding, modules}` resolvido por host — mesmo padrão da injeção de analytics; o client lê sem round-trip. _Modifica layout/page._
- [x] **Manifest + scope PWA para hosts de gym**: o `app/manifest.webmanifest/route.ts` (já por host) devolve, para hosts de ginásio, `display: standalone`, `scope: "/"`, `start_url: "/"`, nome+ícones do tenant (fallback plataforma). Confirmar que só afeta hosts gym. _Modifica manifest route._
- [x] **Shell client a arrancar**: `AppGymShell` monta React Query + `BrowserRouter` + tema (dark/light do gymnoprado) e renderiza um placeholder navegável (2 rotas dummy). Prova o modelo "SPA client-side dentro do Next". _Cria shell; sem tocar na API._

## F1 — Portar o gymnoprado (o grosso)

- [x] **Trazer a fonte para o engine**: copiar `gymnoprado/src` para `site-engine/components/appgym/` (ou `app-gym/`), com `"use client"` nos pontos de entrada. Isolado — nada fora deste diretório importa dele. _Cria diretório._
- [x] **Config runtime (matar VITE_*)**: substituir `import.meta.env.VITE_USER_ID`/`VITE_SITE_TOKEN`/`VITE_API_BASE_URL` por leitura de `window.__APP_CONFIG__` + env do Next (`NEXT_PUBLIC_API_BASE_URL`). `lib/appConfig.ts` passa a ler a config injetada. _Modifica appConfig + client axios._
- [x] **Cliente de API + Kubb**: axios com `baseURL` + `X-Site-Token` da config; refresh de token do customer (cookies httpOnly + CSRF) como hoje. Regenerar/portar os hooks Kubb `src/gen/` contra o spec do gym. _Porta api/ + gen/._
- [ ] **Stores + offline (client-side, porta 1:1)**: `useActiveWorkout` (wall-clock `endsAt`), `usePendingLogs` (fila + dedup por `clientUuid`), `usePendingLogsSync` (gatilhos online/visibility), `useTheme`. localStorage com **namespace por tenant** (chave inclui `userId`) para não misturar sócios de 2 ginásios no mesmo browser. Testes das stores. _Porta store/ + hooks/._
- [x] **Ecrãs de treino (núcleo)** _(transplante; re-verificar ao vivo com programa semeado)_: `Dashboard`, `Workouts`, `WorkoutDetail` e **`WorkoutExec`** (full-screen: cronómetro de descanso, wake-lock, vibração+beep `lib/feedback`, press-and-hold steppers, status-bar). É a UX central — portar com fidelidade e verificar no dispositivo. _Porta screens/ + lib/._
- [x] **Ecrãs restantes**: `History`, `Progress` (gráficos), `Profile`, `CalendarSync`, `WorkoutEditor`. _Porta screens/._
- [x] **Auth do sócio (scoped por host)**: login/registo/recuperar/reset scoped pelo `userId` do host (email de cliente é único por tenant). Reutiliza o fluxo de refresh. _Porta auth screens._
- [x] **i18n em bundle + override CMS (D6)**: converter as ~700 chaves `gym.app.*` (do `content-import.csv` atual) → bundle estático `pt`+`en`; resolução em cascata `CMS do tenant → bundle → fallback PT`. Script one-off CSV→JSON. _Cria i18n bundle + resolver._
- [x] **Service worker offline no engine**: SW (Workbox/next-pwa) scoped a hosts de gym — precache do shell + `NetworkFirst` para `/api/websites/gym` (timeout 3s), como o `vite.config.ts` do gymnoprado. Push (VAPID) reusado. Registar SÓ em hosts de ginásio. _Cria SW + registo condicional._
- [ ] **Web Push + notificações**: portar `lib/push.ts` + `push-sw.js` (subscribe/unsubscribe `/websites/notifications/push/*`, `notificationclick` → deep-link da app). _Porta push._

## F2 — Migração + apagar o site gym

- [x] **Apagar o site de marketing gym**: remover `components/blocks/{Gym,GymPlans,HeroGym,AboutGym,GalleryGym}.tsx`, `app/gym.css`, e as variantes "gym" no `BlockRenderer.tsx` + imports. Confirmar (tsc+build+themeVars.test) que barber/stand ficam intactos. Ajustar o seed/template gym da API (deixa de semear blocos de marketing; o site gym é a app). _Apaga blocos gym._
- [ ] **Migração do gymnoprado real**: garantir subdomínio reclamado pelo tenant ginásio; página de "nova morada" no deploy antigo com deep-link (a PWA instalada antiga não migra sozinha); contas/tokens dos sócios continuam válidos (API não muda). Desligar o deploy antigo. _Infra + página de despedida._
- [ ] **Guard de convite sem subdomínio**: tenant de ginásio sem subdomínio não pode convidar sócios (aviso no BO + CTA); item no FirstValueChecklist do gym. _Modifica BO._
- [ ] **Smoke/e2e multi-tenant**: 2 tenants de ginásio (isolamento de sessão/offline/config por host) + verificação no site VIVO página a página (login→treino→offline→sync). _e2e._

## Review
- [ ] **Design review** por fase: /design-review contra o brief + verificação no dispositivo real (offline, instalar PWA, cronómetro em background) — os gates automáticos não cobrem isto.
- [ ] **Security review** antes de F2 fechar: isolamento por host/tenant no config-endpoint + no localStorage por-tenant + no site-token injetado.
