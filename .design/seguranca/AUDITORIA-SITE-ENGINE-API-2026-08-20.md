# Auditoria de segurança — fronteira site-engine → API

**Data:** 20 de Agosto de 2026
**Âmbito:** a superfície entre o renderer (`site-engine`, incluindo a app do sócio em `components/appgym/`) e a API pública (`/api/websites/*`). Pedida pelo dono depois de o núcleo do épico `app-cliente-final` ter ido para produção sem revisão de segurança — estava listada como pendente no TASKS desde 2026-08-12.
**Método:** leitura de código dos dois lados da fronteira + sondagem de produção com pedidos públicos (sem credenciais).

---

## Veredicto

**Nenhuma vulnerabilidade explorável hoje.** Duas coisas que pareciam graves não são, e as defesas centrais estão bem desenhadas. Mas há **uma bomba com temporizador**: a proteção que hoje impede XSS é um filtro de INPUT global que o produto vai querer relaxar, e quando isso acontecer dois pontos de renderização passam a ser XSS armazenado numa origem da plataforma — com CORS credenciado, isso é cross-tenant. Corrigido neste lote.

---

## O que está sólido (com evidência)

**1. Confusão de tokens — fechada nas duas direcções.** O token `app-site` que o `GET /websites/app/config` minta é assinado com o **mesmo segredo** dos JWT de sessão dos clientes finais (`jwtSecretCustomers`), o que é o padrão clássico para uma escalada de privilégio. Não acontece: `authenticateTokenCustomers` exige `decoded.customerId` (o token da app não o tem → **403**), e o `lookupSiteToken` só aceita JWT com `kind === "app-site"` (um JWT de sessão nunca o tem). Os comentários em `src/middleware/auth.ts:144-148` mostram que foi deliberado.

**2. Guard de sessão cross-tenant.** Se um JWT de cliente for usado com o site token de OUTRO tenant, a API não se limita a recusar: revoga todos os refresh tokens e incrementa o `tokenVersion` do cliente, matando a sessão de vez (`auth.ts:108-122`). Defesa forte contra reutilização de sessão entre sites.

**3. Injeção da config no HTML — endurecida.** O `window.__APP_CONFIG__` é escrito com `JSON.stringify(...).replace(/</g, "\\u003c")` (`app/layout.tsx:228`), o que impede a fuga do `<script>` via `</script>` no nome do tenant. É a mitigação canónica e está documentada no sítio.

**4. Feeds `.ics` públicos com rate-limit** — o único achado de risco médio da auditoria de 2026-08-04 está fechado, e agora tem teste de montagem (`tests/security/rate-limit-ics-public.test.ts`).

---

## Achado 1 — XSS latente nos dois renderizadores de conteúdo · **MÉDIO** · corrigido

Os dois sítios que injetam conteúdo do CMS com `dangerouslySetInnerHTML` estavam ambos inseguros, por razões diferentes:

- `components/appgym/screens/Privacy.tsx` — injetava o valor do CMS `gym.app.privacy.content` **sem sanitização nenhuma**.
- `components/blocks/PrivacyPageClient.tsx` — sanitizava, mas com um **bypass**. O sanitizador percorria `Array.from(temp.children)` e, ao encontrar um elemento não permitido, subia os filhos para o lugar dele; esses filhos entravam na árvore **depois** do instantâneo do `Array.from` e nunca eram visitados. Consequência: `<div><img src=x onerror=alert(1)></div>` saía com o `onerror` **intacto** — bastava embrulhar o payload em qualquer tag não permitida.

**Porque não era explorável hoje:** a API remove TODO o HTML de qualquer corpo de pedido — `applySanitization` corre globalmente antes das rotas (`app.ts:83`) com `DOMPurify` em `ALLOWED_TAGS: []` mais uma regex de recurso. Nenhum valor do CMS pode conter tags, nem pela UI nem pela importação de CSV (o `setupCmsTemplate` lê de `req.body`, logo também é sanitizado).

**Porque era preciso corrigir mesmo assim:** essa proteção é de INPUT e é global, e o produto **anuncia** o que ela impede — o CMS documenta um tipo `richtext` ("HTML inline simples") e o comentário do próprio ecrã da app diz "corpo HTML (override do ginásio)". No dia em que alguém relaxar o sanitizador para o `richtext` funcionar (uma mudança perfeitamente razoável de fazer), estes dois pontos tornam-se XSS armazenado numa origem `*.<dominio-raiz>`. E como o CORS foi alargado para aceitar **qualquer** subdomínio da plataforma **com credenciais** (`isPlatformOrigin` em `security.ts`, cujo comentário assume "os tenants NÃO injetam JS"), esse XSS deixaria de ser um problema do tenant e passaria a ser um vetor cross-tenant. Duas decisões locais e sensatas que combinam mal.

**Correção aplicada:** uma fonte única `lib/sanitizeRichText.ts`, com travessia em **pós-ordem** (limpa os filhos antes de decidir sobre o próprio elemento, para que o que sobe já esteja limpo), allowlist de tags de formatação e `href` restringido a `http(s)`/caminhos internos. Usada pelos dois sítios; o sanitizador local com bypass foi removido.

**Dívida assumida:** a implementação é artesanal e **fica sem teste automatizado** — este repo não tem ambiente de testes com DOM (`jsdom`/`happy-dom` ausentes). O arranjo definitivo é trocá-la por **DOMPurify no cliente** (dependência que a API já usa) e acrescentar **`jsdom`** como devDependency para pinar o bypass num teste. São duas dependências novas no `site-engine`, por isso é **decisão do dono** — não a tomei sozinho.

---

## Achado 2 — `richtext` do CMS está morto em toda a plataforma · **funcional, não segurança** · por decidir

Consequência directa do mesmo sanitizador global: qualquer `<em>`, `<strong>`, `<h2>` ou `<ul>` que um tenant escreva numa entrada do CMS é **silenciosamente destruído** ao gravar, com `200 OK`. Aplica-se também ao `POST /cms/setup` (o CSV é enviado como JSON), logo o conteúdo `richtext` do `winterplateau/content-import.csv` nunca chegou à base de dados com HTML.

Mas o tipo `richtext` está documentado como suportado (CMS, tabela de tipos no `CLAUDE.md` da raiz) e há UI que o oferece. É a mesma classe de bug do `mongoSanitize` a apagar chaves com ponto (2026-08-04): a escrita responde sucesso e mangla o conteúdo em silêncio.

**Decisão necessária:** ou tirar o `richtext` da documentação e da UI (assumir que o CMS é texto simples), ou permitir uma allowlist mínima de tags para chaves específicas. **Se for a segunda, o Achado 1 tem de estar fechado primeiro** — e aí a troca para DOMPurify deixa de ser opcional.

---

## Achado 3 — conteúdo de sites não publicados é legível · **BAIXO** · por decidir

O `GET /websites/app/config?host=` minta um token `app-site` (validade 7 dias) **sem autenticação** e **sem filtrar por `published`**. Com esse token, o `GET /websites/content` (só `authenticateTokenPublic`, sem verificação de `published`) devolve o CMS desse tenant.

Ou seja: quem adivinhar o subdomínio de um tenant ainda não lançado lê o conteúdo do site dele antes do lançamento. O `GET /websites/site?host=` **filtra** por `published: true` — logo a mesma fronteira de confiança é aplicada num endpoint e não nos outros dois.

O que vaza é conteúdo destinado a ser público, por isso a severidade é baixa. O problema é a expectativa: o Backoffice apresenta "publicar" como um portão, e aqui não é. Torna-se relevante no dia em que alguém puser preços pré-lançamento ou uma marca ainda não anunciada no CMS.

**Nota:** gatilhar o config endpoint por `published` seria coerente e **não** quebraria a migração do ginásio (publicar já é passo obrigatório para o host resolver). Mas pode quebrar fluxos de dev/preview — daí ficar como decisão.

**Endurecimento menor no mesmo endpoint:** os 7 dias de validade do token `app-site` são generosos para algo que a app rebusca em cada arranque; encurtar reduz a janela de reutilização.

---

## Fora de âmbito, verificado de passagem

- **Não há UUID de tenant embutido no bundle de produção** da app do ginásio — identifica-se pelo site token, que o servidor resolve. Nada a extrair de um bundle público.
- **A página de despedida do gymnoprado** não é entregue quando a env está ausente (o Vite substitui por `undefined`, o Rollup elimina o ramo) — confirmado no bundle vivo.
