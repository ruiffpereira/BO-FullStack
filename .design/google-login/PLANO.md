# Login com Google para os clientes dos sites — PLANO (B28)

> Estado: **decidido (2026-10-19)**, a construir na ronda grande. Desenho original (2026-09-26) em
> `docs/5 - Historico/5.1 - tarefas feitas.md#b28` (as fases do site-engine caíram com o B35). Decisões em `DECISOES.md` (2026-10-19 · B28).

## Para quem

Os **clientes dos negócios** nos sites (clientes da agenda, da loja, sócios) — **não** os donos nem os membros no
Backoffice. Nesta ronda, **só o tifas-barber**.

## Decisões

1. Mesmo email já com conta → **entra nessa conta** (só com `email_verified` do Google); convite de sócio pendente
   fica activo.
2. Sai o ramo antigo `provider: "google"` do `/login` (não verifica `email_verified` nem `blocked`, o tenant pode vir
   do body, não guarda o `sub`).
3. **Um projecto Google, uma flag global** (`CUSTOMER_GOOGLE_LOGIN`).
4. O ecrã do Google diz **RufVision** (aceite).

## Desenho — um só ponto de regresso, na API

```
site  ──▶ API /websites/customers/google/start?return_to=<url do site>
            · tenant tirado do HOST do return_to (a mesma função da guarda do domínio ocupado = allowlist contra
              open redirect); PKCE + state + nonce ligados ao browser (cookie)
      ──▶ Google (consentimento "RufVision")
      ──▶ API /websites/customers/google/callback   ← o ÚNICO redirect URI registado no Google, para sempre
            · valida state/nonce/PKCE, email_verified, blocked; guarda Customer.googleSub
            · cria código de uso único (60 s, hash na BD, preso ao tenant e à origem)
      ──▶ return_to?code=…
site  ──▶ POST /websites/customers/google/exchange { code } → a mesma resposta/sessão do /login
```

- Modelos (migração): `Customer.googleSub` (único por tenant), `CustomerLoginCode`.
- A mesma conta Google em dois tenants = **dois clientes separados** (o `sub` é por tenant).
- Flag desligada → `start` responde 404/“indisponível” e o botão não aparece (o site pergunta à API).
- Envs **opcionais** (não entram no `PROD_REQUIRED_ENV_VARS`): `CUSTOMER_GOOGLE_LOGIN`,
  `CUSTOMER_GOOGLE_CLIENT_ID`, `CUSTOMER_GOOGLE_CLIENT_SECRET` — projecto **separado** do Google Calendar (scopes
  não sensíveis: `openid email profile`).
- `@swagger` → Kubb no tifas (e no BO se o spec o incluir).

## Site — tifas-barber

- Botão **"Continuar com Google"** no `AuthModal` (login e registo), só se a API disser que está ligado.
- Página/handler de regresso que troca o `code` e fecha o modal com sessão.
- Pedir o telefone no 1.º login se a marcação o exigir.
- Textos de erro em PT/EN (CMS do tifas).
- **PWA instalada no iPhone:** o regresso do Google pode abrir no Safari em vez da app — testar no dispositivo
  (nenhum gate o vê). Se acontecer, o regresso mostra "Volta à app" e a sessão fica no browser.

## Testes (no fim da ronda)

- `seguranca-api` + `pentest-api`: open redirect pelo `return_to`; state/nonce trocados entre browsers (o ataque do
  B5 ao Calendar); código reutilizado/expirado/de outro tenant; `email_verified: false`; cliente `blocked`; o mesmo
  `sub` em dois tenants; o ramo antigo do `/login` desapareceu.
- tifas: build + fluxo com o Google simulado.

## Do lado do dono

1. Google Cloud → **projecto novo** "RufVision — clientes" → ecrã de consentimento (nome **RufVision**, logótipo,
   email de suporte, domínio `rufvision.com`) → credencial **OAuth Web** com o redirect URI
   `https://api.rufvision.com/api/websites/customers/google/callback` (o caminho final confirma-se no fim da
   construção e fica escrito no `TASKS.md`).
2. Coolify → API: `CUSTOMER_GOOGLE_CLIENT_ID` e `CUSTOMER_GOOGLE_CLIENT_SECRET`; **reiniciar**. Só depois da prova:
   `CUSTOMER_GOOGLE_LOGIN=true` e reiniciar.
3. Gate: entrar com Google no tifas (computador e iPhone com a app instalada); a mesma conta Google noutro tenant dá
   outro cliente.
