# RUNBOOK — migrar o ginásio real para a app dentro do site-engine

**Criado:** 2026-08-20 · **Estado:** pronto a executar, à espera do dono
**Contexto:** épico `app-cliente-final`. O subdomínio do tenant de ginásio passa a **ser** a app do sócio; o deploy standalone `gymnoprado.rufvision.com` é retirado.

> **O que está em jogo:** `gymnoprado.rufvision.com` está **vivo, com sócios reais**. Nada neste runbook é irreversível até ao passo 6, e o passo 7 (desligar) é o único sem volta fácil.

---

## Descoberta que muda o plano (2026-08-20)

O tenant real do ginásio foi criado **à mão**, não por signup self-serve. E **não existe caminho suportado para lhe pôr `template = "gym"`**, que é a condição de que o renderer depende para servir a app em vez de blocos:

- `PUT /website` ignora `template` de propósito — `EDITABLE_FIELDS` (`controllers/backoffice/website/siteController.ts:39`) só tem `theme`/`pages`/`defaultLocale`/`activeLocales`, por proteção anti mass-assignment (testada).
- A galeria de templates e o `GET /website/templates` foram **removidos** a 2026-08-12 (decisão do dono: o template fixa-se no signup e nunca muda).
- Um tenant sem linha `Site` recebe `emptySite()` com `template: null`.

Sem `template === "gym"`, o renderer cai no caminho dos blocos — e os blocos de marketing do ginásio foram apagados no F2. O subdomínio não serviria a app: não serviria nada.

**Resolvido com um script**, `API-FullStack/scripts/makeGymAppTenant.ts`, que reutiliza o helper do signup (`applyTemplateForVertical(userId, "gym")`, fonte única em `src/data/siteTemplates.ts`). Dry-run por defeito, exige alvo explícito, recusa substituir um site com conteúdo sem `--force`, e **não** reclama subdomínio nem publica — isso fica para ti, no Backoffice.

---

## Ordem obrigatória (o porquê da ordem)

O `GET /websites/site?host=` filtra por **`published: true`**. Um site com subdomínio reclamado mas não publicado **não resolve** — o host devolve 404. Logo: template → subdomínio → publicar → verificar. Só depois se mexe no deploy antigo.

---

## Passo 0 — PREFLIGHT (fazer com um tenant de TESTE, nunca com o real)

**Porque é obrigatório:** a app do ginásio dentro do engine nunca foi verificada num **subdomínio de produção**. Foi verificada em `devgym.localhost` (local) e o núcleo foi provado ao vivo, mas o caminho "host público real → config por host → app → login do sócio" ainda não correu em produção. Não se descobre isso com sócios reais a assistir.

- [ ] **Tu:** escolher/criar um tenant de teste de ginásio (há contas de teste de 2026-08-11 — ver a memória; os subdomínios delas não estão registados em documento nenhum, o que é por si um sinal de que convém registá-los aqui).
- [ ] **Tu:** reclamar-lhe um subdomínio no Backoffice (Website → O meu site).
- [ ] **Eu:** correr o script para lhe pôr o template gym.
- [ ] **Tu:** publicar o site desse tenant.
- [ ] **Ambos:** abrir `https://<sub-teste>.rufvision.com` e verificar, **num telemóvel real**: a app carrega, o registo/login do sócio funciona, o dashboard mostra dados, a PWA instala-se, funciona offline, e o cronómetro de descanso continua a contar com o ecrã apagado.
- [ ] **Verificar também**, porque decide o que dizemos aos sócios: **o sócio tem de voltar a autenticar-se no host novo?** O access token vive por origem (perde-se), mas o refresh é um cookie no domínio da API — se for enviado cross-origin, a sessão pode restaurar-se sozinha. **Não assumas nenhuma das hipóteses**: testa e anota aqui a resposta. Se for preciso re-login, acrescentamos uma linha à página de despedida a avisar (hoje ela diz que a conta e o histórico continuam seguros, o que é verdade, mas não fala de entrar outra vez).
- [ ] **Verificar** que as notificações push funcionam no host novo (subscrição nova, por origem — a antiga fica presa ao host antigo; ver passo 7).

**Gate:** se qualquer um destes falhar, o runbook pára aqui. Nada do que vem a seguir toca no ginásio real.

---

## Passo 1 — Reclamar o subdomínio do tenant real · **TU**

Backoffice → Website → **O meu site** → secção Domínio.

- Escolher o subdomínio definitivo (é o endereço que os sócios vão usar para sempre — escolher com cuidado, mudar depois repete esta migração inteira).
- ⚠ A secção Domínio só aparece com `canEditStructure` (`VIEW_SITE_BUILDER` ou `VIEW_ADMIN`). O signup concede essa permissão; **a criação manual não** — e este tenant foi criado à mão. Se não vires a secção, atribui-te `VIEW_ADMIN` ou dá `VIEW_SITE_BUILDER` ao tenant.

**Rollback:** reclamar outro subdomínio (o antigo liberta-se).

---

## Passo 2 — Pôr o template gym · **EU** (script)

**Onde correr: DENTRO do contentor da API em produção** (Coolify → serviço da API → terminal). Não localmente: a única configuração de base de dados nesta máquina é `*_DEV`, a apontar para o MySQL do docker local — um script corrido daqui mexeria na BD de **desenvolvimento**, não na de produção.

Funciona no contentor porque o `Dockerfile` faz `pnpm install` **sem** `--prod` e `COPY . .` — logo o `ts-node` e o código-fonte estão na imagem, e o processo já tem as variáveis `DB_*` de produção (as mesmas que a app usa; se a API arranca, o script liga-se). É o mesmo mecanismo do `pnpm backup`, que também é um script TS pensado para produção.

```bash
# no terminal do contentor da API (cwd = /app)
pnpm exec ts-node --transpile-only scripts/makeGymAppTenant.ts --email <email-do-tenant>            # dry-run: mostra o antes/depois, não escreve
pnpm exec ts-node --transpile-only scripts/makeGymAppTenant.ts --email <email-do-tenant> --commit   # aplica
```

O script imprime o estado antes (template, subdomínio, published, nº de páginas, permissão `VIEW_GYM`) e os passos que faltam. **Se o tenant já tiver páginas, recusa sem `--force`** — e o guard olha para as **páginas**, não para o template, de propósito: um tenant antigo pode ter páginas com `template: null`, e o helper trata "sem template" como "site vazio", o que substituiria essas páginas sem pedir nada. Se o script recusar, decidimos juntos, porque significa substituir um site que existe.

**Rollback:** o template anterior era `null` (ou o que o script imprimiu no "antes"); reverter é voltar a pôr esse valor. Guarda o output do dry-run.

---

## Passo 3 — Publicar · **TU**

Backoffice → Website → O meu site → **Publicar**.

Sem isto o host devolve 404 (o público filtra por `published: true`).

**Rollback:** despublicar.

---

## Passo 4 — Verificar o host real, com o deploy antigo AINDA A SERVIR · **AMBOS**

`https://<sub>.rufvision.com` deve servir a app do sócio. Testar com uma conta de sócio real (a tua, ou uma de teste desse ginásio) num telemóvel: login, dashboard, um treino, offline.

**Este é o último gate barato.** Neste momento os sócios continuam todos no deploy antigo e não notaram nada. Se algo estiver errado, corrige-se sem pressa.

---

## Passo 5 — Convidar/avisar (opcional, mas recomendado)

Se quiseres um período de coexistência, os dois endereços funcionam ao mesmo tempo: o antigo serve a app velha, o novo serve a nova, e ambos falam com a **mesma API** e os mesmos dados. Podes pedir a um punhado de sócios para usarem o endereço novo antes de virar a chave.

---

## Passo 6 — Ligar a página de despedida no deploy antigo · **TU**

No Coolify, no serviço do `gymnoprado`, definir a **build-time variable**:

```
VITE_MIGRATED_TO = https://<sub>.rufvision.com
```

e fazer **redeploy** (é build-time — mudá-la sem rebuild não faz nada).

A partir daí, quem abrir o endereço antigo — incluindo a PWA instalada no ecrã inicial — vê a despedida, com um botão para a morada nova; a página desregista o service worker e limpa as caches para a app velha não ficar presa.

**Verificado (2026-08-20), e o resultado é mais forte do que se esperava:** com a env definida, o texto e o URL entram no bundle. **Sem a env, o componente da despedida nem chega a ser entregue** — o Vite substitui `import.meta.env.VITE_MIGRATED_TO` por `undefined`, o ramo passa a código morto e o Rollup elimina-o. Confirmado no **bundle vivo em produção** depois do deploy deste trabalho: o texto "Mudámos de casa" não aparece lá, e os únicos URLs da plataforma no bundle são o da API e o do Plausible. A app está exactamente como estava. O `applyStoredTheme()` e o `initPlausible()` correm nos dois caminhos de propósito — o tema para a despedida não aparecer sem cores, e o Plausible para se poder **medir quantos sócios ainda abrem o endereço antigo**.

**Rollback:** apagar a env + redeploy. A app antiga volta ao normal.

---

## Passo 7 — Desligar o deploy antigo · **TU**, e sem pressa

**Não desligar por calendário — desligar por número.** Usa o Plausible do `gymnoprado.rufvision.com`: quando as visitas ao endereço antigo caírem para perto de zero e estabilizarem, os sócios já migraram. Antes disso, cada desligamento é um sócio que abre a app e não encontra nada (nem sequer a despedida).

Antes de desligar, ter em conta:

- **Push:** as subscrições push dos sócios estão presas à origem antiga. Depois de migrarem, têm de reactivar as notificações no endereço novo (Perfil → notificações). As subscrições antigas morrem sozinhas — o envio falha e a API poda as obsoletas.
- **Contas e dados:** nada a fazer. A API é a mesma; contas, histórico, treinos e mensalidades não se movem.

---

## Resumo — o que é teu e o que é meu

| Passo | Quem |
|---|---|
| 0 · Preflight com tenant de teste (subdomínio + publicar + verificar no telemóvel) | **Tu** (+ eu no script e na análise) |
| 1 · Reclamar o subdomínio do tenant real | **Tu** |
| 2 · Pôr `template = "gym"` (script) | **Eu** |
| 3 · Publicar | **Tu** |
| 4 · Verificar o host real | Ambos |
| 6 · `VITE_MIGRATED_TO` no Coolify + redeploy | **Tu** |
| 7 · Desligar o antigo, guiado pelo Plausible | **Tu** |

**Bloqueio real — não é identificar o tenant, é o acesso a produção.** Verificado a 2026-08-20:

- O tenant do ginásio **não tem subdomínio nem domínio próprio registados**: `GET /api/websites/app/config?host=gymnoprado.rufvision.com` devolve **404**, e esse endpoint resolve exactamente por `Site.customDomain` ou `Site.subdomain`. Ou seja, o passo 1 é mesmo necessário e não está feito à socapa.
- A app viva **não tem o `userId` embutido** (zero UUIDs no bundle de produção): identifica-se pelo site-token, que o servidor resolve. Não há nada a ler dali.
- O `VITE_USER_ID` do `.env` local é da BD de **desenvolvimento** (`VITE_API_BASE_URL=http://localhost:3001/api`) — os UUIDs são por base de dados, logo não serve para produção.
- **Nesta máquina não existem credenciais de produção** — o `.env` da API só tem chaves `*_DEV` (`DB_HOST_DEV=mysql`). Vivem no Coolify.

Conclusão: o passo 2 corre-se **no terminal do contentor da API** (ver o passo 2), e isso é acesso que só o dono tem. Não precisas de me dizer o `userId`: o script aceita `--email`, e o email do ginásio já o conheces. Os dois comandos são copy-paste e o primeiro não escreve nada.
