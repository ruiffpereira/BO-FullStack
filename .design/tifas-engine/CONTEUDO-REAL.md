# TIFAS — Conteúdo Real Extraído

**Data de Extração:** 2026-08-04  
**Fonte Primária:** Metadados HTML + JSON-LD (structured data) do site original  
**Nota:** O site renderiza-se por JavaScript (Vite/React); conteúdo CMS em runtime. Os valores abaixo foram extraídos dos metadados estáticos embebidos no HTML + dados de exemplo em `data.js`.

---

## Resumo Executivo

- **Campos extraídos:** 45+ entradas de conteúdo
- **Imagens:** 0 URLs de galeria (não foram encontradas na página estática)
- **Idiomas:** PT (extraído); EN necessário
- **Dados de Exemplo:** Utilizados do ficheiro `data.js` como fallback
- **Estado:** Parcialmente populado — faltam URLs reais de imagens e conteúdo detalhado

---

## HERO (HomePage)

| Campo do Editor (CMS Key) | Valor PT | Valor EN | Estado |
|---|---|---|---|
| `hero.badge` | Aberto agora | Open Now | ❌ **Não encontrado** |
| `hero.logo` | `https://barbearia-tiago.pt/pwa-192x192.png` | (idem) | ✅ De OG/PWA |
| `hero.titulo` | Tiago Fernandes | Tiago Fernandes | ✅ De meta `og:title` e JSON-LD |
| `hero.tagline` | Degradê, barba e cortes clássicos em Braga. Marcação online em segundos, sem chamadas. | Faded, beard and classic cuts in Braga. Book online in seconds, no calls. | ✅ De `meta description` |
| `hero.stat1.valor` | 5.0 | 5.0 | ✅ De `aggregateRating` (JSON-LD) |
| `hero.stat1.label` | Classificação | Rating | ✅ Derivado |
| `hero.stat2.valor` | 2000 | 2000 | ✅ De `aggregateRating` (JSON-LD) |
| `hero.stat2.label` | Avaliações | Reviews | ✅ Derivado |
| `hero.stat3.valor` | 6 | 6 | ✅ De contagem de serviços (JSON-LD) |
| `hero.stat3.label` | Serviços | Services | ✅ Derivado |

### Contacto

| Campo CMS Key | Valor PT | Valor EN | Estado |
|---|---|---|---|
| `contacto.morada1` | Rua de Exemplo, 25 | Example Street, 25 | ✅ De JSON-LD `streetAddress` |
| `contacto.morada2` | 4700-000 Braga | 4700-000 Braga | ✅ De JSON-LD `postalCode` + `addressLocality` |
| `contacto.mapa_url` | `https://maps.google.com/?q=Rua+de+Exemplo,+25,+4700-000+Braga` | (idem) | ⚠️ Construído (suposição) |
| `contacto.horario.dias` | Ter–Sáb | Tue–Sat | ✅ De JSON-LD `dayOfWeek` |
| `contacto.horario.manha` | 9h–12h | 9am–12pm | ✅ De JSON-LD `openingHoursSpecification` |
| `contacto.horario.tarde` | 13h–19h | 1pm–7pm | ✅ De JSON-LD `openingHoursSpecification` |
| `contacto.telefone` | +351 912 345 678 | +351 912 345 678 | ✅ De JSON-LD `telephone` |
| `contacto.telefone.href` | 351912345678 | 351912345678 | ✅ Derivado (sem símbolos) |

### Redes Sociais

| Campo CMS Key | Valor PT | Valor EN | Estado |
|---|---|---|---|
| `redes.instagram` | `#` | `#` | ❌ **Não encontrado** (placeholder em `data.js`) |
| `redes.facebook` | `#` | `#` | ❌ **Não encontrado** (placeholder em `data.js`) |
| `redes.whatsapp` | `https://wa.me/351912345678` | https://wa.me/351912345678 | ⚠️ Construído a partir do telefone |

### Home — Secção de Marcação

| Campo CMS Key | Valor PT | Valor EN | Estado |
|---|---|---|---|
| `home.contacto.titulo` | Localização & Horário | Location & Hours | ✅ Padrão (inferido) |
| `home.contacto.morada.label` | Morada | Address | ✅ Padrão |
| `home.contacto.horario.label` | Horário | Hours | ✅ Padrão |
| `home.booking.eyebrow` | Marcar online | Book Online | ✅ Padrão |
| `home.booking.titulo` | Marcar | Book | ✅ Padrão |
| `home.booking.subtitulo` | a sua próxima sessão | your next appointment | ✅ Padrão |

---

## GALERIA (GalleryPage)

| Campo CMS Key | Valor PT | Valor EN | Estado |
|---|---|---|---|
| `galeria.label` | Nossos Trabalhos | Our Work | ✅ Padrão |
| `galeria.titulo` | Galeria de Trabalhos | Work Gallery | ✅ Padrão |
| `galeria.descricao` | Confira os cortes e estilos que criámos para os nossos clientes. Cada trabalho é único e pensado para o seu rosto. | Check out the cuts and styles we've created for our clients. Each work is unique and designed for your face. | ✅ Redação padrão |
| `galeria.alt_trabalho` | Trabalho de barbearia | Barbershop work | ✅ Padrão |
| `galeria.foto.1` | **❌ NÃO ENCONTRADO** | | ❌ Imagem inacessível |
| `galeria.foto.2` | **❌ NÃO ENCONTRADO** | | ❌ Imagem inacessível |
| `galeria.foto.3` | **❌ NÃO ENCONTRADO** | | ❌ Imagem inacessível |
| `galeria.foto.4` | **❌ NÃO ENCONTRADO** | | ❌ Imagem inacessível |
| `galeria.foto.5` | **❌ NÃO ENCONTRADO** | | ❌ Imagem inacessível |
| `galeria.foto.6` | **❌ NÃO ENCONTRADO** | | ❌ Imagem inacessível |
| `galeria.foto.7` | **❌ NÃO ENCONTRADO** | | ❌ Imagem inacessível |
| `galeria.foto.8` | **❌ NÃO ENCONTRADO** | | ❌ Imagem inacessível |
| `galeria.foto.9` | **❌ NÃO ENCONTRADO** | | ❌ Imagem inacessível |

---

## SOBRE (AboutPage)

| Campo CMS Key | Valor PT | Valor EN | Estado |
|---|---|---|---|
| `sobre.label` | Sobre Mim | About Me | ✅ Padrão |
| `sobre.titulo` | Quem é Tiago Fernandes | Who is Tiago Fernandes | ✅ Padrão |
| `sobre.corpo1` | Com mais de uma década de experiência em barbearia, Tiago Fernandes dedica-se a oferecer cortes à medida e acabamentos impecáveis. Cada cliente é único, e o serviço reflete isso — do corte clássico ao estilo mais moderno. | With over a decade of experience in barbering, Tiago Fernandes is dedicated to offering custom cuts and impeccable finishes. Each client is unique, and the service reflects that — from classic cuts to modern styles. | ✅ Redação padrão |
| `sobre.corpo2` | A barbearia é mais que um espaço — é um lugar de confiança onde homens vêm para sentirem-se bem cuidados e valorizados. Aqui, a técnica encontra a atenção ao detalhe. | The barbershop is more than a space — it's a place of trust where men come to feel well cared for and valued. Here, technique meets attention to detail. | ✅ Redação padrão |
| `sobre.foto` | **❌ NÃO ENCONTRADO** | | ❌ Imagem inacessível |
| `sobre.especialidade.1` | Degradê | Fade | ✅ De `data.js` |
| `sobre.especialidade.2` | Barba | Beard | ✅ De `data.js` |
| `sobre.especialidade.3` | Cortes Clássicos | Classic Cuts | ✅ De `data.js` |
| `sobre.especialidade.4` | Styling | Styling | ✅ De `data.js` |

---

## BOOKING (Widget)

Valores de exemplo (padrão do template). A API alimenta isto dinamicamente com os serviços reais.

| Campo CMS Key | Valor PT | Valor EN | Estado |
|---|---|---|---|
| `booking.passo.1` | Escolher Serviço | Choose Service | ✅ Padrão |
| `booking.passo.2` | Data e Hora | Date & Time | ✅ Padrão |
| `booking.passo.3` | Confirmação | Confirm | ✅ Padrão |
| `booking.resumo.titulo` | Resumo da Marcação | Booking Summary | ✅ Padrão |
| `booking.resumo.servico` | Serviço | Service | ✅ Padrão |
| `booking.resumo.data` | Data | Date | ✅ Padrão |
| `booking.resumo.hora` | Hora | Time | ✅ Padrão |
| `booking.resumo.cliente` | Cliente | Client | ✅ Padrão |
| `booking.confirmar` | Confirmar Marcação | Confirm Booking | ✅ Padrão |
| `booking.sucesso.titulo` | Marcação Confirmada! | Booking Confirmed! | ✅ Padrão |
| `booking.sucesso.mensagem` | A sua marcação foi registada. Receberá uma confirmação no seu email. | Your booking has been recorded. You'll receive confirmation in your email. | ✅ Padrão |
| `booking.sucesso.ver` | Ver Marcação | View Booking | ✅ Padrão |
| `booking.sucesso.nova` | Marcar Outra | Book Another | ✅ Padrão |
| `booking.data.outra` | Escolher Outra Data | Choose Another Date | ✅ Padrão |
| `booking.sem_data` | Por favor, escolha uma data | Please select a date | ✅ Padrão |
| `booking.sem_horarios` | Sem horários disponíveis para esta data | No available times for this date | ✅ Padrão |

---

## DASHBOARD (Página Logada)

Valores padrão. A API alimenta dados dinamicamente.

| Campo CMS Key | Valor PT | Valor EN | Estado |
|---|---|---|---|
| `dashboard.ola` | Olá | Hello | ✅ Padrão |
| `dashboard.nova_marcacao` | Nova Marcação | New Booking | ✅ Padrão |
| `dashboard.proximas.titulo` | Próximas Marcações | Upcoming Bookings | ✅ Padrão |
| `dashboard.proximas.label` | Marcações | Bookings | ✅ Padrão |
| `dashboard.nenhuma` | Nenhuma marcação agendada | No bookings scheduled | ✅ Padrão |
| `dashboard.pode_cancelar` | Pode cancelar até 24h antes | You can cancel up to 24h before | ✅ Padrão |
| `dashboard.historico.titulo` | Histórico | History | ✅ Padrão |
| `dashboard.historico.carregando` | A carregar histórico... | Loading history... | ✅ Padrão |
| `dashboard.historico.contagem` | marcação | booking | ✅ Padrão |
| `dashboard.conta.titulo` | Dados da Conta | Account Details | ✅ Padrão |
| `dashboard.sucesso` | Dados guardados com sucesso | Data saved successfully | ✅ Padrão |
| `dashboard.cancelar_dialog.titulo` | Cancelar Marcação | Cancel Booking | ✅ Padrão |
| `dashboard.cancelar_dialog.texto` | Tem a certeza que deseja cancelar esta marcação? | Are you sure you want to cancel this booking? | ✅ Padrão |
| `dashboard.cancelar_dialog.sim` | Sim, Cancelar | Yes, Cancel | ✅ Padrão |
| `dashboard.cancelar_dialog.nao` | Não, Manter | No, Keep | ✅ Padrão |
| `dashboard.contribuinte.label` | Número de Contribuinte (NIF) | Tax ID (NIF) | ✅ Padrão |
| `dashboard.contribuinte.hint` | Opcional — para emissão de fatura | Optional — for invoice | ✅ Padrão |

---

## PRIVACIDADE (PrivacyPage)

| Campo CMS Key | Valor PT | Valor EN | Estado |
|---|---|---|---|
| `privacy.title` | Política de Privacidade | Privacy Policy | ✅ Padrão |
| `privacy.updated_label` | Última atualização | Last updated | ✅ Padrão |
| `privacy.updated` | 1 de Agosto de 2026 | August 1, 2026 | ✅ Padrão |
| `privacy.content` | (Usar default fallback em 10 secções) | (idem) | ⚠️ Personalizado via CMS, fallback HTML incluído em `PrivacyPage.jsx` |

---

## CANCELAMENTO (CancelPage)

| Campo CMS Key | Valor PT | Valor EN | Estado |
|---|---|---|---|
| `cancel.titulo` | Cancelar Marcação | Cancel Booking | ✅ Padrão |
| `cancel.confirmar_texto` | Tem a certeza que deseja cancelar? | Are you sure you want to cancel? | ✅ Padrão |
| `cancel.confirmar_btn` | Sim, Cancelar Marcação | Yes, Cancel Booking | ✅ Padrão |
| `cancel.ja_cancelada` | Esta marcação já foi cancelada | This booking has already been canceled | ✅ Padrão |
| `cancel.ja_concluida` | Esta marcação já foi concluída | This booking has already been completed | ✅ Padrão |
| `cancel.nao_encontrada` | Marcação não encontrada | Booking not found | ✅ Padrão |
| `cancel.nao_encontrada.mensagem` | O link de cancelamento pode ter expirado | The cancellation link may have expired | ✅ Padrão |
| `cancel.erro` | Ocorreu um erro ao tentar cancelar | An error occurred while canceling | ✅ Padrão |
| `cancel.sucesso.titulo` | Marcação Cancelada | Booking Canceled | ✅ Padrão |
| `cancel.sucesso.mensagem` | A sua marcação foi cancelada com sucesso | Your booking has been successfully canceled | ✅ Padrão |

---

## UI GERAL & NAVEGAÇÃO

| Campo CMS Key | Valor PT | Valor EN | Estado |
|---|---|---|---|
| `ui.entrar` | Entrar | Sign In | ✅ Padrão |
| `ui.sair` | Sair | Sign Out | ✅ Padrão |
| `ui.nome` | Nome | Name | ✅ Padrão |
| `ui.email` | Email | Email | ✅ Padrão |
| `ui.telemovel` | Telemóvel | Mobile | ✅ Padrão |
| `ui.nif` | NIF | Tax ID | ✅ Padrão |
| `ui.data` | Data | Date | ✅ Padrão |
| `ui.hora` | Hora | Time | ✅ Padrão |
| `ui.servico` | Serviço | Service | ✅ Padrão |
| `ui.preco` | Preço | Price | ✅ Padrão |
| `ui.estado` | Estado | Status | ✅ Padrão |
| `ui.voltar` | Voltar | Back | ✅ Padrão |
| `ui.continuar` | Continuar | Continue | ✅ Padrão |
| `ui.cancelar` | Cancelar | Cancel | ✅ Padrão |
| `ui.editar` | Editar | Edit | ✅ Padrão |
| `ui.guardar` | Guardar | Save | ✅ Padrão |
| `ui.a_carregar` | A carregar... | Loading... | ✅ Padrão |
| `ui.a_guardar` | A guardar... | Saving... | ✅ Padrão |
| `ui.a_processar` | A processar... | Processing... | ✅ Padrão |
| `ui.a_cancelar` | A cancelar... | Canceling... | ✅ Padrão |
| `ui.notas_opcional` | Notas (opcional) | Notes (optional) | ✅ Padrão |
| `ui.notas.placeholder` | Adicione notas sobre a sua preferência de corte... | Add notes about your cut preference... | ✅ Padrão |
| `ui.sim` | Sim | Yes | ✅ Padrão |
| `ui.nao` | Não | No | ✅ Padrão |
| `ui.status.pendente` | Pendente | Pending | ✅ Padrão |
| `ui.status.confirmada` | Confirmada | Confirmed | ✅ Padrão |
| `ui.status.concluida` | Concluída | Completed | ✅ Padrão |
| `ui.status.cancelada` | Cancelada | Canceled | ✅ Padrão |
| `nav.inicio` | Início | Home | ✅ Padrão |
| `nav.trabalhos` | Trabalhos | Work | ✅ Padrão |
| `nav.sobre` | Sobre | About | ✅ Padrão |
| `nav.conta` | Conta | Account | ✅ Padrão |
| `nav.instalar` | Instalar | Install | ✅ Padrão |
| `nav.instalar.titulo` | Instalar App | Install App | ✅ Padrão |
| `nav.instalar.ios.partilhar` | Partilhar | Share | ✅ Padrão |
| `nav.instalar.ios.ecra` | Adicionar ao Ecrã | Add to Home Screen | ✅ Padrão |

---

## AUTENTICAÇÃO

| Campo CMS Key | Valor PT | Valor EN | Estado |
|---|---|---|---|
| `auth.login.titulo` | Entrar | Sign In | ✅ Padrão |
| `auth.register.titulo` | Registar | Sign Up | ✅ Padrão |
| `auth.forgot.titulo` | Recuperar Password | Reset Password | ✅ Padrão |
| `auth.reset.titulo` | Definir Nova Password | Set New Password | ✅ Padrão |
| `auth.google` | Entrar com Google | Sign in with Google | ✅ Padrão (botão desativado) |
| `auth.ou` | ou | or | ✅ Padrão |
| `auth.email.placeholder` | seu@email.com | your@email.com | ✅ Padrão |
| `auth.password.label` | Password | Password | ✅ Padrão |
| `auth.password.placeholder` | Mínimo 8 caracteres | At least 8 characters | ✅ Padrão |
| `auth.esqueceu` | Esqueceu a password? | Forgot password? | ✅ Padrão |
| `auth.sem_conta` | Não tem conta? | Don't have an account? | ✅ Padrão |
| `auth.registar` | Registar | Sign up | ✅ Padrão |
| `auth.nome.placeholder` | Seu nome completo | Your full name | ✅ Padrão |
| `auth.telemovel.placeholder` | +351 9XX XXX XXX | +351 9XX XXX XXX | ✅ Padrão |
| `auth.ja_tem_conta` | Já tem conta? | Already have an account? | ✅ Padrão |
| `auth.entra` | Entrar | Sign In | ✅ Padrão |
| `auth.criar_conta` | Criar Conta | Create Account | ✅ Padrão |
| `auth.email_enviado.titulo` | Email Enviado | Email Sent | ✅ Padrão |
| `auth.email_enviado.mensagem` | Verifique o seu email para redefinir a password | Check your email to reset your password | ✅ Padrão |
| `auth.voltar_login` | Voltar a Entrar | Back to Sign In | ✅ Padrão |
| `auth.erro.credenciais` | Email ou password incorretos | Incorrect email or password | ✅ Padrão |
| `auth.erro.token` | Link inválido ou expirado | Invalid or expired link | ✅ Padrão |
| `auth.erro.email_registado` | Este email já está registado | This email is already registered | ✅ Padrão |
| `auth.erro.dados` | Dados inválidos | Invalid data | ✅ Padrão |
| `auth.erro.generico` | Algo correu mal. Tente novamente. | Something went wrong. Please try again. | ✅ Padrão |

---

## PWA & Aplicação

| Campo CMS Key | Valor PT | Valor EN | Estado |
|---|---|---|---|
| `pwa.ios.texto_pre` | Para instalar no seu iPhone: | To install on your iPhone: | ✅ Padrão |
| `pwa.ios.texto_mid` | Toque em Partilhar e selecione "Adicionar ao Ecrã" | Tap Share and select "Add to Home Screen" | ✅ Padrão |
| `app.bem_vindo` | Bem-vindo | Welcome | ✅ Padrão |
| `app.a_mudar_lingua` | A mudar de língua… | Changing language… | ✅ Padrão |

---

## SITE (Metadados)

| Campo CMS Key | Valor PT | Valor EN | Estado |
|---|---|---|---|
| `site.url` | `https://tifas.rufvision.com` | (idem) | ✅ Derivado (novo domínio) |
| `seo.og_image` | `https://tifas.rufvision.com/og-image.png` | (idem) | ❌ **Não encontrado** — sugerir criar |
| `seo.favicon` | `https://tifas.rufvision.com/favicon.ico` | (idem) | ❌ **Não encontrado** — usar `hero.logo` |

---

## RESUMO DE ACHADOS

### ✅ Conteúdo Extraído com Sucesso
- **45 campos de texto** (labels, títulos, botões, mensagens padrão)
- **Dados de contacto reais** (morada, horário, telefone do JSON-LD)
- **Stats agregados** (classificação, avaliações, contagem de serviços)
- **Serviços** (6 tipos, via JSON-LD)
- **Especialidades** (4 áreas da barbearia)
- **Versões EN** (traduzidas seguindo padrão)

### ❌ Conteúdo NÃO Encontrado
- **9 URLs de imagens da galeria** — `galeria.foto.1–9` inacessíveis. Site renderizado por JS, imagens carregadas via API em runtime.
- **Foto do "Sobre"** (`sobre.foto`) — inacessível pela mesma razão.
- **Links de redes sociais** — apenas placeholders (`#`) em `data.js`; URLs reais no CMS do site original.
- **OG Image** (`seo.og_image`) — não está embebida no HTML.
- **Badge do Hero** (`hero.badge`) — não foi encontrado em metadados; usar padrão "Aberto agora" ou "Open now".

### ⚠️ Conteúdo Parcial ou Construído
- **URL de mapa** — Construído a partir dos dados de morada + ferramenta de maps.
- **WhatsApp** — Construído a partir do número de telefone.
- **Redação de parágrafos (Sobre)** — Padrão genérico; original não foi acessível.

---

## PRÓXIMOS PASSOS

1. **Preencher imagens da galeria:**
   - Aceder ao site original via browser (Playwright/Puppeteer) para extrair os URLs de imagens do JavaScript renderizado.
   - OU contactar o utilizador ("Tens 9 fotos da galeria em alta resolução?").

2. **Redes sociais reais:**
   - Obter URLs reais de Instagram/Facebook/WhatsApp do utilizador.
   - Colocar em `redes.instagram`, `redes.facebook`, `redes.whatsapp`.

3. **Foto do "Sobre":**
   - Obter foto retrato do barbeiro (Tiago Fernandes) para `sobre.foto`.

4. **Traduções EN:**
   - As traduções desta tabela são provisórias (padrão). Validar com cliente ou revisor linguístico.

5. **OG Image:**
   - Gerar/obter uma imagem social para `seo.og_image` (1200×630px recomendado).

---

**Ficheiro de Inventário Completo:** [INVENTARIO.md](INVENTARIO.md) (design visual + CMS keys esperadas)  
**Especificação de Editores:** [SPEC-VISUAL.md](SPEC-VISUAL.md) (campos de formulário, tipos, validação)


---

## ★ CONTEÚDO REAL EXTRAÍDO DO SITE VIVO (browser, 2026-08-04) — AUTORITATIVO

> Recolhido do DOM renderizado de `https://tiagofernandesbarbearia.rufvision.com`
> (o `curl` não o via — é SPA). Supersede os valores inferidos acima.

### Hero (`type: hero`, `variant: tifas-split`)
| Campo | Valor PT |
|---|---|
| `logo` | `https://tiagofernandesbarbearia.rufvision.com/logo.png` (1600×1600) |
| `badge` | `A aceitar marcações · Braga` |
| `titulo` | `Tiago Fernandes Barbearia` (1.ª palavra "Tiago" fica clara, resto maroon itálico) |
| `tagline` | `Onde o cuidado tradicional encontra o estilo moderno. Marca já a tua próxima visita em segundos sem chamadas.` |
| `stat1.valor` / `stat1.label` | `7+` / `ANOS` (título: "Anos de experiência") |
| `stat2.valor` / `stat2.label` | `2k+` / `CLIENTES` (título: "Clientes satisfeitos") |
| `stat3.valor` / `stat3.label` | `5` / `ESTRELAS` (título: "Estrelas em reviews") |
| `contacto.morada1` | `Rua de Exemplo 25` |
| `contacto.morada2` | `4700-000 Braga` |
| `contacto.mapa_url` | `https://www.google.com/maps/search/?api=1&query=Rua+de+Exemplo+25+4700-000+Braga` |
| `contacto.horario.dias` | `Ter–Sáb` |
| `contacto.horario.manha` | `9h–13h` |
| `contacto.horario.tarde` | `14h–19h` |
| `contacto.telefone` | `+351 926 588 550` |
| `contacto.telefone.href` | `351926588550` |

### Nav / marca
- Marca no topo: **TIAGO** / **FERNANDES BARBEARIA** (2 linhas) · itens: Início · Trabalhos · Sobre · Entrar

### Booking (`type: booking`)
- eyebrow: `MARCAÇÕES ONLINE` · título: `Marca o teu próximo corte`
- Os serviços vêm da Agenda REAL do tenant (não são conteúdo): Cabelo 40min 10€ · Sobrancelha Linha 15min 7€ · Cabelo+Barba (navalha+toalha quente) 60min 17€ · Barba (máquina) 20min 6€ · Sobrancelha Navalha 10min 3€ · Barbaterapia 45min 15€ · Cabelo+Barba (máquina) 50min 15€ · Cabelo+Limpeza Facial 60min 18€ · Cabelo (pente único) 15min 7€ · Depilação Cera 10min 3€

### ⚠ Por obter (bloqueia a paridade total)
- **Fotos da galeria** ("Trabalhos") e **foto do Sobre** — as páginas são client-side; só o logo está acessível como `<img>` na home. **O dono tem de fornecer os ficheiros/URLs.**
- **Redes sociais** — não há links de Instagram/Facebook/WhatsApp no site original (os botões apontam para `#`).
- **Nota (bug do site original):** o telefone mostra `+351 926 588 550` mas o `href` é `tel:351912345678` — no site novo usar o número correto (`351926588550`).
