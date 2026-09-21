# Análise — os dois caminhos de site

**Criado:** 2026-09-21 · **Pedido do dono:** *"já tenho os dois métodos implementados, mas acho que
está um pouco confuso"*

---

## O modelo de negócio, como o dono o descreveu

1. Os clientes dele têm **backoffice + site para os clientes deles**.
2. Escolhem **uma de três verticais** — gym, agenda, loja — e **depois não podem mudar**.
3. O backoffice tem de conseguir ligar **websites que não são do site-engine**.
4. Esses **não são criados pelos clientes** — são criados **pelo dono**, para eles.

Chamemos-lhes **caminho A** (site-engine, self-serve) e **caminho B** (site próprio, feito pelo dono).

---

## A raiz: há dois produtos e nenhum tem nome

**Não existe um único campo que diga de que tipo é um tenant.** Não há `siteMode`, `isStandalone`,
nada. A distinção é **inferida**, e o código infere-a de **sete sinais diferentes**, nenhum
conclusivo:

| Sinal | O que realmente diz |
|---|---|
| Tem linha `Site` | Tem *alguma* config de site-engine — não que seja o site real |
| `Site.subdomain` | O host resolve no renderer |
| `Site.published` | O host devolve conteúdo em vez de 404 |
| `Site.template` | Que vertical foi semeada |
| `User.vertical` | Vertical escolhida no signup (só existe em tenants recentes) |
| `User.websiteDomain` | Domínio para o Plausible — pensado para o caminho B, **mas hoje também reescrito pelo caminho A** |
| `User.analyticsSiteId` | Alguém provisionou estatísticas |
| Ter `SiteToken` | O dono gerou um segredo — o sinal mais próximo de "é caminho B", mas é um artefacto de auth |

**E todos podem coexistir no mesmo tenant.** O `tifas-barber` é a prova: tem site próprio em
produção **e** uma linha `Site` publicada num subdomínio do engine.

Tudo o resto nesta análise é consequência disto. O problema **não é ter dois caminhos** — é um
modelo de negócio legítimo. O problema é **nenhum deles estar nomeado**, obrigando cada pedaço de
código a adivinhar, e a adivinhar de maneiras diferentes.

---

## Os danos, por gravidade

### 1. As estatísticas de um tenant de caminho B passam a mostrar os números errados

**⚠ Isto é uma regressão introduzida pelo fix B9.1, a 2026-09-20. Causa minha.**

A leitura tem prioridade rígida (`analyticsController.ts:473`):

```ts
if (user?.analyticsSiteId && umamiConfigured()) → Umami, sempre
else → Plausible via user.websiteDomain
```

E o provisionamento, **depois do B9.1**, corre **sempre** — usando o **host do subdomínio do
engine**, nunca o `websiteDomain` real (decisão deliberada, comentada em `siteController.ts:222`).

Consequência num tenant de caminho B que também tenha subdomínio no engine:

- `analyticsSiteId` fica preenchido, a apontar para o site **de teste** do engine
- o Umami passa a ganhar, sempre
- a resposta mostra `domain: user.websiteDomain` — **o domínio real**
- mas os números vêm do **outro site**

Ou seja: **números de um sítio, etiqueta de outro, sem nada no ecrã a denunciar.**

**Antes do B9.1 isto não acontecia**, porque um tenant com domínio próprio saía cedo e nunca era
provisionado. O B9.1 estava certo na intenção (um tenant com domínio próprio também merece
estatísticas) mas não previu o caso de o site real ser externo.

**Estado:** latente, não necessariamente activo. Dispara na próxima vez que alguém reclamar o
subdomínio ou gravar o domínio desse tenant.

### 2. Duas fontes de verdade para a vertical, que divergem em silêncio

`User.vertical` e `Site.template` guardam o mesmo facto de negócio. Escritos por caminhos
diferentes, sem validação cruzada.

Pior: `PUT /users` com uma vertical nova chama `applyTemplateForVertical(..., { force: false })`,
que **só escreve se o site estiver vazio**. Num tenant com conteúdo é um **no-op silencioso** — o
`User.vertical` muda, o `Site.template` fica, e a resposta não diz nada.

Em runtime só o `Site.template` conta. O `User.vertical` fica a mentir na ficha do Admin.

### 3. O Backoffice mente a um tenant de caminho B

A página Website assume **sempre** o modelo do site-engine. Para um tenant de caminho B:

- **sem linha `Site`:** mostra o fluxo "escolher template → reclamar subdomínio → publicar" e diz
  *"Rascunho"* — a um cliente cujo site está **no ar e a funcionar**.
- **com linha `Site`** (o caso tifas): mostra *"Publicado"*, com o URL do engine e um botão **Ver
  site** que abre o site **errado**.

Não há uma palavra na UI a dizer *"o teu site vive fora desta plataforma"*.

### 4. Publicar é irreversível

`publishSite` existe. **`unpublishSite` não.** O único sítio que escreve `published: false` é o
default de um site que ainda não existe. Depois de publicado, **não há caminho na API nem no
Backoffice para despublicar** — só edição directa na base de dados.

É por isso que o site de teste do tifas está preso no ar.

### 5. A `RENDERER_API_KEY` não identifica tenant nenhum

Três credenciais entram pelo mesmo middleware. Duas trazem identidade (`SiteToken`, JWT
`app-site`); a `RENDERER_API_KEY` é um **bypass total** — não fixa `req.user`, vale para todos os
tenants, em todos os endpoints públicos, incluindo mutações.

Isso significa que, no caminho A, **o isolamento multi-tenant não vive na autenticação** — vive na
correcção do código do renderer. No caminho B vive na credencial. São dois modelos de confiança
diferentes para a mesma fronteira, e só um deles está documentado como tal.

### 6. Dois templates sem caminho de produto

O catálogo tem cinco (`barber, gym, salon, loja, generic`), o signup expõe três. O `salon` e o
`generic` só são alcançáveis por `PUT /users` — que aceita `vertical` como `any`, **sem enum, sem
zod, sem swagger**.

---

## O que está bem, e não se mexe

- **Ter dois caminhos.** É um modelo de negócio legítimo: clientes self-serve e clientes montados à
  mão não têm de ser a mesma coisa.
- **A imutabilidade da vertical no caminho A.** Está garantida por ausência de caminho — `PUT
  /website` filtra `template`, a galeria foi removida. É suficiente, e a excepção (`makeGymAppTenant`)
  é do dono, documentada, com dry-run e `--force`.
- **O isolamento por `userId`** e os ~310 testes de segurança que o sustentam.

---

## O que eu mudaria

### Primeiro, e urgente: parar o dano 1

Duas hipóteses, e são independentes do resto:
- **Imediata:** limpar o `analyticsSiteId` dos tenants de caminho B, para voltarem ao Plausible.
- **De fundo:** a escolha de provider deixa de ser *"tem `analyticsSiteId`?"* e passa a ser
  *"que tipo de site é este tenant?"* — o que exige o passo seguinte.

### Depois: dar um nome à coisa

**Um campo em `User`** — `siteMode`: `engine` · `external` · `none`.

É pequeno, e desfaz a raiz. Com ele:

| Onde | Deixa de adivinhar |
|---|---|
| Estatísticas | Escolhe o provider pelo modo, não por um id que calhou existir |
| Provisionamento | Sabe se deve sequer tocar no Umami |
| Página Website | Pode dizer "o site deste cliente vive fora da plataforma" |
| Admin | Mostra o tipo de cada cliente, em vez de o dono ter de deduzir |

### Depois disso, por ordem de valor

1. **`unpublishSite`** — a assimetria que deixa erros presos para sempre.
2. **Uma fonte de verdade para a vertical.** Ou `User.vertical` deixa de existir, ou passa a ser
   derivado de `Site.template`. Dois campos para o mesmo facto nunca ficam sincronizados.
3. **Validar `vertical` no `PUT /users`** — zod e enum, como em todo o resto.
4. **Decidir o que fazer com `salon` e `generic`** — expor ou apagar.
5. **Documentar o modelo de confiança da `RENDERER_API_KEY`** em `docs/ARQUITETURA.md` — que o
   isolamento do tráfego do renderer depende do renderer, não da autenticação.

---

## O que isto não é

Não é uma proposta de reescrever nada. O `siteMode` é **um campo e uma migração**; o resto são
consequências que se podem fazer uma de cada vez. E nenhuma delas muda o que já funciona para os
clientes de caminho A, que são a maioria do produto.
