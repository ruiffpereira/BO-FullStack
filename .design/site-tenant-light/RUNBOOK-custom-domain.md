# RUNBOOK — Ligar um domínio próprio de um cliente (3.9)

> **DESATIVADO (2026-07-14):** decisão do dono — sites são SEMPRE por subdomínio, nunca domínio
> próprio. A UI do card "Domínio próprio" (tab Domínio) está escondida atrás da flag
> `CUSTOM_DOMAIN_UI = false` em `src/pages/Website.tsx` (Backoffice); a API (`PUT
> /website/custom-domain`) continua completa e testada. **Reativação = pôr `CUSTOM_DOMAIN_UI = true`**
> — este runbook volta a aplicar-se tal e qual sem mais alterações.

_Par do DESIGN_BRIEF.md (secção 3.9). Passos operacionais para o dono ligar `www.cliente.pt` ao site
de um tenant, depois do BO já ter a secção "Domínio próprio" (tab Domínio) e a API o endpoint
`PUT /website/custom-domain`._

## 0. Pré-requisito

O tenant já tem um site com subdomínio reclamado (`{sub}.rufvision.com`) — o domínio próprio
substitui-o na FRENTE, mas o subdomínio continua a existir e a funcionar (fallback).

## 1. DNS — no registrador do domínio do cliente

Pedir ao cliente (ou fazer por ele, se tiveres acesso) um registo DNS a apontar para o servidor do
renderer:

- **Subdomínio (`www.cliente.pt`, recomendado):** registo **CNAME** `www` → o host do renderer no
  Coolify (ex.: `siteengine.rufvision.com`).
- **Apex/raiz (`cliente.pt`, sem `www`):** a maioria dos registradores não permite CNAME na raiz —
  usar o registo **A** com o IP do servidor do Coolify (ou o `ALIAS`/`ANAME` do registrador, se
  suportar). Confirmar o IP correto no Coolify (Servers → o servidor da app do renderer).

Propagação de DNS pode demorar minutos a algumas horas.

## 2. Coolify — adicionar o domínio à app do renderer

1. Coolify → a app do **site-engine** (renderer) → **Domains**.
2. Adicionar `www.cliente.pt` (ou o domínio exato acordado com o cliente).
3. O Coolify/Traefik trata do certificado **Let's Encrypt** automaticamente assim que o DNS
   resolver para o servidor — confirmar que o certificado fica **Valid** (não `Provisioning`
   perpetuamente; se ficar preso, o DNS ainda não propagou ou aponta para o host errado).
4. **Não remover nem tocar no domínio wildcard/canónico do renderer** (`siteengine.rufvision.com` +
   os subdomínios `*.rufvision.com`) — isto é ADICIONAR um domínio extra à mesma app, não substituir.

## 3. BO — definir o domínio próprio

1. Entrar na conta do tenant (ou pedir-lhe para o fazer self-serve) → **O meu site → Domínio**.
2. Secção **"Domínio próprio"** → escrever `www.cliente.pt` → **Guardar**.
3. Erros possíveis (mensagem já em PT no BO):
   - **"Domínio inválido"** — formato errado (sem esquema/porta/caminho, ex.: `www.cliente.pt`, não
     `https://www.cliente.pt/`).
   - **"Esse é o domínio da plataforma"** — tentaram usar o próprio `rufvision.com` ou um
     subdomínio dele.
   - **"Já está a ser usado por outro cliente"** (409) — outro tenant já reclamou esse domínio;
     confirmar com o cliente qual é o domínio certo.

## 4. Verificação

```bash
curl -Is https://www.cliente.pt | head -1
```

Confirmar:
- `HTTP/2 200` (ou 3xx de redirect esperado) — não `curl: (60) SSL certificate problem` nem timeout.
- Visitar `https://www.cliente.pt` no browser e ver o site do tenant a carregar normalmente (mesmo
  conteúdo do subdomínio `{sub}.rufvision.com`).
- Confirmar que o subdomínio original (`{sub}.rufvision.com`) continua a funcionar em paralelo —
  não é substituído, é um segundo endereço válido para o mesmo site.

## 5. Remover (se o cliente sair ou trocar de domínio)

1. BO → tab Domínio → "Domínio próprio" → **Remover domínio** (confirma).
2. Coolify → app do renderer → Domains → remover `www.cliente.pt` (evita acumular domínios mortos
   e falhas de renovação de certificado para domínios que já não resolvem para nós).
3. Avisar o cliente para remover o registo DNS do lado dele, se aplicável (fora do nosso controlo).
