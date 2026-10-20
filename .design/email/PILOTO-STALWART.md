# Piloto do Stalwart — passo-a-passo do dono

> Faz parte da ronda grande (R5.0). O código das fases 5–7 escreve-se e testa-se contra um Stalwart em Docker local;
> **em produção fica desligado** (`STALWART_*` por definir → o BO mostra "Por configurar") até este piloto estar
> verde. Plano e decisões: [PLANO.md](PLANO.md) §1. Configuração final da produção vai para
> [docs/INFRA.md](../../../docs/INFRA.md) quando estiver feita.
>
> **Versão:** os passos 4–5 são para a **0.16.27** (a provada, B52). O piloto que já está de pé corre a 0.11.8 — para o
> passar à 0.16 vai à secção **«Subir de versão»** no fim.

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
Abrir **TCP de entrada** 25 (receber), 465 (as caixas enviam) e 993 (IMAP, telemóvel/Outlook). A 587 pode ficar aberta mas a
0.16 já não escuta nela por omissão.
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
Projecto da plataforma → **+ New → Docker Compose (Empty)**, com isto. **A imagem é a que a API provou contra o Docker
local** (`docker-compose.test.yml`): `stalwartlabs/stalwart:v0.16.27` (até à 0.11 chamava-se `mail-server`; mudou na 0.12).
Nunca `latest` nem outra versão sem a provar primeiro no `docker:test` — a API de gestão e o formato da config mudam
entre versões, e a API da plataforma deixava de conseguir criar domínios e caixas (foi o que aconteceu entre a 0.11 e a
0.16: a gestão passou de REST a JMAP).

```yaml
services:
  stalwart:
    image: stalwartlabs/stalwart:v0.16.27   # a versão provada; subir só depois de a provar no docker:test
    restart: unless-stopped
    environment:
      # SÓ durante a instalação (passos 4b e 5). É uma porta dos fundos: sai no fim do passo 5.
      STALWART_RECOVERY_ADMIN: "admin:<password-longa-temporária>"
    ports:
      - "25:25"
      - "465:465"
      - "993:993"
    # 8080 (admin + JMAP) NÃO se publica: a API chega-lhe pela rede do Docker.
    # A 0.16 já não abre a 587 nem a 143 (só 465 e 993, com TLS desde o 1.º byte) — a 587 da firewall fica inerte.
    volumes:
      - stalwart16-etc:/etc/stalwart        # config.json (só a ligação à base de dados)
      - stalwart16-data:/var/lib/stalwart   # a base de dados, as mensagens e as chaves DKIM
volumes:
  stalwart16-etc:
  stalwart16-data:
```

- **Nomes de volume novos** (`stalwart16-…`): nunca reutilizar o `stalwart-data` do piloto antigo — a 0.16 apaga e
  reescreve o que encontra lá (ver «Subir de versão»).
- **Sem domínio** no Coolify para este serviço no passo 4 (não passa pelo Traefik); o domínio do passo 4b põe-se depois.
- Ligar a opção **Connect to Predefined Network** (para a API o encontrar como `stalwart:8080`).
- **Deploy.** Sem `config.json` o Stalwart arranca em *modo de instalação* (só a porta 8080, nada de email) e aceita a
  credencial `admin:<a password que pusseste em STALWART_RECOVERY_ADMIN>`.

> **Como foi feito em produção a 2026-10-20 (o caminho que resultou):** o assistente (5a) e a configuração (5b) correram
> **de dentro do contentor** (Coolify → serviço do Stalwart → Terminal), com `curl` contra `http://127.0.0.1:8080/jmap`
> e `-u "$STALWART_RECOVERY_ADMIN"` — pelo PowerShell/Traefik a mesma credencial dava 401. Uma linha por comando, o
> segredo colado no Bloco de Notas sobre o marcador (o terminal do Coolify não guarda variáveis entre linhas). As linhas
> provadas ficaram em `D:\Projetos\stalwart-subida\` (`passo-D-linha.txt`, `nova-password-api.txt`). Mudar a password
> da conta da API (id `c`): `x:Account/set` com `update.c.credentials` (prova com `GET /api/account` = 200), e a mesma
> em `STALWART_PASSWORD` no Coolify da API → Restart. Ver também ARMADILHAS → «Coolify e o dono a correr comandos».

### 4b · Falar com o Stalwart (JMAP) — feito a 2026-10-20 para a 0.11, refeito para a 0.16
- **Endereço:** `https://mailadmin.rufvision.com` — registo `A mailadmin` **DNS only** na Cloudflare + no Coolify o
  domínio `https://mailadmin.rufvision.com:8080` no serviço `stalwart` → Restart. Só abre **pela VPN** (regra 3 do
  INFRA).
- **Certificado:** sai o de origem da Cloudflare (o Let's Encrypt por HTTP-01 não passa a firewall — A12). Até o A12
  estar feito, no PowerShell `[System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }` antes
  dos comandos.
- **Na 0.16 a gestão é toda JMAP** (`POST /jmap`, objectos `x:Domain`, `x:Account`…). O `/api/principal` e o
  `/api/settings` da 0.11 já não existem. Os passos 5 e «Subir de versão» usam estes comandos de PowerShell (provados no
  `docker:test`); **a interface web (`/admin`) é opcional**: a 0.16 só a deixa entrar por HTTPS no nome do servidor, e
  atrás do Traefik isso exige `STALWART_PUBLIC_URL=https://mailadmin.rufvision.com` no serviço — não provado; se der
  erro no início de sessão, não insistas, o PowerShell chega.
- **Já não há nada a fixar à mão da interface:** a 0.11.8 baixava sempre a interface mais recente (que já não servia) e
  obrigava a fixar a `v0.1.25` com o `webadmin.resource`. A 0.16 traz a interface própria (descarrega o `webui.zip` do
  GitHub no arranque — o contentor precisa de saída HTTPS para `github.com`) e a definição `webadmin.resource` **não
  existe** numa instalação nova.

Preâmbulo comum dos comandos (cola-o uma vez no PowerShell; pede as passwords):
```powershell
$u = "https://mailadmin.rufvision.com"
$user = Read-Host "Utilizador (admin do passo 5, ou 'admin' com a password do STALWART_RECOVERY_ADMIN)"
$pw = Read-Host "Password"
$h = @{ Authorization = "Basic " + [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($user + ":" + $pw)) }
function J($json) { Invoke-RestMethod -Uri "$u/jmap" -Method Post -Headers $h -Body $json -ContentType "application/json" }
$pre = '{"using":["urn:ietf:params:jmap:core","urn:stalwart:jmap"],"methodCalls":'
```
Teste: `Invoke-RestMethod "$u/api/account" -Headers $h` devolve as permissões (credencial boa) ou 401.

### 5 · Configurar o Stalwart (todos por PowerShell, com o preâmbulo do 4b)

**5a · O «assistente» (1.ª vez, ainda em modo de instalação).** Servidor `mail.rufvision.com`; domínio por omissão
**`mail.rufvision.com`** (o próprio nome do servidor — assim o desafio DNS-01 do certificado e as chaves DKIM ficam numa
zona só dele e nada toca nos registos do `rufvision.com`); certificado automático por **DNS-01 na Cloudflare** (o token
do passo 3); registos no `Console` (Docker). Usa `$user = "admin"` e a password do `STALWART_RECOVERY_ADMIN`:
```powershell
$cf = Read-Host "Token da Cloudflare (Edit zone DNS)"
$body = $pre + '[["x:Bootstrap/set",{"update":{"singleton":{"serverHostname":"mail.rufvision.com","defaultDomain":"mail.rufvision.com","requestTlsCertificate":true,"generateDkimKeys":true,"tracer":{"@type":"Stdout","level":"info","ansi":false,"enable":true},"dnsServer":{"@type":"Cloudflare","secret":{"@type":"Value","secret":"__CF__"},"description":"Cloudflare"}}}},"b"]]}'
J ($body.Replace("__CF__", $cf)) | ConvertTo-Json -Depth 8
```
A resposta traz `username` (`admin@mail.rufvision.com`) e `secret`: **a conta de administração permanente — a password só
aparece agora**, guarda-a no gestor. Depois **Restart** do serviço no Coolify (passa a modo normal: portas de email
abertas, certificado pedido).

**5b · Depois do restart** (agora com `$user = "admin@mail.rufvision.com"` e a password que acabaste de guardar):
1. *Só os registos que protegem a entrega.* O domínio por omissão ficou com a gestão de DNS automática na Cloudflare; o
   Stalwart publicaria também MTA-STS e autoconfig, que exigem um certificado por nome que não existe. Desliga-os:
   ```powershell
   $d = J ($pre + '[["x:Domain/query",{"filter":{"name":"mail.rufvision.com"}},"d"]]}')
   $domId = $d.methodResponses[0][1].ids[0]
   J ($pre + '[["x:Domain/set",{"update":{"' + $domId + '":{"dnsManagement/publishRecords":{"dkim":true,"spf":true,"dmarc":true,"srv":false,"mtaSts":false,"tlsRpt":false,"autoConfig":false,"autoConfigLegacy":false,"autoDiscover":false}}}},"u"]]}') | ConvertTo-Json -Depth 8
   ```
2. *Relay de saída:* tudo o que não é local sai pelo Resend (a Hetzner bloqueia a 25/465 de saída). Key do Resend só de envio:
   ```powershell
   $key = Read-Host "API key do Resend (só envio)"
   $body = $pre + '[["x:MtaRoute/set",{"create":{"r":{"@type":"Relay","name":"resend","description":"Resend","address":"smtp.resend.com","port":587,"authUsername":"resend","authSecret":{"@type":"Value","secret":"__KEY__"},"implicitTls":false}}},"a"],["x:MtaOutboundStrategy/set",{"update":{"singleton":{"route":{"match":{"0":{"if":"is_local_domain(rcpt_domain)","then":"''local''"}},"else":"''resend''"}}}},"b"]]}'
   J ($body.Replace("__KEY__", $key)) | ConvertTo-Json -Depth 8
   ```
3. *Conta para a API* (papel Admin, password longa e aleatória; **não uses a `admin`**):
   ```powershell
   $apiPw = Read-Host "Password nova para a API (longa, aleatória)"
   J ($pre + '[["x:Account/set",{"create":{"a":{"@type":"User","name":"api-plataforma","domainId":"' + $domId + '","description":"API da plataforma","credentials":{"0":{"@type":"Password","secret":"' + $apiPw + '"}},"roles":{"@type":"Admin"}}}},"c"]]}') | ConvertTo-Json -Depth 8
   ```
   A 0.16 recusa passwords curtas ou fracas. Prova com `$user = "api-plataforma@mail.rufvision.com"`:
   `Invoke-RestMethod "$u/api/account" -Headers $h` tem de responder (não 401).
4. *Não deixar o Stalwart banir a própria API.* Ao fim de 100 logins falhados por dia o Stalwart bane o IP
   (e responde 429 a tudo, até com a credencial certa). Uma `STALWART_PASSWORD` errada na API bastava. As redes privadas
   do Docker ficam isentas (de fora, as ligações de email chegam com IPs públicos e continuam protegidas):
   ```powershell
   J ($pre + '[["x:AllowedIp/set",{"create":{"a":{"address":"172.16.0.0/12","reason":"Docker"},"b":{"address":"10.0.0.0/8","reason":"Docker"},"c":{"address":"192.168.0.0/16","reason":"Docker"}}},"a"]]}') | ConvertTo-Json -Depth 8
   ```
   Se alguma vez a API ficar a dar 502 com «recusou a credencial», vê primeiro os IPs banidos
   (`x:BlockedIp/get`, `ids: null`) e apaga o da API (`x:BlockedIp/set` com `destroy`).
5. *Tirar a porta dos fundos:* no Coolify apaga a env `STALWART_RECOVERY_ADMIN` do serviço e faz **Redeploy**. A partir
   daqui só entram `admin@mail.rufvision.com` e `api-plataforma@mail.rufvision.com`.
6. *Certificado:* ao fim de uns minutos, `echo | openssl s_client -connect mail.rufvision.com:993 -servername mail.rufvision.com 2>/dev/null | openssl x509 -noout -issuer -dates`
   (no servidor) tem de dizer Let's Encrypt, não «self-signed». Se não sair, `docker logs <contentor> 2>&1 | grep -i acme`
   e diz-me o erro. ⚠ O DNS-01 com a Cloudflare não se prova no Docker local (precisa do Let's Encrypt e da Cloudflare
   reais): é o ponto a ver aqui.

### 6 · Provar a porta 25 (ponto 1)
De um PC **fora** da WireGuard: `Test-NetConnection mail.rufvision.com -Port 25` (PowerShell) → `TcpTestSucceeded :
True`. Ou um verificador online de SMTP (ex. mxtoolbox → "SMTP Diagnostics" a `mail.rufvision.com`).

### 7 · Vários domínios e caixas (ponto 2)
Pela plataforma (Admin → utilizador → Domínio de email → Activar a caixa do negócio): `piloto.rufvision.com` e a caixa
`geral@piloto.rufvision.com`; depois um segundo domínio qualquer teu. A API cria o domínio no Stalwart (com DKIM
automático) e a conta por JMAP. Se a Community deixar os dois, o ponto 2 está verde. (Por API já está provado contra o
Docker local — é o mesmo produto.)

### 8 · Backup e restauro (ponto 4)
- Os dados ficam no volume `stalwart16-data` (motor interno, RocksDB; a config no `stalwart16-etc`). O backup seguro é com o serviço **parado**
  uns segundos, ou a funcionalidade de backup do próprio Stalwart se a versão a tiver.
- Mínimo aceitável: cópia diária do volume para fora do servidor (ex. Hetzner Storage Box ou outro destino teu),
  guardada 14 dias, com **aviso se falhar**.
- **Restauro testado:** repõe a cópia de ontem num contentor de teste e confirma que a caixa `teste@` tem as
  mensagens. Sem isto, o ponto 4 não está verde.

### 9 · Ponta a ponta (ponto 5)
Regista no DNS os MX de `piloto.rufvision.com` → `mail.rufvision.com` (prioridade 10) e o DKIM que o Stalwart
mostra para o domínio (Backoffice → Admin → Domínio de email: MX, SPF, DKIM e DMARC). Do teu Gmail envia para
`geral@piloto.rufvision.com`; abre a caixa no telemóvel por IMAP (servidor `mail.rufvision.com`, 993 SSL/TLS; envio 465
SSL/TLS; a «password da app» sai do Backoffice); responde do telemóvel. Tem de chegar ao Gmail **fora do spam**.

### 10 · Alertas
- Disco acima de 80%.
- Serviço em baixo (ex. o Uptime Kuma, se tiveres, a vigiar a porta 25 de `mail.rufvision.com`).
- Backup falhado.

## Subir de versão (0.11.8 → 0.16.27) — B52

> **Gate do dono:** nenhum negócio com Correio activo em produção antes disto. A API (adaptador reescrito) e o Docker de
> testes já estão na 0.16.27 e provados contra o Stalwart real; **falta só trocar o serviço em produção** (este
> procedimento). Enquanto não o fizeres a produção continua na 0.11.8 e a API **não consegue** criar domínios nem caixas
> nela (fala JMAP; a 0.11 só tem REST) — por isso não actives nenhuma caixa antes.

### O que muda, em simples
- **Não há subida «no sítio» da 0.11 para a 0.16.** O Stalwart só migra dados a partir da 0.15 (a 0.11 teria de passar
  por 0.12, 0.13, 0.14 e 0.15, cada uma com a sua migração, e a 0.16 apaga e recria toda a configuração e os utilizadores).
  Como o piloto só tem dados de teste (o domínio `piloto` e a caixa `teste@`), a subida é uma **instalação nova ao lado**,
  com volumes novos. O volume antigo **não se toca** — é o teu recuo.
- **O que se perde:** o domínio e as caixas de teste do piloto e o que lá estiver recebido. **O que fica:** o DNS
  (`mail`, portas, MX do piloto), a firewall, o Resend, as envs da API (se mantiveres o nome da conta, ver o passo 5 abaixo).
- **Caminhos novos:** a config passa de `/opt/stalwart-mail/etc/config.toml` a `/etc/stalwart/config.json` (volume
  `stalwart16-etc`) e os dados de `/opt/stalwart-mail` a `/var/lib/stalwart` (volume `stalwart16-data`). Já não há TOML:
  tudo o resto (domínios, contas, DKIM, relay, certificados) vive na base de dados e gere-se por JMAP.
- **A `webadmin.resource` desaparece sozinha** com a instalação nova (vivia na base de dados da 0.11, que não se leva), e
  a 0.16 traz a interface certa. Não há comando a correr — o comando do passo 4b da 0.11 (`/api/settings`) já nem existe.
- **Portas:** só 25, 465 e 993 (e 4190/995 internas). A 587 e a 143 deixaram de abrir por omissão; a API passa a dar aos
  clientes SMTP **465 SSL/TLS** (antes 587 STARTTLS).

### Passos
1. **Antes de mexer: backup do volume antigo** (no servidor, por SSH; com o serviço parado o ficheiro é consistente).
   ```bash
   docker volume ls | grep stalwart                      # o nome é <uuid-do-serviço>_stalwart-data
   docker stop stalwart-m4xqn8w2s1dmcy6j0f2b5h3u         # ou Stop no Coolify
   mkdir -p /root/backups
   docker run --rm -v <NOME-DO-VOLUME>:/from:ro -v /root/backups:/to alpine \
     tar czf /to/stalwart-0.11.8-$(date +%F).tgz -C /from .
   ls -lh /root/backups/stalwart-0.11.8-*.tgz            # tem de ter tamanho; copia-o para fora do servidor
   ```
2. **Trocar o serviço no Coolify:** edita o *compose* do serviço `stalwart` para o do **passo 4** (imagem
   `stalwartlabs/stalwart:v0.16.27`, **volumes novos** `stalwart16-etc` e `stalwart16-data`, `STALWART_RECOVERY_ADMIN`
   temporária, portas 25/465/993). Mantém «Connect to Predefined Network» e o domínio `mailadmin…:8080` do passo 4b.
   **Deploy.** Confirma nos logs do contentor (Coolify → Logs): `Server started in bootstrap mode` e `version = "0.16.27"`.
3. **Assistente + relay + conta da API:** passos **4b** (preâmbulo) e **5a/5b** — são os mesmos comandos de uma
   instalação nova. Depois do passo 5b.5 a porta dos fundos fecha.
4. **Domínio e caixa do piloto:** já não os crias no Stalwart à mão — activa-os pela plataforma (Admin → utilizador →
   Domínio de email → Activar a caixa do negócio); a API cria o domínio (com DKIM automático) e a conta.
   Os registos MX/SPF/DKIM/DMARC aparecem no Backoffice (só os que protegem a entrega).
5. **Envs da API:** `STALWART_URL` fica igual (`http://stalwart-m4xqn8w2s1dmcy6j0f2b5h3u:8080`). `STALWART_USER` é a conta
   do passo 5b.3 — o nome sem domínio (`api-plataforma`) ou o endereço completo (`api-plataforma@mail.rufvision.com`);
   `STALWART_PASSWORD` a password dela. Se já tinhas estas envs com o mesmo nome de conta e password, **não mudas nada**.
   Gravar → reiniciar a API.
6. **Confirmar que ficou bem:**
   - Logs do contentor: `Starting Stalwart Server … version = "0.16.27"` (a 0.12+ **não mostra a versão no banner** SMTP/IMAP,
     por isso o `mxtoolbox` só mostra `220 mail.rufvision.com Stalwart ESMTP at your service`) e, no Coolify, a imagem
     `stalwartlabs/stalwart:v0.16.27`.
   - Porta 25 e 993 de fora: `Test-NetConnection mail.rufvision.com -Port 25` e `-Port 993` → `TcpTestSucceeded : True`.
   - Certificado do `mail.` (passo 5b.6).
   - **Backoffice (admin) → Sistema:** o cartão do Stalwart diz «ligado» (a API chega-lhe e a credencial serve).
   - Caixa de ponta a ponta: activar a caixa do piloto, enviar de um Gmail para ela e responder (passo 9).
   - (Opcional) a interface em `https://mailadmin.rufvision.com/admin`, ver o passo 4b.
7. **Limpeza (depois de uns dias estável):** apaga o volume antigo `…_stalwart-data` e o backup `.tgz` antigo.

### Recuar
Se algo correr mal antes de haver caixas reais: no Coolify repõe o *compose* antigo (`stalwartlabs/mail-server:v0.11.8`
e o volume `stalwart-data`) → Deploy. Os dados antigos estão intactos (só se escreveu nos volumes `stalwart16-…`). A API
fica sem correio funcional (fala JMAP) até voltares à 0.16 — e `STALWART_URL` por definir deixa-a em «Por configurar».

### Riscos conhecidos
- **Certificado por DNS-01 na Cloudflare** não se prova fora de produção (passo 5b.6).
- **SPF/DMARC por omissão do Stalwart** são `v=spf1 mx -all` e `p=reject`: como o envio sai pelo relay do Resend, a
  mensagem passa o DMARC pela assinatura DKIM do domínio (é essa que conta), não pelo SPF. Se uma entrega falhar por
  DMARC, é o primeiro sítio a ver (juntar o `include:` do Resend ao SPF do domínio do negócio).
- **Entregas a domínios externos** (relay → Resend → destinatário) só se vêem com um email a sério, no passo 9.

## Quando estiver verde — diz-me

Com os 5 pontos verdes, passas à API (Coolify → API → envs, **reiniciar** depois de gravar):
`STALWART_URL=http://stalwart:8080` · `STALWART_USER` · `STALWART_PASSWORD` (a conta `api-plataforma` do passo 5b.3; o nome
sem domínio ou o endereço completo). Os nomes
finais confirmam-se na R5.2 e ficam em INFRA.md. Sem elas a API arranca na mesma e o Correio → Caixa fica "Por
configurar".
