# Auditoria de segurança por agentes — plataforma inteira

**Data:** 24–25 de Agosto de 2026
**Âmbito:** API (`API-FullStack`), renderer e app do sócio (`site-engine`), Backoffice.
**Método:** 7 agentes em white-box, um por superfície de ataque, com instruções para **preferir lista vazia a enchimento** e para lerem primeiro os testes de segurança existentes. Cada achado foi depois **verificado por leitura directa** antes de virar correcção — dois deles mudaram de forma nessa verificação, e um mudou de gravidade.

**Contexto que enquadra os resultados:** a plataforma já tinha **~310 casos de teste de segurança** a passar (`pentest.test.ts`, `pentest-public.test.ts`, `pentest-red.test.ts`, `pentest-aggregates.test.ts`, `isolationSweep.test.ts`, `rbac.test.ts`, `signup_security.test.ts`, …) a cobrir IDOR cross-tenant, confusão de tokens, mass-assignment, escalada de privilégios, injecção em filtros/ordenação, fuga de campos e sangramento de agregados. É por isso que a maior parte das superfícies voltou limpa — não por falta de procura.

---

## Resultado por superfície

| Superfície | Achados | Estado |
|---|---|---|
| Isolamento multi-tenant | 1 | corrigido |
| AuthN / AuthZ | 2 | corrigidos |
| Público / cliente final | 1 | corrigido |
| Injecção e validação | 1 | corrigido |
| Segredos e fuga de dados | 2 | 1 corrigido, 1 já reportado antes |
| Uploads e ficheiros | 3 | 2 corrigidos, 1 decidido em contrário (ver abaixo) |
| **Caminhos de dinheiro** | **0** | **limpo** |

O agente do dinheiro devolveu zero achados **com a lista do que verificou e descartou**: ordem da verificação de assinatura do webhook, idempotência (ecommerce e platform billing), tampering de preço no checkout, cupões acumuláveis/reutilizáveis, cobertura do `billingGate` em todas as rotas de escrita, isolamento das mensalidades do ginásio e `isDefault` órfão. É o tipo de "nada encontrado" que vale alguma coisa.

---

## Corrigido

### 1. `POST /schedule/working-hours` — sequestro de linha via chave primária · **média**
`WorkingHours.upsert({ ...h, userId })` espalhava o objecto do cliente inteiro, **incluindo a PK**. A anotação de tipo em TypeScript não filtra nada em runtime.

O que o agente não viu e a verificação apanhou: **não existe índice único em `userId`+`dayOfWeek`** — a única chave única é a PK. Logo o upsert só actualiza se o cliente enviar o `workingHoursId`, e o Backoffice envia-o mesmo (devolve no POST as linhas que leu no GET). Isso muda a correcção: não bastava deixar de aceitar o id, era preciso **aceitá-lo e verificar o dono**, senão cada gravação criaria linhas novas.

Tenant B enviava a PK de uma linha de A → `UPDATE` por PK → todos os campos reescritos, `userId` incluído → a linha mudava de dono. Agora confirma-se o dono antes de escrever e os campos são copiados por allowlist. O DELETE já tinha teste de isolamento; o POST nunca teve. **Commit `bd89246`.**

### 2. `DELETE /uploads` — travessia de caminho na key · **alta** (impacto dependente do storage)
A verificação de dono era `key.startsWith(`${userId}/`)` — substring, não caminho. O tenant B enviava `<idB>/../<idA>/foto.webp`: começava pelo id dele, passava, e seguia sem canonicalização para o `DeleteObjectCommand`. Em S3 puro o `..` é opaco; o gateway do SeaweedFS assenta num Filer com árvore de diretórios real.

**O teste que existia dava falsa confiança:** chamava-se "path traversal across users" mas autenticava-se como B com uma key começada pelo id de **A** — era recusada pelo prefixo e nunca exercitava o `..`. Renomeado, e acrescentado o caso a sério. **Commit `9fb9fe0`.**

### 3. `/api/integrations/google/*` sem `VIEW_ADMIN` · **média**
As 5 rotas autenticadas só tinham `authenticateToken`. No Backoffice isto vive em Admin → Integrações, já gated por `VIEW_ADMIN` — era um gate só de UI. Um funcionário do tenant apenas com `VIEW_SCHEDULE` podia desligar a sincronização do calendário do negócio, ligar a **sua** conta Google à integração do tenant, ou mudar o Place ID que alimenta as reviews do site. Não atravessava tenants. **Commit `efb2899`.**

### 4. `RENDERER_API_KEY` comparada com `===` · **baixa**
O mesmo segredo que o `authRateLimitKey` já comparava com `safeEqual`. Interessa porque este ramo é um **bypass total** do `authenticateTokenPublic` e a chave vale para todos os tenants, incluindo mutações. **Commit `efb2899`.**

### 5. Três rotas anónimas sem `publicRateLimit` · **baixa**
`GET /websites/app/config`, `/websites/site/preview` e `/websites/site` eram as únicas rotas 100% anónimas da árvore sem o limite de 30/min que todas as outras usam — ficavam com os 600/min globais. O config ainda **assina um JWT de 7 dias** por pedido. **Commit `c3d3a6d`.**

### 6. Valores de pagamento negativos em marcações · **baixa/média**
`Number(paymentCash) || 0` — o `||` só troca por 0 quando o valor é *falsy*, e `-99999` não é. Era gravado, entrava no `totalSpent` do cliente e nos totais do dashboard, e promovia a marcação a "completed". *(À primeira, o guard foi parar ao ramo de **anular** pagamento em vez do de registar; o teste apanhou — 200 em vez de 400 — e foi movido.)* **Commit `c3d3a6d`.**

### 7. `PUT /profile` devolvia o `calendarToken` · **baixa**
Tirava só a `password` e devolvia o resto da linha, incluindo o segredo do feed `.ics` pessoal do cliente. Allowlist explícita, igual à do `GET /profile` irmão. **Commit `c3d3a6d`.**

### 8. CORS: `localhost` aceite em produção · **baixa** *(encontrado por mim, não por agente)*
O `isPlatformOrigin` aceitava `localhost` e `*.localhost` sem verificar o ambiente. Além disso não tinha teste nenhum — e não era testável através da app, porque em ambiente de teste o `PLATFORM_ROOT_DOMAIN` é `localhost` e as duas regras coincidiriam. Extraído para função pura + 12 testes, incluindo o que impede a confusão de sufixo (`evil<root>`). **Commit `563f760`.**

---

### 9. Upload de vídeo sem verificação de conteúdo · **média**
O caminho das imagens é sólido: o `sharp` tem de conseguir *decodificar* os bytes e re-codifica sempre para WebP, o que mata o vector do SVG/HTML servido tal-qual. O vídeo era gravado em streaming só com base no `Content-Type` declarado pelo cliente — trivial de falsificar. Não era XSS (a allowlist só tem 3 tipos de vídeo), mas permitia alojar até 100 MB de bytes arbitrários sob um URL de confiança da plataforma.

`sniffVideoContainer` lê os primeiros 12 bytes e exige que a família real bata com o tipo declarado: EBML para Matroska/WebM, ou uma caixa de topo válida de ISO BMFF para mp4/mov (que contam como a mesma família, porque distingui-las pelos bytes não é fiável). É verificação de contentor, não de codec — o suficiente para impedir o "declaro vídeo, envio outra coisa". **Commit `23baa83`.**

---

## Não corrigido, com razão

**Objectos gravados sem `Content-Disposition`** (baixa, do agente dos uploads). Os ficheiros são servidos pelo SeaweedFS, não pelo Express, por isso o único momento em que a API controla headers é na escrita. Mas estes ficheiros são servidos **inline** — imagens em `<img>`, vídeos em `<video>` — e um `Content-Disposition: attachment` partia exactamente o caso de uso. A mitigação real é a allowlist estrita de `Content-Type`, que já existia e agora está reforçada pela verificação de assinatura acima. Registado como decisão, não como pendência.

**Pistas não confirmadas**, registadas sem serem achados: o JWT `app-site` não tem revogação (só expira); SSRF teórico via SVG no `sharp` se o rasterizador seguir referências externas; `upsertPlatformSubscription` sem tratamento de `UniqueConstraintError` (autocura via reenvio do Stripe); `ContactInfo.tsx` no site-engine renderiza `href` sem `safeHref` mas é código morto sem importadores.

---

## Sondagens contra produção (só leitura)

Feitas com pedidos `GET` sem efeitos: sem escritas, sem enumeração em volume, sem nada que gerasse dados ou emails a clientes reais.

- **Cabeçalhos:** CSP, HSTS com `includeSubDomains`, `nosniff`, `X-Frame-Options`, `Referrer-Policy` — todos presentes.
- **CORS ao vivo:** `evilrufvision.com` e `rufvision.com.evil.com` **não** recebem `access-control-allow-origin`; um subdomínio legítimo de tenant recebe. A confusão de sufixo não passa em produção.
- **Autenticação:** 401 em `/customers`, `/products`, `/schedule/appointments`, `/gym/exercises`, `/expenses`, `/users`, `/admin/billing/subscriptions`, `/audit-logs`.
- **Erros:** `404 {"error":"site_not_found"}` e equivalentes — sem stack, sem SQL.
- **Feed `.ics` com token falso:** 404, sem distinguir inexistente de inválido.
- **Correcção do `localhost` confirmada em produção** (sondagem repetida depois do deploy): `http://localhost:5173` e `http://tenant.localhost:3000` deixaram de receber `access-control-allow-origin`. O fix do commit `563f760` está vivo.

---

## Teste ACTIVO contra produção (2026-08-25)

Feito o que é seguro fazer, e explicado o que fica de fora e porquê.

### Rate-limits — verificados AO VIVO, e só aqui é possível

Esta é a parte que **nenhum teste automatizado pode cobrir**: em ambiente de teste todos os limitadores excepto o global estão desligados de propósito (`config.isTest ? noLimit : …`). A única forma de observar a protecção é em produção.

- **`publicRateLimit` (30/min):** 35 pedidos a `GET /websites/site?host=<inexistente>` → **429 exactamente ao pedido 31**. Trinta permitidos, depois travado.
  Nota: isto é também prova directa de que a correcção do dia está deployada — **esta rota não tinha limitador nenhum antes** (commit `c3d3a6d`), só os 600/min globais.
- **`authRateLimit` (10/min):** 14 tentativas de `POST /users/login` com um email inexistente → **429 exactamente ao pedido 11**. Usado um email que não corresponde a conta nenhuma, de propósito: não há conta real a bloquear e o limitador é por IP.
- O limitador é **por IP e partilhado entre rotas** (`keyGenerator: clientIp`), não por rota — gastar o orçamento numa gasta-o em todas.

### Payloads malformados em endpoints de leitura

Dez payloads (injecção SQL, `UNION SELECT`, travessia de caminho, null byte, XSS refletido, operador NoSQL `[$ne]`, prototype pollution via `__proto__[x]`) contra `/websites/site`, `/websites/app/config` e `/websites/booking/services`.

Resultado: **404 terso com código fixo** (`site_not_found`, `not_found`) em todos. Zero 5xx, zero stack, zero erro de SQL, e o payload nunca é reflectido na resposta. Os endpoints de booking devolvem 401 — não são sequer alcançáveis sem site token.

### O que fica de fora, e porque não é uma lacuna

Escritas, fuzzing de mutações e enumeração em volume **não** foram feitos contra produção: criam dados lixo, disparam emails a sócios reais e podem bloquear contas de clientes.

Mas isso **não deixa um buraco na cobertura**, e vale a pena ser explícito: é precisamente o que os ~310 casos de teste de segurança já fazem, continuamente, contra a base de dados de teste descartável — escritas cross-tenant, mass-assignment, forjar identidade via JWT, IDOR em mutações, cupões cross-tenant no checkout. A suite corre verde (1701 testes).

A única lacuna real que sobra é **teste autenticado contra produção** (como um tenant a sério, com credenciais), que exige credenciais de produção e uma janela combinada.

---

## Gates

API: **1701 testes** em 83 ficheiros (mais 26 novos). site-engine: **466** em 31 (mais 10 novos). Backoffice: 37 ficheiros. Typecheck limpo nos três.

Cada correcção com impacto foi **provada nos dois sentidos** — o teste passa, e falha na assertiva certa quando se remove a protecção (sabotagem feita e revertida).
