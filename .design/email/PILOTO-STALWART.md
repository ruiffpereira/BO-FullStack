# Piloto do Stalwart — passo-a-passo do dono

> Faz parte da ronda grande (R5.0). O código das fases 5–7 escreve-se e testa-se contra um Stalwart em Docker local;
> **em produção fica desligado** (`STALWART_*` por definir → o BO mostra "Por configurar") até este piloto estar
> verde. Plano e decisões: [PLANO.md](PLANO.md) §1. Configuração final da produção vai para
> [docs/INFRA.md](../../../docs/INFRA.md) quando estiver feita.

## Em simples

Pões um servidor de email (Stalwart) a correr no mesmo servidor do Coolify. Ele **recebe** email directamente
(porta 25) e **envia** sempre através do Resend. A nossa API fala com ele por dentro (rede do Docker), nunca pela
internet. Tu ficas com os backups, os alertas e as actualizações.

## O que tens de confirmar (os 5 pontos do plano)

| # | Pergunta | Como se vê |
|---|---|---|
| 1 | A porta **25 de entrada** chega ao servidor | Passo 6 (teste de fora) |
| 2 | A edição Community aceita **vários domínios** e criar domínios/caixas por API | Passo 7 |
| 3 | O Resend aceita **relay de email escrito por pessoas** e **quantos domínios** o teu plano deixa verificar | Termos e página de preços do Resend (pergunta já no item B42 do TASKS) |
| 4 | Onde ficam os dados e **como se faz o backup** (e um restauro testado) | Passo 8 |
| 5 | Receber, ler e responder de ponta a ponta, com a caixa aberta no telemóvel | Passo 9 |

## Antes de começar — o servidor

- O IP `91.99.171.136` parece ser da **Hetzner**. Se for: a Hetzner **bloqueia o envio** pelas portas 25 e 465 em
  contas novas (a recepção pela 25 funciona). Não faz mal — o Stalwart envia pelo Resend na porta **587** (ou
  2587). Confirma em INFRA o fornecedor (A11, ponto 6).
- **Disco:** vê quanto tens livre (`df -h`). O email cresce sempre e o disco é o mesmo da API e da BD — um disco
  cheio deita tudo abaixo. Vamos pôr quotas por caixa e um alerta de disco (passo 10).

## Passos

### 1 · Firewall (portas de email)
Abrir **TCP de entrada** 25 (receber), 465 e 587 (as caixas enviam), 993 (IMAP, telemóvel/Outlook).
- É na **firewall da Hetzner** (Console → Firewalls → `firewall-1` → Add rule), que é a que manda: uma regra por porta,
  Protocol **TCP**, origem **Any IPv4 + Any IPv6** (o email chega de qualquer servidor do mundo, não da Cloudflare). O
  `ufw` do servidor está desligado e o Docker passa-lhe por cima — não é por aí.
- O 80 e o 443 dessa firewall só aceitam a Cloudflare: o `mail.rufvision.com` (sem nuvem laranja) **não** responde por
  HTTPS de fora — por isso o certificado é por **DNS-01** (passo 5), nunca HTTP-01.
- **Não abrir** a 8080 (administração do Stalwart): essa fica só na rede interna/WireGuard.

### 2 · DNS na Cloudflare (`rufvision.com`)
- `A  mail  91.99.171.136` — **nuvem cinzenta (DNS only)**. Com a nuvem laranja o email não passa: a Cloudflare só
  faz proxy de HTTP.
- **Reverse DNS (PTR)** do IP → `mail.rufvision.com` (Hetzner: Server → Networking → Reverse DNS). Não é preciso
  para receber, mas evita avisos de spam nas respostas.
- MX e DKIM de cada negócio **não** se põem agora — é o BO que os mostra (fase 5/6).

### 3 · Token da Cloudflare para os certificados
O Traefik do Coolify ocupa as portas 80/443, por isso o Stalwart pede os certificados por **DNS-01**.
Cloudflare → My Profile → API Tokens → *Create Token* → modelo **Edit zone DNS**, só para a zona `rufvision.com`.
Guarda-o (vai para o passo 4).

### 4 · Instalar no Coolify
Projecto da plataforma → **+ New → Docker Compose (Empty)**, com isto. **A imagem é a mesma que a API provou contra
o Docker local** (R5.7, `docker-compose.test.yml`): `stalwartlabs/mail-server:v0.11.8`, dados em `/opt/stalwart-mail`.
Nunca `latest` nem outra versão sem a provar primeiro no `docker:test` — a API de gestão e o formato da config mudam
entre versões, e a API da plataforma deixava de conseguir criar domínios e caixas.

```yaml
services:
  stalwart:
    image: stalwartlabs/mail-server:v0.11.8   # a versão provada; subir só depois de a provar no docker:test
    restart: unless-stopped
    ports:
      - "25:25"
      - "465:465"
      - "587:587"
      - "993:993"
    # 8080 (admin + JMAP) NÃO se publica: a API chega-lhe pela rede do Docker.
    volumes:
      - stalwart-data:/opt/stalwart-mail
volumes:
  stalwart-data:
```

- **Sem domínio** no Coolify para este serviço (não passa pelo Traefik).
- Ligar a opção **Connect to Predefined Network** (para a API o encontrar como `stalwart:8080`).
- **Deploy.** No primeiro arranque o log mostra a password do `admin` — copia-a para o teu gestor de passwords.
- Para abrires a administração: pela WireGuard, `ssh -L 8080:<ip-do-contentor>:8080` ao servidor e
  `http://localhost:8080` no PC (ou publicar a 8080 só no IP da WireGuard, nunca em `0.0.0.0`).

### 5 · Configurar na administração do Stalwart
- **Server → hostname:** `mail.rufvision.com`.
- **TLS → ACME:** fornecedor Let's Encrypt, desafio **DNS-01**, provider Cloudflare, o token do passo 3, domínio
  `mail.rufvision.com`.
- **Relay de saída (todas as mensagens):** SMTP `smtp.resend.com`, porta **587** (STARTTLS), utilizador `resend`,
  password = uma API key do Resend **só para envio**. Assim nada sai directamente da porta 25.
- **Conta para a API:** cria um utilizador de administração próprio (ex. `api-plataforma`) com password longa — é
  esta que vai para as envs `STALWART_*` da API. Não uses o `admin`.

### 6 · Provar a porta 25 (ponto 1)
De um PC **fora** da WireGuard: `Test-NetConnection mail.rufvision.com -Port 25` (PowerShell) → `TcpTestSucceeded :
True`. Ou um verificador online de SMTP (ex. mxtoolbox → "SMTP Diagnostics" a `mail.rufvision.com`).

### 7 · Vários domínios e caixas (ponto 2)
Na administração: cria o domínio `piloto.rufvision.com` e a caixa `teste@piloto.rufvision.com`; depois um segundo
domínio qualquer teu. Se a Community deixar os dois, o ponto 2 está verde. (Por API confirmo eu, contra o Docker
local — é o mesmo produto.)

### 8 · Backup e restauro (ponto 4)
- Os dados ficam no volume `stalwart-data` (motor interno, RocksDB). O backup seguro é com o serviço **parado**
  uns segundos, ou a funcionalidade de backup do próprio Stalwart se a versão a tiver.
- Mínimo aceitável: cópia diária do volume para fora do servidor (ex. Hetzner Storage Box ou outro destino teu),
  guardada 14 dias, com **aviso se falhar**.
- **Restauro testado:** repõe a cópia de ontem num contentor de teste e confirma que a caixa `teste@` tem as
  mensagens. Sem isto, o ponto 4 não está verde.

### 9 · Ponta a ponta (ponto 5)
Regista no DNS os MX de `piloto.rufvision.com` → `mail.rufvision.com` (prioridade 10) e o DKIM que o Stalwart
mostra para o domínio. Do teu Gmail envia para `teste@piloto.rufvision.com`; abre a caixa no telemóvel por IMAP
(servidor `mail.rufvision.com`, 993 SSL; envio 587); responde do telemóvel. Tem de chegar ao Gmail **fora do spam**.

### 10 · Alertas
- Disco acima de 80%.
- Serviço em baixo (ex. o Uptime Kuma, se tiveres, a vigiar a porta 25 de `mail.rufvision.com`).
- Backup falhado.

## Quando estiver verde — diz-me

Com os 5 pontos verdes, passas à API (Coolify → API → envs, **reiniciar** depois de gravar):
`STALWART_URL=http://stalwart:8080` · `STALWART_USER` · `STALWART_PASSWORD` (a conta do passo 5). Os nomes
finais confirmam-se na R5.2 e ficam em INFRA.md. Sem elas a API arranca na mesma e o Correio → Caixa fica "Por
configurar".
