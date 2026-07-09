# RUNBOOK — Levantar o Umami (self-host) no Coolify

_Par do DESIGN_BRIEF.md. Isto é o único passo do user na Fase 3B; o resto é código (env-gated, liga-se sozinho quando estas envs existirem)._

## 1. Criar o serviço no Coolify

Opção A (recomendada): **Coolify → New Resource → Service → Umami** — o template oficial levanta o Umami + PostgreSQL de uma vez.

Opção B (docker-compose manual):

```yaml
services:
  umami:
    image: ghcr.io/umami-software/umami:postgresql-latest
    environment:
      DATABASE_URL: postgresql://umami:<PASS_DB>@umami-db:5432/umami
      APP_SECRET: <string aleatória longa>   # ex.: openssl rand -hex 32
    depends_on:
      - umami-db
  umami-db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: umami
      POSTGRES_USER: umami
      POSTGRES_PASSWORD: <PASS_DB>
    volumes:
      - umami-db-data:/var/lib/postgresql/data
volumes:
  umami-db-data:
```

## 2. Domínio

- Atribuir `umami.rufvision.com` ao serviço (proxy do Coolify trata do SSL).
- **⚠ Cloudflare:** se o subdomínio ficar proxied (nuvem laranja) com Bot Fight Mode, os pedidos server-to-server da NOSSA API ao Umami (`/api/auth/login`, `/api/websites`, `/api/websites/:id/stats`) podem ser bloqueados como bot — o mesmo problema que já tivemos com o fetch do spec do Kubb. Soluções (uma delas):
  - pôr `umami.rufvision.com` em **DNS-only** (nuvem cinzenta), ou
  - regra WAF **Skip** para o host `umami.rufvision.com` com path `/api/*`.
  - O `script.js` e o beacon dos visitantes (browser) não costumam ser afetados.

## 3. Primeiro login

1. Abrir `https://umami.rufvision.com` → login default **admin / umami**.
2. **Mudar já a password** (Settings → Profile). Guarda-a — a API vai usá-la.
   (Podes criar um utilizador dedicado `api@...` em vez de usar o admin; qualquer utilizador com permissão de criar websites serve.)

## 4. Ligar a API (envs no Coolify, app da API)

```
UMAMI_URL=https://umami.rufvision.com
UMAMI_USERNAME=admin           # ou o user dedicado
UMAMI_PASSWORD=<a password>
```

Redeploy da API. As 3 envs são **opcionais como conjunto** (sem elas a feature fica desligada e tudo se comporta como hoje); com elas, o provisionamento automático liga-se.

## 5. Prova (depois do deploy)

1. Num tenant de teste, reclamar um subdomínio (ou re-guardar o domínio nas Estatísticas) → o website deve aparecer sozinho no painel do Umami.
2. Abrir o site publicado → ver no HTML o `<script defer src="https://umami.rufvision.com/script.js" data-website-id="...">` (e confirmar que `/preview` NÃO o tem).
3. Visitar o site e ver a visita a entrar no Umami em tempo real.
4. Página **Estatísticas** do BO do tenant → deve mostrar os números do Umami.
5. Tenants antigos: correr o backfill (`scripts/backfillUmami.ts` — comando exato no output do build) UMA vez.

## Legado

- Os 3 sites standalone (gymnoprado / tifas-barber / winterplateau) continuam no **Plausible** (`PLAUSIBLE_URL`/`PLAUSIBLE_API_KEY` mantêm-se) — a página Estatísticas deles continua a ler de lá (fallback automático). Migração deles = fatia futura.
- Não desligar o Plausible por agora.
