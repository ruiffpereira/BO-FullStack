# Email no Backoffice — caixa de correio + campanhas — PLANO

> Estado: **planeado (2026-10-16)**, por fases (fim do ficheiro); decisões fechadas. Fila: `TASKS.md` → B42.

## O que o dono pediu

1. **Caixa de correio no BO** — receber, ler e responder emails dentro do Backoffice.
2. **Campanhas / newsletter** — o tenant envia emails aos seus clientes.
3. Um **fornecedor novo** para a caixa. Primeiro o OpenEmail; na 3.ª volta, o **Stalwart** alojado por
   nós. O Resend fica para o que já existe.
4. (2.ª volta) Ligado ao **domínio do cliente**: em testes e com subdomínio, tudo pelo Resend como hoje;
   com domínio próprio, passa a usar o dele.
5. (2.ª volta) Quem configura o DNS é o dono — "mas temos de ver melhor isto".

## Como está hoje

- Envio só transaccional, pelo **Resend** (`src/utils/mailer.ts`), do endereço da **plataforma**, com o
  nome do tenant como remetente. Os links usam `https://<User.websiteDomain>`.
- O domínio do site é posto **por ti** em Admin → Utilizadores (`PUT /admin/users/:userId/site-domain`).
- Conteúdos → **Emails** já deixa o tenant editar os textos dos emails automáticos.
- Recepção: nenhuma. Consentimento de marketing: nenhum.

## 1 · O fornecedor: Stalwart (alojado por nós) para a caixa, Resend para o resto

> Decisão do dono (2026-10-16, 3.ª volta). Substitui o OpenEmail, que tinha sido a 1.ª escolha (acesso por
> convite, sem preços nem DPA públicos). Ver `DECISOES.md`.

**Stalwart Mail Server**, edição **Community** (open source, AGPLv3, sem licença a pagar): servidor de
email completo (SMTP, IMAP, **JMAP**), filtro de spam incluído, DKIM gerado e rodado automaticamente,
certificados por ACME. Versão 0.16 (2026), com lançamentos regulares; é a base do email da Mozilla
(Thundermail).

**Porque ganhou ao OpenEmail**
- **Os dados ficam no nosso servidor.** O RGPD fica simples: não há subcontratante para a caixa.
- **Sem fornecedor de que depender**: open source; se a empresa desaparecer, o servidor continua.
- **Sem custo por mensagem nem por caixa**: paga-se o servidor e o disco.
- **JMAP** é uma API moderna, feita para construir clientes de email: é com ela que a API fala para
  montar a caixa no Backoffice.
- As caixas são reais: abrem no telemóvel e no Outlook por IMAP.

**O que não usamos:** a edição paga (Enterprise, por caixa) traz o multi-tenancy, em que cada organização
administra a sua parte do servidor. **Não precisamos dele:** os negócios nunca entram no Stalwart. Entram
no Backoffice, e é a nossa API, com uma credencial de administração que nunca sai do servidor, que cria
domínios e caixas e lê e escreve emails. O isolamento entre tenants é feito na nossa API, como em todo o
lado. Também não tem webmail, e não precisa: a caixa é o Backoffice.

**Como fica montado**
```
email de fora ──MX──▶ Stalwart (recebe, filtra spam, guarda)
                         ▲ JMAP (credencial de admin, só na rede interna)
Backoffice ──▶ API ──────┘
caixa (BO ou telemóvel) envia ──▶ Stalwart ──relay SMTP──▶ Resend ──▶ destinatário
transaccional + campanhas ──▶ API ──▶ Resend  (como hoje)
```
- **Recebe directamente** (porta 25 de entrada).
- **Envia sempre pelo Resend** (relay SMTP). Um servidor novo a enviar directamente cai no spam do
  Gmail/Outlook durante semanas e muitos fornecedores bloqueiam a porta 25 de saída; com o relay, a
  reputação de envio é a do Resend. As caixas enviam pouco, por isso o custo é marginal.
- Na API, uma **interface de fornecedor** (`MailboxProvider`, `Sender`) com um adaptador por fornecedor.

**Mesmo servidor, por agora** (decisão do dono; pode mudar para um servidor à parte mais tarde)
- O Coolify encaminha HTTP pelo Traefik, **não email**: as portas 25 (recepção), 465/587 (envio das
  caixas) e 993 (IMAP) são publicadas directamente pelo contentor do Stalwart. Firewall e Cloudflare têm
  de as deixar passar; os registos `mail.` **não podem** ficar com a nuvem laranja da Cloudflare (a
  Cloudflare só faz proxy de HTTP).
- **A interface de administração do Stalwart e o JMAP de admin não ficam expostos à internet**: a API
  fala com ele pela rede interna do Docker.
- **Disco**: o email cresce sempre. Tecto por caixa (quota) e alerta de disco, porque o servidor é o
  mesmo da API e da BD; um disco cheio deita tudo abaixo, não só o email.
- **Mudar de servidor mais tarde** = mover os dados do Stalwart e mudar o IP nos registos `mail.`. Os MX
  dos clientes apontam para `mail.<domínio da plataforma>` e não para um IP, por isso não se toca no DNS
  de cada cliente.

**O dono fica responsável** (decisão do dono): backups do email (automáticos, testados com um restauro, e
com alerta se falharem), alerta de servidor em baixo e actualizações do Stalwart.

**A confirmar no piloto (antes de qualquer código de produto)**
1. A porta 25 de **entrada** chega ao servidor (há fornecedores que a bloqueiam).
2. A edição Community aceita **vários domínios** numa instalação (um por negócio + os subdomínios
   `negocio.rufvision.com`), e criar domínios e caixas por API.
3. O relay pelo Resend: os termos do Resend aceitam email escrito por pessoas (não só automático), e
   **quantos domínios** o plano do Resend deixa verificar — cada domínio de onde uma caixa envia tem de
   estar verificado no Resend, e isto pode ser o que obriga a subir de plano.
4. Onde o Stalwart guarda os dados (o motor interno ou o MySQL/S3 que já temos) e como se faz o backup.
5. Recepção, leitura e resposta de ponta a ponta no teu domínio, com uma caixa aberta no telemóvel.

## 2 · O domínio do cliente — o ciclo de vida

**Dois estados só** (decisão do dono): o domínio próprio está **verificado** ou **não está**. "Pendente"
não é um estado à parte: enquanto o DNS não verifica, conta como não verificado.

| | Transaccional (marcações, reset, convites) | Caixa de correio (Stalwart) | Campanhas (Resend) |
|---|---|---|---|
| **Sem domínio verificado** | Resend, **do subdomínio do negócio**: `geral@tifas.rufvision.com` (decisão do dono; até a caixa existir, a resposta vai para o email do dono do negócio) | No subdomínio do negócio na plataforma: `ana@tifas.rufvision.com` (secção 2b — a confirmar no piloto) | **Desligadas** (decisão do dono) |
| **Domínio verificado** | Resend, **do domínio dele** (`noreply@tifas.pt`, resposta para `geral@tifas.pt`) | `ana@tifas.pt` | Resend, do subdomínio `news.tifas.pt` |

**Porque não há campanhas sem domínio verificado:** marketing a sair do domínio da plataforma põe a
reputação de todos os tenants nas mãos de um só. Se os clientes de um tenant carregarem em "spam", os
emails de marcações de toda a gente começam a cair na pasta de spam.

### 2b · Caixa sem domínio próprio: `pessoa@negocio.rufvision.com`

Ideia do dono. **Tecnicamente dá**: cada negócio tem um subdomínio (`tifas.rufvision.com`), e um
subdomínio pode receber email como qualquer domínio. Basta pôr nele os registos MX e DKIM e
criá-lo como domínio no Stalwart. O MX convive com o registo do site no mesmo subdomínio.

O que é preciso ter em conta:
- **Confirmar no piloto** que a edição Community aceita vários domínios (cada negócio é um domínio) e
  que o Resend deixa verificar os subdomínios para o envio (secção 1, ponto 3).
- **Os registos ficam no DNS do `rufvision.com`**, que é teu. Cada negócio novo com caixa = 2–3 registos
  novos nesse DNS. O Admin mostra-os para copiar. Se um dia o DNS estiver num fornecedor com API, isto
  pode passar a ser automático (não está planeado; o dono não sabe se fica na Cloudflare).
- **Reputação partilhada**: todos os negócios ficam debaixo do `rufvision.com`. Um negócio que abuse da
  caixa (spam a partir dela) pode afectar o domínio da plataforma, de onde também saem os emails de reset
  e de marcações. **Decidido: fica no `rufvision.com`** (o dono quer os emails automáticos a sair do
  subdomínio do negócio). Mitigação: cada negócio no seu subdomínio, com o seu DKIM (a reputação separa-se
  em parte), tecto de envios por caixa, e pausa automática de um negócio com queixas a mais.
- **Quando o negócio verificar o domínio dele**, o endereço muda (`ana@tifas.rufvision.com` →
  `ana@tifas.pt`). O antigo fica como **reencaminhamento** para o novo (o Stalwart suporta
  aliases e reencaminhamentos), para nada se perder.

**A armadilha do domínio verificado — o tenant já tem email no domínio.** Se a Tifas já usa Gmail/Google Workspace
em `@tifas.pt`, o registo MX já aponta para a Google, e pôr a caixa no Stalwart **corta-lhe o email
actual**. Por isso, por tenant, há três caminhos:
- **(a) domínio sem email** → caixa no Stalwart, sem conflito;
- **(b) migrar** para a nossa caixa (copiar as mensagens por IMAP) — decisão do cliente, contigo;
- **(c) manter o email actual** → a caixa no BO fica num subdomínio (`@contacto.tifas.pt`) ou não se
  activa.

O transaccional e as campanhas pelo Resend **não mexem no MX**: usam subdomínios próprios e não estragam
nada. Por isso um domínio pode estar verificado sem caixa nele (a caixa fica no subdomínio da plataforma).

**O que muda quando o domínio fica verificado:** os emails automáticos deixam de sair da plataforma e passam a sair do
domínio do tenant. Isto acontece **automaticamente** quando a verificação passa (com uma notificação para
o tenant), e há um botão para voltar atrás se algo correr mal.

## 3 · DNS — quem, como

És tu. Hoje já pões o domínio do site em Admin → Utilizadores; o domínio de email entra **no mesmo sítio**.
Para cada domínio, a plataforma pede os registos ao Resend e ao Stalwart e o BO mostra-os
numa tabela: tipo · nome · valor · estado (✓/✗) · botão copiar.

- **Registos típicos**: DKIM e SPF/return-path do Resend (em subdomínio — não tocam no email actual),
  DMARC, e **só se houver caixa** o MX (para `mail.<domínio da plataforma>`) e o DKIM do Stalwart.
- **Verificar agora**, e uma verificação automática periódica, com notificação quando passa a verde ou
  quando um registo desaparece (alguém mexeu no DNS do cliente).
- **Sem automatização de DNS** (decisão do dono, que não sabe se fica na Cloudflare): a tabela para
  copiar funciona com qualquer fornecedor de DNS. Automatizar fica para quando o fornecedor for definitivo.

## 4 · Consentimento — o que é, em simples

A lei (RGPD e, em Portugal, a Lei 41/2004) diz que **só se pode enviar email de marketing a quem disse
que sim**. Os clientes que já estão na BD deram o email para marcar um corte ou comprar, não para receber
a newsletter.

Na prática, cada contacto tem um estado: **Subscrito** (com data e de onde veio: site, app, balcão,
importação) · **Não subscrito** · **Anulou** · **Bloqueado** (email inválido ou queixa de spam). Só os
*Subscritos* entram numa campanha.

Como se ganham subscritos:
- **Daqui para a frente** (sem dúvidas legais): caixa "Quero receber novidades" nos sites (marcação,
  registo, loja), na app do sócio e na ficha do cliente no BO ("o cliente aceitou ao balcão").
- **Os clientes que já existem** — a pergunta que te fiz: (i) não lhes enviar nada até se subscreverem
  (seguro), ou (ii) usar o "soft opt-in" — a lei permite email a clientes que já compraram, sobre
  produtos/serviços parecidos, **se na altura lhes foi dada a hipótese de recusar** — o que os nossos
  formulários nunca fizeram. Por isso a recomendação é a (i).

Cada email de campanha leva sempre **"Anular subscrição"** com um clique.

## 5 · Módulo

**Correio** passa a ser um módulo (componente `VIEW_EMAIL`), que dás por tenant como os outros. Fica
**ligado ao estado do domínio**: sem domínio verificado, o tenant tem a **Caixa** (no subdomínio da
plataforma, secção 2b) e os **Contactos** (para ir juntando subscritos desde já), e vê **Campanhas**
bloqueadas com "Disponível quando o teu domínio estiver configurado".
Preço do módulo: decide-se com o resto do billing.

> **Nome:** o item da sidebar não pode chamar-se "Email", porque já existe o subitem **Conteúdos →
> Emails** e os nomes repetidos partem os testes da sidebar (regra dos labels no `CLAUDE.md` do BO). A
> proposta é **"Correio"**.

## 6 · Acções no Backoffice — ecrã a ecrã

### Tu (Admin)

**Admin → Utilizadores → linha do tenant → "Email"** (modal novo, ao lado de "Domínio do site")
- Estado: **Verificado** ✓ ou **Não verificado** (com a lista dos registos que faltam).
- **Configurar domínio de email** → domínio (sugere o do site) → escolher o que activar: ☐ envio
  (transaccional + campanhas) ☐ caixa de correio → *Já tem email neste domínio?* (sim → avisa do MX e
  propõe o subdomínio).
- **Registos DNS** (tabela com copiar) · **Verificar agora** · **Voltar ao envio da plataforma** ·
  **Remover domínio**.
- **Caixas**: lista dos endereços do tenant, espaço usado.
- O módulo **Correio** liga-se dando o `VIEW_EMAIL` à role do tenant (Admin → Permissões), como os outros.

**Admin → Sistema** (cartão novo)
- Estado do Resend e do Stalwart (servidor, disco, último backup), consumo do mês, tenants pausados por abuso, com a
  acção **Retomar envios**.

### Tenant — sidebar **Correio** (submenus: Caixa · Campanhas · Contactos · Definições)

**Caixa**
- Lista de conversas: *Por ler* · *Todas* · *Arquivo* · pesquisa. Se houver várias caixas
  (`geral@`, `ana@`): seletor de caixa.
- Abrir conversa → **Responder** · **Responder a todos** · **Encaminhar** · **Anexar** · **Arquivar** ·
  **Marcar como não lido** · **Ligar a cliente** (automático quando o email bate com um cliente).
- **Novo email**.
- Email novo → sino + push.

**Campanhas**
- Lista: *Rascunho* · *Agendada* · *A enviar* · *Enviada*, com aberturas e cliques.
- **Nova campanha**, em 4 passos:
  1. **Destinatários** — segmento (sócios activos, em atraso, clientes da agenda nos últimos N dias,
     compradores, etiqueta, língua) e o número de subscritos que apanha.
  2. **Conteúdo** — blocos (título, texto, imagem, botão, produto/serviço), um separador por língua.
  3. **Teste** — "Enviar para mim".
  4. **Enviar agora** ou **Agendar**.
- Campanha enviada → estatísticas: entregues, aberturas, cliques, anulações, bounces, queixas.
- **Duplicar** · **Cancelar agendamento**.

**Contactos**
- Lista com o estado de subscrição, a origem e a data.
- **Importar CSV**, a confirmar que os contactos deram consentimento.
- **Exportar** · **Etiquetas** · **Anular subscrição** manual.

**Definições**
- O estado do domínio (só leitura: "Configurado pela RufVision").
- Nome de remetente, endereço de resposta, assinatura.
- Caixas: lista dos endereços do negócio. Um endereço novo para um membro nasce no convite da Equipa
  (abaixo).

**Noutros sítios**
- **Clientes → ficha**: separador **Emails** (as conversas da caixa com este cliente) e o campo
  **"Aceita novidades por email"** (origem: balcão).
- **Equipa** (B41): os nós *Correio → Caixa (Ver/Responder)*, *Campanhas (Ver/Editar/Enviar)*,
  *Contactos (Ver/Editar)*.

### Cliente final (fora do BO)
- Caixa "Quero receber novidades" nos formulários dos sites e da app do sócio.
- Link **Anular subscrição** em cada campanha → página simples de confirmação, sem login.

## Fases — cada uma fecha a funcionar em produção

> Decisão do dono (2026-10-16): por fases, cada uma a funcionar antes da seguinte; campanhas no fim.
> Numeração contínua com as fases da Equipa (0–3, ver `.design/equipa-permissoes/PLANO.md`). Ordem e
> estado vivem no `TASKS.md` (B42).

### Fase 4 · Emails automáticos a sair do negócio
**Vês a funcionar:** os emails de marcação, reset de password e convite do sócio da Barbearia chegam de
`Barbearia <geral@barbearia.rufvision.com>`, e não do endereço da plataforma. A resposta do cliente vai para
o email do dono do negócio (a caixa ainda não existe).
- API: interface de fornecedores (o `mailer.ts` passa a ser o adaptador Resend, sem mudar comportamento);
  subdomínio de email por tenant (escolhido por ti no Admin); domínio criado no Resend pela API; `from` do
  tenant quando verificado, senão o da plataforma, como hoje (nada se parte enquanto o DNS não está posto).
- BO: **Admin → Utilizadores → linha → "Email"**: subdomínio, tabela de registos DNS para copiar, **Verificar
  agora**, estado Verificado / Não verificado.
- Tu: pôr os registos no DNS do `rufvision.com` para cada negócio; confirmar se o plano do Resend chega
  (10 domínios no Pro, +100 por 20 USD/mês).
- Gate: um email de marcação real chega à tua caixa com o remetente do negócio e DKIM válido.

### Piloto do Stalwart (em paralelo, contigo — infra, sem código de produto)
Os 5 pontos da secção 1. Corre enquanto se fazem as fases 1–4. Sem ele verde, a fase 5 não começa.

### Fase 5 · Caixa de correio — ler e responder
**Vês a funcionar:** a Barbearia tem `geral@barbearia.rufvision.com` a sério: recebe, lê e responde no
Backoffice (**Correio → Caixa**) e no telemóvel (IMAP). As respostas dos clientes aos emails automáticos
caem aqui.
- API: adaptador Stalwart (JMAP pela rede interna), criação da caixa do negócio, conversas, ler, responder
  (envio por relay no Resend), anexos, arquivar, isolamento por tenant (`pentest-api`).
- BO: módulo **Correio** (`VIEW_EMAIL`) com o submenu **Caixa**; HTML recebido sanitizado e isolado, sem
  imagens remotas por defeito.
- Tu: dar o `VIEW_EMAIL` ao negócio; MX e DKIM do Stalwart no DNS.
- Gate: um email enviado do teu Gmail chega à caixa, responde-se do BO e do telemóvel, e um tenant não vê a
  caixa de outro.

### Fase 6 · Caixa ligada ao negócio e à equipa
**Vês a funcionar:** na ficha da Maria (Clientes) há um separador **Emails** com as conversas com ela;
email novo dá sino e push; o convite de um membro tem **☐ Dar-lhe um endereço de email** e a Ana fica com
`ana@barbearia.rufvision.com`; na árvore de permissões aparece **Correio → Caixa (Ver / Responder)**.
- Depende da fase 1 (equipa) estar feita.
- Gate: e2e com um membro só com "Ver" na caixa — lê, não consegue responder.

### Fase 7 · Domínio próprio
**Vês a funcionar:** a Barbearia compra `barbearia.pt`; tu verificas o domínio no Admin; os emails
automáticos e a caixa passam para `geral@barbearia.pt`, e o endereço antigo reencaminha para o novo.
- Inclui o caso "já tem email nesse domínio" (manter o actual → a caixa fica no subdomínio da plataforma).
- Gate: troca feita num tenant de teste sem perder um único email nem partir os links.

### Fase 8 · Contactos e consentimento
**Vês a funcionar:** **Correio → Contactos** com o estado de cada contacto; na ficha do cliente, a caixa
**"Aceita novidades por email"**; página pública de anular subscrição; importação CSV. Ainda sem campanhas
— mas cada negócio começa a juntar subscritos.
- Pode ser adiantada para antes da fase 5 se quiseres começar a juntar subscritos mais cedo (não depende
  do Stalwart).
- Os sites externos e a app do sócio ganham a caixa "Quero receber novidades" um a um, cada um como uma
  mudança pequena e própria (regra cross-repo).

### Fase 9 · Campanhas
**Vês a funcionar:** **Correio → Campanhas**: destinatários → conteúdo por blocos → teste → enviar ou
agendar; estatísticas de aberturas e cliques. Só para negócios com **domínio próprio verificado**, e só
para os **subscritos**.
- Fila de envio, tectos anti-abuso, supressão automática de bounces e queixas, `List-Unsubscribe`
  one-click.
- Gate: campanha real para uma lista de teste; anular subscrição de um clique tira o contacto da lista.

## Decisões do dono

Fechadas (2026-10-16, ver `DECISOES.md`):
- **Stalwart Community alojado por nós para a caixa, Resend para o resto** (transaccional, campanhas e o
  envio das caixas, por relay). ~~OpenEmail para a caixa~~ — revogado na 3.ª volta.
- **No mesmo servidor por agora**; o dono fica responsável pelos backups, alertas e actualizações.
- **Dois estados do domínio**: verificado ou não.
- **Emails automáticos do subdomínio do negócio** (`geral@negocio.rufvision.com`) mesmo sem domínio
  próprio; as caixas sem domínio próprio ficam debaixo do `rufvision.com`.
- **Campanhas só com domínio próprio verificado, e só para subscritos** (os clientes existentes não recebem
  nada até se subscreverem).
- **Consentimento** como na secção 4.
- **Ficha do cliente**: separador Emails + caixa "Aceita novidades" — sim.
- **DNS feito pelo dono**, com a tabela de registos para copiar no Admin; sem automatização.
- **Email por membro opcional**, escolhido no convite.
- **Por fases**, cada uma a funcionar; campanhas no fim.

Em aberto: nada que bloqueie a fase 4. O piloto do Stalwart responde ao resto.
