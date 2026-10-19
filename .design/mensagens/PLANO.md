# Mensagens — clientes e equipa — PLANO (B43)

> Estado: **decidido (2026-10-19)**, a construir na ronda grande. Fila: `TASKS.md` → B43. Decisões em
> `DECISOES.md` (2026-10-19 · Mensagens).

## O que o dono pediu

1. O negócio conversa com os **clientes do site dele**.
2. Na mesma página, o negócio conversa com o **Suporte** (já existe) **e com a sua equipa**.

## Como está hoje

- Página **Mensagens** (`Backoffice/src/pages/Mensagens.tsx`): admin → inbox de todos os tenants; tenant → a
  sua conversa com o suporte. Membros da equipa também a vêem (nó `mensagens` da árvore), com o nome de quem escreveu.
- API: `/api/chat/support` + `/api/admin/chat` (`controllers/backoffice/chat/chatController.ts`), modelos
  `Conversation` e `Message` (+ `MessageAttachment`), avisos em `src/utils/chatNotify.ts`, tempo real pelo SSE
  `/api/events/stream`. Anexos com as regras dos uploads de hoje.
- Push: `PushSubscription` já aceita `customerId` (subscrição de um cliente de um site).

## Desenho

### Backoffice — **Mensagens** com dois separadores

| Separador | Lista | Quem vê |
|---|---|---|
| **Clientes** | Conversas com clientes do site, mais recente em cima, *Por ler* / *Todas*, pesquisa por nome/email | Dono; membros com o nó `mensagens.clientes` |
| **Backoffice** | **Suporte** fixo em primeiro; depois cada pessoa da equipa (dono e membros), por ordem da última mensagem | Dono e membros com `mensagens.equipa` |

- Abrir uma conversa → fio de mensagens (o mesmo componente do suporte), anexos (fotos e PDF), "a escrever…" não.
- Ficha do cliente (Clientes → ficha) ganha o atalho **"Abrir conversa"** quando existe uma.
- O contador do item **Mensagens** no menu soma os dois separadores; o sino e o push avisam de mensagem nova
  (dono e membros com acesso — segue a árvore, como na fase 2c).
- **Admin (tu):** continua a ver a inbox de todos os tenants no Suporte. **Não** vê as conversas dos negócios com
  os clientes deles nem as da equipa deles (isolamento — o suporte só vê o que lhe é escrito).

### Quem fala com quem (separador Backoffice)

- Dono ↔ cada membro · membro ↔ membro (do mesmo tenant) · **todos ↔ Suporte**.
- Conversa de equipa = **1-para-1** (sem grupos nesta ronda).
- Um membro removido: as conversas ficam com o nome guardado ("Ana (removida)"), só leitura.
- Membro de um tenant **nunca** fala com membro de outro (o Suporte é a única ponte, como hoje).

### Árvore de permissões (regra de 2026-10-19)

`mensagens` passa a ter filhos: **`mensagens.clientes`** [Ver | Responder] · **`mensagens.equipa`** [Ver | Escrever]
· **`mensagens.suporte`** [Ver | Escrever]. A migração dos grants dá a quem hoje tem `mensagens` o mesmo acesso ao
suporte e à equipa; **`mensagens.clientes` nasce fechado** para todos. Aparece no convite como o resto da árvore.

### Site (só o tifas-barber nesta ronda)

- Botão de chat flutuante, só para **clientes com conta** (sem conta → "Entra para falares connosco" abre o login
  que já existe).
- O cliente vê só as **suas** conversas com **este** negócio; anexos fotos e PDF.
- Aviso de resposta: **push** se tiver a app instalada e as notificações aceites; senão, vê ao voltar
  (contador no botão). **Sem email.**
- Instalar = pôr o widget no site. **Sem interruptor**: a API responde a qualquer tenant (o chat de cliente é
  sempre possível; só aparece onde o widget estiver).

### API (rotas novas)

- Clientes (`authenticateTokenCustomers`, pelo site token do tenant): listar as minhas conversas, abrir, enviar,
  anexar, marcar lidas. Tenant tirado do site token, cliente do token — **nunca** do body.
- Backoffice (`authenticateToken`, com `teamAccess`): conversas de clientes (listar, ler, responder, marcar lidas),
  conversas de equipa (listar pessoas, abrir 1-para-1, enviar, anexar).
- Tempo real: o SSE do BO ganha os eventos novos; o site do cliente faz polling leve enquanto o painel está aberto.
- Rate limit por cliente e por tenant (anti-spam), tecto de tamanho por mensagem, anexos pelo `uploadProcessing`.
- `@swagger` em tudo → `spec.json` do BO (Kubb) e `spec*.json` do tifas (Kubb próprio).

## Testes (no fim da ronda)

- `seguranca-api`: cliente de A não lê nem escreve em conversas de B; cliente não vê conversas de outro cliente do
  mesmo tenant; membro sem `mensagens.clientes` leva 403; membro de A não abre conversa com membro de B; o admin não
  lê conversas de clientes nem de equipa; anexos (tipo, tamanho, XSS); rate limits.
- `pentest-api`: as mesmas fronteiras, adversarialmente.
- `e2e-backoffice`: os dois separadores, Suporte fixo em primeiro, ordem por última mensagem, membro só-ver não
  escreve; 1440/834/390.
- tifas: build + o fluxo no browser (login → escrever → resposta do BO aparece).

## Do lado do dono

- Dar o nó `mensagens.clientes` a quem deve responder aos clientes (ficha do membro).
- Gate em produção: escrever do tifas com uma conta de cliente, responder do BO, ver a resposta no site; push no
  telemóvel com a app instalada; conversa com um membro e com o Suporte no separador Backoffice.
