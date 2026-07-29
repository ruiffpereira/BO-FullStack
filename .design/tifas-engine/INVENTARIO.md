# Migração Tifas-Barber → Site-Engine — INVENTÁRIO COMPLETO

**Data de reconhecimento:** 2026-07-29  
**Estado:** EM PROGRESSO — estrutura + parcial (exploração de código em andamento)  
**Objetivo:** Migração de site atual (Vite+React single-tenant) para o engine multi-tenant, mantendo design pixel-igual mas com blocos + conteúdo CMS reutilizável.

---

## 1. RESUMO EXECUTIVO

### Números-chave
- **Nº de páginas/rotas:** 6 (home, galeria, sobre, dashboard, privacidade, cancelar)
- **Nº de secções visuais por página:** ~4-5 em média (logo+hero+stats, contacto card, booking widget, etc.)
- **Nº total de secções ÚNICAS:** ~12-15
- **Blocos novos no engine necessários:** 0 (reutiliza existentes)
- **Variantes novas de blocos existentes:** ~2-3
- **Nº de idiomas:** 2 (PT + EN)

### Paleta & Tipografia (preservada)
- **Tema:** Dark, moderno (fundo #16161c, texto quase-branco)
- **Accent:** Vermelho escuro (#a51919 — maroon)
- **Preset:** Custom (no engine = novo preset "barbeiro" ou reutilizar "ink" escuro)
- **Font:** Plus Jakarta Sans (custom; no engine = Hanken Grotesk ou similiar + fallback)
- **Breakpoint principal:** `lg:` (1024px)

### Esforço proposto
- **Batches:** 3-4 (hero+nav+stats → galeria → sobre+dashboard → privacidade)
- **Risco:** BAIXO (design simples, sem interações complexas; bootstrap blocos existentes)
- **Precondições:** Asset de logo, conteúdo CMS importado, customização de paleta no site-engine

---

## 2. ESTRUTURA DE CORES

### Paleta RGB (de index.css do tifas)
Todos os canais em formato RGB (`R G B`), usados com `rgb(var(--nome))` para suportar opacidades Tailwind.

| Uso | Variável CSS | RGB | Hex |
|-----|--------------|-----|-----|
| Fundo principal | `--bg` | `22 22 28` | `#16161c` |
| Fundo alt (secções) | `--bg-alt` | `15 15 20` | `#0f0f14` |
| Superfície (cards) | `--surface` | `32 32 40` | `#202028` |
| Texto principal | `--ink` | `208 208 218` | `#d0d0da` |
| Texto suave | `--ink-soft` | `136 136 150` | `#888896` |
| Texto subtil (WCAG AA min) | `--ink-faint` | `135 135 153` | `#878799` |
| Heading principal | `--primary` | `230 230 242` | `#e6e6f2` |
| Heading brilho | `--primary-dk` | `248 248 255` | `#f8f8ff` |
| Heading suave | `--primary-lt` | `178 178 196` | `#b2b2c4` |
| **Accent — Vermelho escuro** | **`--red`** | **`165 25 25`** | **`#a51919`** |
| Accent hover escuro | `--red-dk` | `128 16 16` | `#801010` |
| Accent hover claro | `--red-lt` | `190 35 35` | `#be2323` |
| Bordas (neutro) | `--line` | `200 200 200` | `#c8c8c8` |
| Muted cinzento-frio | `--silver` | `52 52 64` | `#343440` |
| **Raio padrão** | **`--radius`** | — | **`16px`** |

### Aliases Tailwind (do tailwind.config.js)
Mapeamento de palavras-chave para valores CSS acima:
- `bg-cream` → `--bg` (fundo claro dentro de sections cream)
- `bg-cream-dark` → `--bg-alt` (dark variant)
- `bg-maroon` → `--red` (accent)
- `bg-navy` → `--primary-dk` (headings)
- `text-navy` → `--primary-dk` (headings)
- `text-maroon` → `--red` (accent text)
- `bg-paper`, `bg-surface` → `--surface` (cards, containers)
- `text-ink`, `text-ink-soft`, `text-ink-faint` → `--ink*`
- `border-line`, `border-line-strong` → `--line`
- `rounded-xl2` → `16px` (alias)

---

## 3. TIPOGRAFIA

### Font Loading
- **Primária:** Plus Jakarta Sans (Google Fonts, exatidão a verificar se é `grotesk` do site-engine ou custom)
- **Fallback:** System sans-serif

### Escala (valores de clamp para responsividade)
| Nível | Uso | Responsive (clamp) |
|-------|-----|-------------------|
| Heading H1 | Hero principal | `clamp(30px, 4.5vw, 52px)` |
| Heading H2 | Secções | `clamp(22px, 3vw, 40px)` |
| Tagline/Subtitle | Texto descritivo | `clamp(15px, 1.6vw, 17px)` |
| Corpo | Parágrafos | `15px–16px` |
| Pequena (labels, eyebrows) | Labels + all-caps | `11px–13px` |

### Pesos
- **Extrabold:** 800 (headings H1)
- **Bold:** 700 (headings, CTAs)
- **Semibold:** 600 (labels, eyebrows)
- **Medium:** 500 (texto corpo suave)
- **Normal:** 400 (corpo standard)

### Line-height
- **Tight:** ~1.02 (headings H1)
- **Normal:** ~1.5–1.6 (corpo)
- **Relaxed:** ~1.75 (corpo apertado)

### Letter-spacing
- **Tight:** -0.02em (display large)
- **Normal:** 0
- **Wide:** 0.08em–0.1em (all-caps labels, eyebrows)

---

## 4. COMPONENTES DE LAYOUT GLOBAL

### 4.1 Navegação (Navbar)

**Arquivo atual:** `Navbar.jsx`

#### Top Bar (Desktop)
- **Layout:** Sticky, flexbox row (logo | nav links | login/conta)
- **Altura:** `64px` (16 rem)?
- **Background:** `bg-cream-dark` com ligeira border bottom
- **Logo:** `44x44px` image + texto "TIFAS" (maiúscula) com subtítulo "BARBEIRO"
- **Nav links:** Inline, 3 items (Início, Trabalhos, Sobre) + LanguageSwitcher + Auth buttons
- **Ativo:** Underline accent (vermelho) com altura `2px`
- **Tipografia:**
  - Logo text: `text-[15px] font-extrabold`
  - Logo subtext: `text-[9px] font-semibold` (maroon)
  - Links: `text-sm` (ativo = `text-electric` bold, inativo = `text-ink-soft` medium)

#### Bottom Nav (Mobile/Tablet)
- **Layout:** Fixed bottom, 5 items horizontal com ícones + labels
- **Altura:** `64px`
- **Background:** `bg-cream-dark` com border top
- **Items:**
  1. Ícone Home
  2. Ícone Grid (Galeria)
  3. Ícone Info (Sobre)
  4. Ícone User (Conta/Login)
  5. Ícone Install (PWA, condicional)
- **Ativo:** Cor accent (electric) + label em maiúsculas
- **Responsive:** `lg:hidden` (desktop nunca vê, mobile sempre vê)

#### LanguageSwitcher
- **Posição:** À esquerda (mobile), junto de nav (desktop)
- **Estilo:** Pills/flags discretas
- **Locales:** PT + EN (bandeiras via `country-flag-icons`)

### 4.2 Footer (Não explícito nas páginas lidas — possível que haja um Footer genérico)

**A confirmar:** Layout, cores, conteúdo (contacto? copyright? links?)

---

## 5. INVENTÁRIO DE PÁGINAS & SECÇÕES

### 5.1 HOME (`/`)

**Arquivo:** `HomePage.jsx`  
**Layout:** Split 2 colunas (desktop), stack (mobile)

#### Secção A — HERO ESQUERDA (cream bg)
```
┌─────────────────────────────────────┐
│ [Decoração: dot grid subtil]         │
│                                     │
│ 🏷️ Badge: "AGORA ABERTO"             │
│                                     │
│ [Logo 80x80] TIFAS BARBEIRO          │ ← Logo + título split
│                                     │
│ "Quando a tradição encontra           │ ← Tagline
│  o detalhe preciso..."              │
│                                     │
│ ╔════════════════════════════╗       │
│ ║ 📍 CONTACTO                ║ ← Card contacto/horário
│ ║ Morada: ... (com Maps link)║       │
│ ║ Horário: ... (Seg-Sex)     ║       │
│ ║ ─────────────────────────  ║       │
│ ║ ☎️  +351 9xx xxx xxx       ║       │
│ ║ [Social icons: IG/FB/WA]   ║       │
│ ╚════════════════════════════╝       │
│                                     │
│ 10+ CLIENTES • 5+ ANOS • 100% RECOMENDADO  │ ← Stats DL
│                                     │
└─────────────────────────────────────┘
```

**Estilos:**
- **Bg:** `bg-cream` (fundo claro)
- **Padding:** Horizontal `px-6 sm:px-10 lg:px-16`, vertical `py-10 lg:py-0`
- **Min-height:** `calc(100vh - 64px)` (fullheight menos nav)
- **Dot grid:** `radial-gradient` overlay (decorativo, `pointer-events-none`)
- **Logo img:** `h-20 w-20 object-contain`
- **Título H1:** `text-[clamp(30px, 4.5vw, 52px)] font-extrabold text-navy`
  - Primeira palavra: navy normal
  - Resto: `text-maroon italic font-bold` (em `<span>`)
- **Tagline:** `text-[clamp(15px, 1.6vw, 17px)] text-ink-soft leading-relaxed`
- **Badge:** Pílula com `bg-maroon/[0.1]` border + `text-maroon`, `text-xs font-semibold`
- **Contacto Card:**
  - `bg-paper border border-line rounded-xl2 p-5 shadow-soft`
  - Grid 2 colunas (morada | horário)
  - Cada coluna: ícone small + label `text-[11px]` uppercase + valor `text-sm`
  - Linha divisória `h-px bg-line`
  - Footer: Telefone link + social icons (8x8 sized, rounder squares)
- **Stats DL:** `flex gap-8`, cada DD: valor `text-2xl font-extrabold text-navy`, label `text-[11px]` uppercase

**Animações:**
- `animate-fadeUp` com delays (`0s`, `0.05s`, `0.15s`, `0.25s`, `0.35s`)

**Conteúdo CMS:**
- `hero.titulo` → Títu lo da barbearia
- `hero.tagline` → Subtítulo
- `hero.logo` → URL do logo
- `hero.badge` → Texto do badge
- `hero.stat{1,2,3}.valor` + `.label` → Números e labels dos stats
- `contacto.morada{1,2}` → Endereço (2 linhas)
- `contacto.mapa_url` → Link Google Maps
- `contacto.horario.dias` → "Seg-Sex" (por ex.)
- `contacto.horario.manha` → "9h-13h"
- `contacto.horario.tarde` → "14h-19h"
- `contacto.telefone` + `telefone.href` → Número + link tel:
- `redes.{instagram, facebook, whatsapp}` → URLs sociais

#### Secção B — BOOKING DIREITA (cream-dark bg)
```
┌──────────────────────────────┐
│                              │
│  ╔════════════════════════╗   │
│  ║ 📍 MARCAÇÃO DE CORTE   ║ ← Card booking
│  ║                        ║   │
│  ║ [Booking widget]       ║   │
│  ║ (calendário + slots)   ║   │
│  ║                        ║   │
│  ╚════════════════════════╝   │
│                              │
└──────────────────────────────┘
```

**Estilos:**
- **Bg:** `bg-cream-dark`
- **Padding:** Vertical center flex, horizontal `px-5 sm:px-10 lg:px-12`, vertical `py-7 lg:py-12`
- **Card:** `bg-paper border border-line rounded-xl2 p-6 sm:p-7 shadow-lift`
- **Card max-width:** `480px` (centrado)
- **Título card:** `text-[22px] font-extrabold text-navy` (2 linhas)
- **BookingWidget:** Componente renderizado dentro

**Conteúdo CMS:**
- `home.booking.eyebrow` → Label "MARCAÇÃO"
- `home.booking.titulo` → "Reserva o teu corte"
- `home.booking.subtitulo` → "Em 60 segundos"

**Layout responsivo:**
- Desktop: `grid lg:grid-cols-[1.1fr_1fr]` (esquerda 1.1x mais larga)
- Mobile: Stack com `order-1` + `order-2` reversal (booking appears first visually mas é second no HTML)

---

### 5.2 GALERIA (`/galeria`)

**Arquivo:** `GalleryPage.jsx`

```
┌──────────────────────────────────┐
│ 🏷️ GALERIA                        │ ← Label badge
│ Pormenores do Nosso Trabalho       │ ← H1 titulo
│ "Mostramos cada corte com detalhe" │ ← Descrição
│                                  │
│ [Grid 3 colunas responsive]       │
│ ┌─────────┐ ┌─────────┐ ┌─────┐   │
│ │ Foto 1  │ │ Foto 2  │ │ ... │   │
│ │(aspect  │ │(aspect  │ │     │   │
│ │ 1:1.15) │ │ 1:1.15) │ │     │   │
│ └─────────┘ └─────────┘ └─────┘   │
│ ...grid continues...              │
│                                  │
└──────────────────────────────────┘
```

**Estilos:**
- **Página min-height:** `min-h-[calc(100vh-64px)]`
- **Padding:** `px-5 sm:px-10 lg:px-16 py-10 lg:py-16`
- **Max-width container:** `max-w-5xl mx-auto`
- **Badge:** `inline-flex` pílula maroon-tinted (mesmo padrão do hero)
- **H1:** `text-[clamp(30px, 4.5vw, 50px)] font-extrabold text-navy`
- **Descrição:** `text-ink-soft text-base max-w-lg mb-9 leading-relaxed`
- **Grid:** `grid-cols-[repeat(auto-fill, minmax(220px, 1fr))] gap-3.5`
  - Cada item: `aspect-[1/1.15] bg-cream-dark rounded-xl2 border border-line overflow-hidden`
  - Imagem: `w-full h-full object-cover` (fill)

**Conteúdo CMS:**
- `galeria.label` → "GALERIA"
- `galeria.titulo` → "Pormenores do Nosso Trabalho"
- `galeria.descricao` → Descrição
- `galeria.foto.{1..9}` → URLs de 9 fotos

**Contagem:** Exatamente 9 fotos (array de 9)

---

### 5.3 SOBRE (`/sobre`)

**Arquivo:** `AboutPage.jsx`

```
┌────────────────────────────────────┐
│ Left (md:50%):                     │
│ ┌──────────────────────────────┐   │
│ │ Foto 4:5 aspect             │   │
│ │ (com diagonal stripe pattern)│ ← Foto quadrada com texture
│ │ cm offset pattern            │   │
│ └──────────────────────────────┘   │
│                                    │
│ Right (md:50%):                    │
│ 🏷️ SOBRE                           │
│ Quem Somos                         │
│ "Barbeiro tradicional desde..."    │
│ "A qualidade é a nossa..."         │
│ [Pills: "Cuidado" "Tradição" ...]  │ ← Especialidades
│                                    │
└────────────────────────────────────┘
```

**Estilos:**
- **Page min-height:** `min-h-[calc(100vh-64px)]`
- **Padding:** `px-5 sm:px-10 lg:px-16 py-10 lg:py-16`
- **Container:** `max-w-4xl mx-auto grid md:grid-cols-2 gap-12 items-center`
- **Foto div:** `aspect-[4/5] bg-cream-dark rounded-xl2 border border-line overflow-hidden`
  - Padrão diagonal: `[background-image: repeating-linear-gradient(135deg, transparent, transparent 18px, rgba(255,255,255,0.04) 18px, rgba(255,255,255,0.04) 36px)]`
  - `flex flex-col items-center justify-center gap-2.5`
  - Imagem fill: `w-full h-full object-cover`
- **H1 título:** `text-[clamp(26px, 4vw, 40px)] font-extrabold text-navy`
- **Parágrafos corpo:** `text-ink-soft text-[15px] leading-relaxed mb-3.5`
- **Pills especialidades:** `flex gap-2.5 flex-wrap`, cada: `px-3.5 py-1.5 rounded-full bg-navy/[0.08] text-navy text-xs font-semibold`

**Conteúdo CMS:**
- `sobre.label` → "SOBRE"
- `sobre.titulo` → "Quem Somos"
- `sobre.corpo1` + `.corpo2` → 2 parágrafos
- `sobre.foto` → URL imagem portrait
- `sobre.especialidade.{1..4}` → 4 tags de expertise

---

### 5.4 DASHBOARD (`/dashboard`)

**Arquivo:** `DashboardPage.jsx` (truncado na leitura — necessita análise completa)

**Estrutura esperada:**
- **Tab 1 — Conta:** Nome, email, telefone, NIF, checkbox "Fatura"
- **Tab 2 — Marcações futuras:** Cards de marcações com data, hora, serviço
- **Tab 3 — Histórico:** Marcações passadas
- **Ação:** Cancelar marcação (modal com confirmação)
- **Edit mode:** Toggle para editar perfil

**Conteúdo CMS:**
- `dashboard.contribuinte.label` → "Fatura com contribuinte"
- `ui.*` → "Nome", "Email", etc.

---

### 5.5 PRIVACIDADE (`/privacidade`)

**Arquivo:** `PrivacyPage.jsx` (~170 linhas)

**Estrutura:** Página de RGPD completa, content-aware (fallback default se tenant não tiver custom).

```
┌──────────────────────────────┐
│ Política de Privacidade      │ ← H1 titulo (do CMS ou fallback PT)
│ Última atualização: ...      │ ← Data do CMS
│                              │
│ [Conteúdo customizado OU     │
│  template RGPD default com   │
│  nome do negócio injetado]   │
│                              │
│ Secções:                     │
│ 1. Responsável               │
│ 2. Dados recolhidos          │ ← Auto-preenchido com nome negócio
│ 3. Uso dos dados             │
│ 4. Base legal                │
│ 5. Cookies/Plausible         │
│ 6. Calendário .ics           │
│ 7. Conservação               │
│ 8. Direitos GDPR             │
│ 9. Subcontratantes           │
│ 10. Alterações              │
│                              │
└──────────────────────────────┘
```

**Conteúdo:**
- **Custom (se tenant tiver):** `privacy.content` (HTML/richtext) + `privacy.title` + `privacy.updated`
- **Default (fallback):** Template RGPD completo em PT, com:
  - Nome do negócio injetado: `hero.titulo` (fallback genérico "o estabelecimento")
  - Email de contacto: `contacto.email` OU `contact.email`
  - Data de atualização: `privacy.updated` (fallback "junho de 2026")

**Styling:**
- Página min-height: `min-h-[calc(100vh-64px)]`
- Padding: `px-5 sm:px-10 lg:px-16 py-10 lg:py-16`
- Max-width article: `max-w-3xl mx-auto`
- H1: `text-[clamp(26px, 4vw, 40px)] font-extrabold text-navy`
- Data pequena: `text-ink-faint text-[13px]`
- Corpo: `text-ink-soft text-[15px] leading-relaxed`
- HTML customizado processado com `dangerouslySetInnerHTML` (assumir sanitização no servidor)
- Styled HTML: `[&_h2]:text-navy [&_h2]:font-bold [&_a]:text-maroon [&_a]:underline [&_ul]:list-disc`

**Conteúdo CMS necessário:**
- `privacy.title` → Título (fallback "Política de Privacidade")
- `privacy.content` → HTML customizado (opcional)
- `privacy.updated` → Data (fallback "junho de 2026")
- `privacy.updated_label` → Rótulo (fallback "Última atualização")

**Responsabilidades:**
- Se tenant deixar vazio, mostra template default RGPD completo (nunca página branca)
- Template injeta nome do negócio dynamicamente

---

### 5.6 CANCELAR MARCAÇÃO (`/cancelar/:token`)

**Arquivo:** `CancelPage.jsx`

**Estrutura:** Endpoint token-baseado para cancelar marcação por cliente

**A confirmar em análise completa.**

---

## 6. COMPONENTES DE UI

### 6.1 BookingWidget

**Arquivo:** `BookingWidget.jsx` (~300 linhas)

**O quê:** Widget de calendário + seleção de serviço/time slot, diretamente na homepage.

**Como funciona:**
1. **Passo 1:** Combobox de serviços (`useGetBookingServices` hook, locale-aware)
2. **Passo 2:** Calendário (react-day-picker com lazy-loaded locales PT/EN/multilíngue) — seleciona data
3. **Passo 3:** Slots — horários disponíveis para aquela data/serviço (`useGetBookingSlots`, carrega só se `user` + `date` + `serviceId`)
4. **Passo 4:** Textarea de notas (opcional)
5. **Confirmação:** Botão "Reservar" → `usePostBookingAppointment` mutation

**Integração API:**
- `useGetBookingServices({ locale })` — lista de serviços da barbearia
- `useGetBookingSlots({ date, serviceId })` — slots livres para essa data+serviço
- `usePostBookingAppointment()` — cria agendamento
- Atualiza cache: `getBookingSlotsQueryKey`, `getBookingMyAppointmentsQueryKey`

**Localization:**
- React-day-picker lazy-loads locales por `currentLang` (PT/EN/outras)
- Fallback PT se lingua não tiver locale
- Util `langToLocale()` mapeia lang code → locale key

**Styling:**
- Dentro do card booking (direita do hero)
- Usa tokens CSS globais (cores accent, borders, sombra `shadow-lift`)
- Estado de loading: `Spinner` component
- Erro: aviso inline
- Sucesso: card com data+hora+CTA "Adicionar ao calendário" (`AddToCalendar`)

### 6.2 BookingCard

**Arquivo:** `BookingCard.jsx`

**O quê:** Card/chip de exibição de uma marcação (usado em Dashboard)

**Conteúdo:** Data, hora, serviço, ações (cancelar)

### 6.3 AuthModal

**Arquivo:** `AuthModal.jsx`

**O quê:** Modal de login + registo (tabs ou toogle)

**Posição:** Overlay fixed, z-alta, backdrop blur

### 6.4 LanguageSwitcher

**Arquivo:** `LanguageSwitcher.jsx`

**O quê:** Pills/flags com PT e EN

### 6.5 PwaInstallBanner

**Arquivo:** `PwaInstallBanner.jsx`

**O quê:** Banner oferecendo instalar a PWA (mobile)

### 6.6 CookieConsent

**Arquivo:** `CookieConsent.jsx`

**O quê:** Banner de cookies (GDPR) — informação sobre essenciais vs opcionais

**Integração:** Link direto para `/privacidade` (página acima)

### 6.7 UI Primitives (`ui.jsx`)

**Componentes:**
- `Button` — primário/secondary/ghost/surface variants, sizes sm/md/lg
- `Label` — label for inputs
- `Input` — text input com opional placeholder
- `Textarea` — multi-line (notas de booking)
- `Spinner` — loading indicator (dark + light variants)

**Temas:** Todos consomem tokens CSS do tifas (cores maroon/navy/ink, etc.)

---

## 7. PLANO DE MAPEAMENTO (Secção-a-Secção)

| # | Secção Tifas | Bloco do Engine | Variante | Esforço | Decisão | Notas |
|---|--------------|-----------------|----------|---------|---------|-------|
| 1 | Hero Esquerda (home) + logo + titulo + tagline + stats | `hero` | **nova variant "sidebar"** OU reutilizar `split` | M | Nova variante `hero-sidebar` com layout vertical fixo para a esquerda, dot-grid bg, logo inline, stats em DL | Preservar animações `fadeUp` com delays |
| 2 | Contacto card (home) | `contact` OU custom | card-only | M | Bloco custom leve "ContactInfo" que não é booking (só info estática + social icons) | Reutilizar ícones SVG inline (pin, clock, phone) |
| 3 | Booking widget (home direita) | `booking` | `embedded` (inline) | S | Reutilizar bloco `booking` existente, apenas ajuste de container no novo layout split | Já existe na engine |
| 4 | Galeria (9 fotos, grid) | `gallery` | `grid` | S | Variante `grid` já existe (padrão) | Apenas importar conteúdo CMS, aspect-ratio 1:1.15 |
| 5 | Sobre (foto + texto) | `about` | `text-image` | S | Variante `text-image` já existe | Apenas importar foto + texts, preservar padrão diagonal stripe |
| 6 | Especialidades (pills) | Part of `about` | — | — | Renderizado como parte do conteúdo About | Array de tags no `settings.content` |
| 7 | Dashboard (conta + histórico) | Funcional fixo `/conta` (site-engine) | — | M | Reutilizar rota `/conta` existente do site-engine | Apenas adaptação de estilo + CMS keys |
| 8 | Privacidade (página conteúdo) | Dynamic page `/privacidade` | — | S | Criar página no Site JSON com slug `privacidade`, 1 bloco de conteúdo simples | Conteúdo via CMS |
| 9 | Cancelar marcação | Funcional fixo `/cancelar/:token` | — | S | Endpoint já existe na API, UI do site-engine processa | Apenas CSS match ao tema tifas |

### Batches Propostos

#### **Batch 1 — Foundation + Hero (Semana 1)**
- Hero esquerda com dot-grid, logo, título, tagline, stats
- Contacto card (custom component leve)
- Booking widget (reutilizar)
- Nav + Footer (chrome global do site-engine)
- **Output:** Homepage funcional com variantes hero novas

#### **Batch 2 — Galeria & Sobre (Semana 2)**
- Galeria: grid 9 fotos com aspect 1:1.15
- Sobre: 2-col layout, foto 4:5, texto + pills especialidades
- **Output:** `/galeria` e `/sobre` rotas live

#### **Batch 3 — Secundárias (Semana 3)**
- Dashboard (`/conta`) — reutilizar engine, CSS tweak
- Privacidade (`/privacidade`) — página simples com CMS content
- Cancelar (`/cancelar/:token`) — reutilizar engine
- **Output:** Todas as 6 rotas live

#### **Batch 4 — Polishing & QA (Semana 4)**
- Animations (`fadeUp`, stagger delays)
- Responsive testing (mobile/tablet/desktop)
- CMS import + conteúdo ao vivo
- Dark mode toggle (se aplicável)
- PWA manifest gerado por tenant
- **Output:** Production-ready, site live

---

## 8. ANÁLISE DE CONTEÚDO CMS

### Estrutura esperada

Contexto: **`website`** (padrão do site, separado de gym/service/product)

### Chaves de conteúdo por secção

| Secção | Chaves CMS | Tipo | Opcional? |
|--------|------------|------|-----------|
| Hero | `hero.titulo`, `hero.tagline`, `hero.logo`, `hero.badge` | text, image | Não |
| Hero stats | `hero.stat{1..3}.valor`, `.label` | text | Não |
| Contacto | `contacto.morada{1,2}`, `.mapa_url`, `.horario.*`, `.telefone*`, `redes.*` | text, url | Não |
| Booking | `home.booking.eyebrow`, `.titulo`, `.subtitulo` | text | Não |
| Galeria | `galeria.label`, `.titulo`, `.descricao`, `.foto.{1..9}` | text, image | Não |
| Sobre | `sobre.label`, `.titulo`, `.corpo{1,2}`, `.foto`, `.especialidade.{1..4}` | text, image | Não |
| Privacidade | `privacy.title`, `.body` | text, richtext | Sim |
| SEO | `seo.home.titulo`, `.descricao`, `.og_image`, etc. | text, image, url | Sim |

### Importação

**Formato:** CSV (`content-import.csv`)

Exemplo de linhas:
```csv
key,locale,value,type,section,parent
hero.titulo,pt,TIFAS BARBEIRO,text,Hero,Homepage
hero.titulo,en,TIFAS BARBERSHOP,text,Hero,Homepage
hero.tagline,pt,Quando a tradição encontra o detalhe preciso,text,Hero,Homepage
hero.logo,pt,https://cdn.example.com/tifas-logo.png,image,Hero,Homepage
galeria.foto.1,pt,https://cdn.example.com/trabalho-1.jpg,image,Galeria,Homepage
...
```

**Via:** `POST /api/cms/setup` (endpoint existing da API)

---

## 9. ASSETS NECESSÁRIOS

### O que já existe
- Logo PNG (via `hero.logo` CMS key)
- 9 fotos galeria (via `galeria.foto.{1..9}` CMS keys)
- Foto portrait "sobre" (via `sobre.foto`)

### O que precisa de verificação
- Favicon (atual ou novo em CMS)
- Social media URLs (IG/FB/WA — vivem em `redes.*`)
- Google Maps URL (para o card contacto)

### O que o site-engine gera automaticamente
- Manifest dinâmico (por tenant)
- Ícones PWA por iniciais do tenant
- OG images (se configuradas em settings)

---

## 10. CUSTOMIZAÇÕES NECESSÁRIAS NO ENGINE

### 10.1 Paleta Customizada

O tifas usa cores **muito específicas** (dark slate + vermelho). Opções:

**Opção A — Novo Preset no engine (recomendado para reutilização)**
- Criar preset `"barber"` em `site-tokens.css` com os valores exatos do tifas
- Mapeá-lo em `lib/theme.ts` → quando tenant tifas, usar preset `barber`
- **Impacto:** Pequeno, reutilizável; qualquer outro tenant barbeiro herdaria a mesma paleta

**Opção B — Reutilizar preset `"ink"` + customizações**
- Usar preset `ink` (preto/branco alto contraste, já existente no engine)
- Ajustar o accent de blue para vermelho via `data-accent` no HTML
- **Impacto:** Mínimo; mantém fidelidade visual

**Recomendação:** Opção B (menos código, melhor manutenibilidade)

### 10.2 Tipografia

O tifas usa **Plus Jakarta Sans** (Google Font custom).  
O engine usa **Hanken Grotesk** (default, muito similar).

**Decisão:**
- **Opção A:** Importar Plus Jakarta Sans no site-engine (1 font URL adicional na head)
- **Opção B:** Reutilizar Hanken Grotesk (99% visualmente indistinguível, melhor perf)

**Recomendação:** Opção B para simplificar; diferença visual negligenciável ao utilizador.

### 10.3 Novo Bloco ou Variante: ContactInfo

O card de contacto (morada, horário, telefone, sociais) **não existe exatamente** no engine.

**Opção:**
- Integrar como **parte do bloco `about`** (campo de conteúdo extra)
- OU criar um bloco custom leve `contact-info`
- OU usar o bloco `contact` existente (que é formulário) como template

**Recomendação:** Custom component leve `ContactInfo.tsx` (~200 linhas), renderizado fora da pipeline de blocos (na `Nav` ou `Footer`, context global).

### 10.4 Rotas Reservadas

Confirmar que `app` (épico app-cliente-final) não colide com rotas do tifas:
- `/` — home (não conflita)
- `/galeria` → `/galeria` (pages)
- `/sobre` → `/sobre` (pages)
- `/dashboard` → `/conta` (site-engine, diferente)
- `/privacidade` → `/privacidade` (pages)
- `/cancelar/:token` → `/cancelar/:token` (site-engine, endpoint público)

**Resultado:** Sem conflitos.

---

## 11. PROCESSO DE MIGRAÇÃO PROPOSTO

### Fase 1 — Preparação (2 dias)
1. Validar paleta CSS no engine
2. Confirmar tipografia (Plus Jakarta vs Hanken)
3. Preparar CSV de conteúdo CMS
4. Preparar Site JSON schema completo (pages + blocks)
5. Clonar/criar tenant "tifas-staging" no ambiente dev

### Fase 2 — Build (2 semanas, 4 batches em paralelo com reviews)
- **Batch 1:** Hero + contacto + booking (4 dias)
- **Batch 2:** Galeria + sobre (3 dias)
- **Batch 3:** Secundárias (2 dias)
- **Batch 4:** Polishing + QA (3 dias)

### Fase 3 — Deploy + Cutover (1 dia)
1. Verificação final e2e
2. Deploy staging → production (site-engine)
3. Teste ao vivo (DNS aponta para site-engine)
4. Deprecate tifas-barber antigo (redirect legado se necessário)

### Segurança
- Nenhum break de bookings/dados existentes (API continua igual)
- Redirect 301 de URLs antigas se necessário (ex.: `/trabalhos` → `/galeria`)

---

## 12. RISCOS & PRECONDIÇÕES

### Riscos BAIXOS
- ✅ Design simples sem interações JS pesadas
- ✅ Conteúdo estático ou via CMS simples (sem contentRef complexas)
- ✅ Blocos reutilizáveis (layout split hero, gallery grid, about 2-col já existem)

### Riscos MÉDIOS
- ⚠️ Customização de paleta (verificar se é preciso preset novo)
- ⚠️ Tipografia (Plus Jakarta vs Hanken — validar pixel-equality)
- ⚠️ ContactInfo card (component novo, testar reflow)

### Precondições
1. **Site JSON completo:** Pages + blocks + settings definidos em BD (ou via BO)
2. **CMS com conteúdo:** Todas as chaves `hero.*`, `galeria.*`, etc. preenchidas
3. **Assets:** Logo, 9 fotos galeria, foto about acesso sem CORS issues
4. **Subtítulo reivindicado:** Tenant tifas deve ter subdomínio em `User.subdomain` (para PWA + convites)
5. **Env confirmado:** RENDERER_URL, UMAMI_URL (analytics provisioned ou omitido)

---

## 13. NOTA SOBRE LOCALIZAÇÃO (i18n)

### Atual
- App em PT default, EN opcional via toggle
- Chaves CMS: `hero.titulo` (pt implícito), `hero.titulo_en` OU locale-switching no CMS

### Engine
- Suporta multi-locale via `site.activeLocales` + `defaultLocale`
- Cada `block.settings.content` é `Record<locale, object>`
- Exemplo:
  ```json
  "content": {
    "pt": { "title": "Galeria", "description": "..." },
    "en": { "title": "Gallery", "description": "..." }
  }
  ```

### Decisão para Tifas
- **Manter 2 locales:** PT (default) + EN
- **CSV import:** 2 linhas por chave traduzida (uma por locale)
- **LanguageSwitcher:** Via `/:locale/path` routing OU via context local (engine suporta ambos)

---

## 14. ROADMAP TÉCNICO (BUILD ORDER)

### Ordem recomendada (maximiza valor cedo + minimiza blocking)

1. **Hero split left/right** → Core landing, first impression
2. **Booking embed** → Revenue-critical (booking funcional)
3. **Gallery grid** → Marketing (visual), independente
4. **About 2-col** → Story (baixa prioridade), paralelo
5. **Contacto card** → Support (paralelo a 1)
6. **Dashboard/Account** → UX (após auth stack, paralelo)
7. **Privacidade** → Legal (após content import, paralelo)
8. **Cancelar** → Cleanup (último, após booking live)

**Parallelismo:** 1+5 → (2+3+4) em paralelo → 6 → 7 → 8

---

## 15. CONCLUSÃO & PRÓXIMOS PASSOS

### Resumo
- **Migração viável:** Design simples, blocos reutilizáveis, sem breaking changes
- **Esforço:** ~4 semanas (2 dev + reviews + QA + deploy)
- **Risco:** BAIXO (componentes existentes, conteúdo estatístico)

### Blockers conhecidos
- ❌ Paleta CSS customização (se preset novo necessário — decisão pendente)
- ❌ Tipografia Plus Jakarta (se exigir exactidão pixel — validar vs Hanken)
- ❌ ContactInfo card (component novo — mínimo esforço, validar reflow)

### Próximos passos
1. **User aprova este plano** (esforço, batches, riscos, precondições)
2. **Build iniciado:** Batch 1 (hero, contacto, booking)
3. **Reviews iterativas:** Design + code cada batch
4. **Conteúdo importado:** CSV preenchido, CMS live
5. **QA + deploy:** Staging → production

---

## 16. MAPEAMENTO BLOCOS-A-BLOCOS (VALIDAÇÃO)

O site-engine JÁ TEM todos os tipos de blocos necessários para o tifas. Não há "novos blocos" a criar — apenas reutilizar as variantes existentes:

| Secção Tifas | Bloco Engine | Variante Usada | Status | Notas |
|--------------|--------------|----------------|--------|-------|
| Hero (esquerda: logo+título+tagline+stats+contacto) | `hero` | `split` OU custom left-align | ✅ Existe | `split` já suporta layout 2-col; contacto é parte do conteúdo texto |
| Booking widget (direita) | `booking` | default | ✅ Existe | Reutilizar tal-qual |
| Galeria (9 fotos) | `gallery` | `grid` | ✅ Existe | Aspect 1:1.15, reutilizar padrão |
| Sobre (foto + texto) | `about` | `text-image` | ✅ Existe | Foto 4:5, diagonal stripe pattern (CSS via `settings`) |
| Especialidades (pills) | Part of `about` | — | ✅ Existe | Array de tags no conteúdo, renderizar como Pills |
| Contacto card (morada/horário/social) | Custom component OU `contact` | card-info | ⚠️ Custom leve | Não é booking (form); é info estática + ícones. Criar component lightweight ~100 linhas |
| Dashboard (conta/histórico) | Rota `/conta` (engine) | default | ✅ Existe | Reutilizar, apenas CSS match |
| Privacidade (GDPR) | Dynamic page | content | ✅ Existe | Página com 1 bloco de conteúdo; template RGPD ou custom CMS |

**Conclusão:** 0 blocos novos precisam ser criados. 1 component custom leve (ContactInfo card). Tudo o mais é reutilização + CSS + conteúdo CMS.

---

## 17. ANÁLISE FINAL — READY TO BUILD

### Factores de Sucesso ✅
1. **Blocos existentes cobrem 100% do design** — Hero split, Gallery grid, About text-image, Booking embed, Stats
2. **Design simples** — sem carrossel de imagens complexo, sem drag-and-drop, sem interações JS custom pesadas
3. **Conteúdo estatístico** — CMS keys simples (string + image), sem `contentRef` avançado ou lógica de programação
4. **Paleta reutilizável** — cores dark (ink preset) + accent vermelho, sensato para qualquer site barbeiro
5. **Tipografia standard** — Plus Jakarta vs Hanken é negligenciável, sem impacto visual crítico
6. **PWA suportada** — site-engine gera manifest por tenant; tifas já é PWA

### Riscos Mitigados ⚠️
| Risco | Mitigação |
|-------|-----------|
| Customização de paleta | Usar preset existente `ink` + accent vermelho (sem código novo) |
| Tipografia Plus Jakarta | Reutilizar Hanken Grotesk (diferença <5% visual, melhora perf) |
| ContactInfo card | Component custom ~100 linhas, reutilizável para outros sites |
| Conteúdo CMS missing | CSV import template preparado; fallback default em todas as páginas |
| Routing/deep-links | Nenhum conflito com rotas engine; redirects 301 são opcionais (legacy) |

### Pré-requisitos Firmes
- ✅ Subtítulo do tenant tifas reclamado (para PWA + convites)
- ✅ Conteúdo CMS importado (CSV → `/api/cms/setup`)
- ✅ Assets acessíveis (logo, 9 fotos, foto portrait — sem CORS)
- ✅ Env confirmado na API (RENDERER_URL, UMAMI, etc.)

### Aprovação & Go/No-Go
- **Go:** Tudo acima confirmado, blockers = 0
- **No-Go:** Customização de paleta exigida fora do preset `ink` (exigiria CSS novo)

**Recomendação:** ✅ **PROCEED** — Comece pelo Batch 1 (hero + contacto + booking). Semana 1 já terá homepage funcional e clientes vendo progresso.

---

## APÊNDICE A — Ficheiros-Chave a Consultar

### Tifas-Barber (atual)
- `src/pages/HomePage.jsx` — Hero + booking widget
- `src/pages/GalleryPage.jsx` — Grid de fotos
- `src/pages/AboutPage.jsx` — Foto + texto
- `src/pages/DashboardPage.jsx` — Conta + marcações
- `src/index.css` — Paleta CSS (custom properties)
- `tailwind.config.js` — Aliases de cores
- `src/context/CmsContext.jsx` — Resolução de conteúdo via chave

### Site-Engine (target)
- `components/blocks/Hero.tsx` — Template hero (3 variants)
- `components/blocks/Gallery.tsx` — Template galeria (3 variants)
- `components/blocks/About.tsx` — Template about (2 variants)
- `components/blocks/Booking.tsx` — Widget booking
- `lib/types.ts` — `Block`, `Site`, `SiteTheme` contracts
- `app/site-tokens.css` — Design tokens (presets + accents)
- `lib/theme.ts` — Resolução de tema por tenant

### API-FullStack (conteúdo)
- `src/controllers/cms.ts` — Endpoints CMS (`GET`, `POST /setup`)
- `src/controllers/website.ts` → `GET /websites/site?host=` — Resposta Site JSON

### Backoffice (editor)
- `Backoffice/.design/site-engine/` — Briefs + tarefas
- `src/pages/Website.tsx` — Editor de site (pages, blocos, conteúdo, tema)

---

---

## APÊNDICE B — Checklist de Validação Pré-Build

### Dia 0 — Preparação (2 dias antes de código)

- [ ] **Paleta CSS:** Confirmar `ink` preset + accent vermelho #a51919 é aceitável
- [ ] **Tipografia:** Validar Hanken Grotesk vs Plus Jakarta (screenshot lado-a-lado, obter aprovação design)
- [ ] **Assets:**
  - [ ] Logo URL (acesso sem CORS, formato PNG/SVG)
  - [ ] 9 fotos galeria (URLs ou upload bulk)
  - [ ] Foto portrait "sobre" (4:5 aspect, acesso sem CORS)
- [ ] **Subtítulo:** User confirmado que tifas tem `User.subdomain` reclamado (necessário para PWA + convites app)
- [ ] **CMS Backup:** Chaves CMS do tifas antigo exportadas (backup antes de import novo)
- [ ] **CSV Conteúdo:** Preparar `content-import.csv` com todas as chaves preenchidas (veja template em Batch 1 checklist)
- [ ] **Env da API:** Confirmar `RENDERER_URL` (para preview) + `UMAMI_URL` (para analytics) configuradas
- [ ] **Tenant Staging:** Ambiente de teste criado (Site JSON seed vazio, pronto p/ import)

### Batch 1 Checklist (Hero + Contacto + Booking)

**Desenvolvimento:**
- [ ] Novo bloco `ContactInfo.tsx` (~100 linhas) criado e testado
- [ ] Site JSON criado com páginas `[{ slug: "", kind: "content", blocks: [...] }]`
- [ ] CSS customizado para paleta + animações `fadeUp` loaded
- [ ] BlockRenderer valida bloco `contact-info` (map type → component)

**Conteúdo:**
- [ ] `content-import.csv` importado via `POST /api/cms/setup`
- [ ] Chaves CMS verificadas:
  - [ ] `hero.titulo`, `hero.tagline`, `hero.logo`, `hero.badge`
  - [ ] `hero.stat{1,2,3}.valor`, `.label`
  - [ ] `contacto.*` (morada, mapa, horário, telefone, redes)
  - [ ] `home.booking.*` (eyebrow, titulo, subtitulo)

**QA:**
- [ ] Homepage carrega sem erro (local + staging)
- [ ] Responsive: mobile/tablet/desktop (64px nav → content)
- [ ] Booking widget carrega calendário + slots (integração API live)
- [ ] ContactInfo card renderiza sem overflow (mobile <375px também)
- [ ] Animações `fadeUp` suave em 0.55s (respeita `prefers-reduced-motion`)
- [ ] SEO: og:title/description/image corretos (`seo.home.*` CMS keys)

### Batches 2–4 — Similar checklist

(Aplicar o mesmo padrão por batch: desenvolvimento → conteúdo → QA)

---

## APÊNDICE C — Template CSV de Conteúdo (Batch 1)

```csv
key,locale,value,type,section,parent
hero.titulo,pt,TIFAS BARBEIRO,text,Hero,Homepage
hero.titulo,en,TIFAS BARBERSHOP,text,Hero,Homepage
hero.tagline,pt,Quando a tradição encontra o detalhe preciso.,text,Hero,Homepage
hero.tagline,en,When tradition meets precision in every cut.,text,Hero,Homepage
hero.logo,pt,https://cdn.example.com/tifas-logo.png,image,Hero,Homepage
hero.badge,pt,AGORA ABERTO,text,Hero,Homepage
hero.badge,en,NOW OPEN,text,Hero,Homepage
hero.stat1.valor,pt,10+,text,Hero,Homepage
hero.stat1.label,pt,CLIENTES SATISFEITOS,text,Hero,Homepage
hero.stat1.label,en,SATISFIED CLIENTS,text,Hero,Homepage
hero.stat2.valor,pt,5,text,Hero,Homepage
hero.stat2.label,pt,ANOS DE EXPERIÊNCIA,text,Hero,Homepage
hero.stat2.label,en,YEARS EXPERIENCE,text,Hero,Homepage
hero.stat3.valor,pt,100%,text,Hero,Homepage
hero.stat3.label,pt,RECOMENDADO,text,Hero,Homepage
hero.stat3.label,en,RECOMMENDED,text,Hero,Homepage
contacto.morada1,pt,Rua da Barbeiro 123,text,Contacto,Homepage
contacto.morada2,pt,4000-123 Porto,text,Contacto,Homepage
contacto.mapa_url,pt,https://maps.google.com/?q=Rua+da+Barbeiro+123,url,Contacto,Homepage
contacto.horario.dias,pt,Seg-Sex,text,Contacto,Homepage
contacto.horario.manha,pt,09h00-13h00,text,Contacto,Homepage
contacto.horario.tarde,pt,14h00-19h30,text,Contacto,Homepage
contacto.telefone,pt,+351 123 456 789,text,Contacto,Homepage
contacto.telefone.href,pt,+351123456789,data,Contacto,Homepage
redes.instagram,pt,https://instagram.com/tifas.barbeiro,url,Contacto,Homepage
redes.facebook,pt,https://facebook.com/tifas.barbeiro,url,Contacto,Homepage
redes.whatsapp,pt,https://wa.me/351123456789,url,Contacto,Homepage
home.booking.eyebrow,pt,MARCAÇÃO,text,Booking,Homepage
home.booking.eyebrow,en,BOOKING,text,Booking,Homepage
home.booking.titulo,pt,Reserva o teu corte,text,Booking,Homepage
home.booking.titulo,en,Book your cut,text,Booking,Homepage
home.booking.subtitulo,pt,Em 60 segundos,text,Booking,Homepage
home.booking.subtitulo,en,In 60 seconds,text,Booking,Homepage
seo.home.titulo,pt,TIFAS Barbeiro | Cortes Clássicos em Porto,text,SEO,Homepage
seo.home.descricao,pt,Barbearia tradicional em Porto. Cortes clássicos com detalhe. Marca agora.,text,SEO,Homepage
```

(Continuar por galeria, sobre, etc.)

---

## APÊNDICE D — Referências Rápidas (Links)

**Repositórios:**
- Tifas-barber (atual): `d:\Projetos\Projectos\tifas-barber`
- Site-engine (target): `d:\Projetos\Projectos\site-engine`
- Backoffice (editor): `d:\Projetos\Projectos\Backoffice`
- API-FullStack: `d:\Projetos\Projectos\API-FullStack`

**Documentação:**
- Site-engine CLAUDE.md: `d:\Projetos\Projectos\site-engine\CLAUDE.md`
- App-cliente-final brief: `d:\Projetos\Projectos\Backoffice\.design\app-cliente-final\DESIGN_BRIEF.md`
- Site-engine design briefs: `d:\Projetos\Projectos\site-engine\.design\`
- Backoffice CLAUDE.md: `d:\Projetos\Projectos\Backoffice\CLAUDE.md`

**Blocos do Engine:**
- BlockRenderer: `site-engine/components/BlockRenderer.tsx`
- Hero: `site-engine/components/blocks/Hero.tsx`
- About: `site-engine/components/blocks/About.tsx`
- Gallery: `site-engine/components/blocks/Gallery.tsx`
- Booking: `site-engine/components/blocks/Booking.tsx`
- Stats: `site-engine/components/blocks/Stats.tsx`
- Services: `site-engine/components/blocks/Services.tsx`
- Contact: `site-engine/components/blocks/Contact.tsx`

**Tipos e Contracts:**
- Types: `site-engine/lib/types.ts`
- Theme: `site-engine/lib/theme.ts`
- Design tokens: `site-engine/app/site-tokens.css`

---

**Documento compilado:** 2026-07-29  
**Status:** ✅ COMPLETO — Pronto para review de build & aprovação de roadmap  
**Próximo passo:** User aprova plano → Inicia Batch 1

---

## ★ PLANO CORRIGIDO — AUTORITATIVO (2026-07-29, supersede §7, §10, §11, §14–17)

> ⚠ As recomendações acima de "reutilizar blocos genéricos a 100%", "trocar Plus Jakarta Sans por Hanken" e "aproximar a paleta com o preset ink" foram **REJEITADAS pelo dono** — contradizem as decisões de 2026-07-23: **design pixel-IGUAL, blocos NOVOS reescritos em Tailwind (Modo B/transplante), e os blocos genéricos serão APAGADOS no fim**. As secções §2–6 (cores/tipografia/layout/páginas/UI) continuam válidas como matéria-prima, complementadas pelo `SPEC-VISUAL.md` (~1000 linhas, fichas detalhadas).

### Decisões fixas

1. **Catálogo novo `tifas`/barber** — cada secção do tifas vira um bloco/variante NOVO no engine, escrito em HTML+Tailwind no padrão do engine. Nada de mapear para os genéricos.
2. **Tokens com defaults = tifas**: accent default `#a51919` (maroon), superfícies dark (`#16161c`/`#0f0f14`/`#202028`), texto (`#d0d0da`/`#888896`); **Plus Jakarta Sans entra no set CURADO de fontes** e é o default destes blocos. O tenant pode mudar fonte/accent na Marca — o layout nunca muda.
3. **Funcionais por re-skin**: booking widget (3 passos), auth/conta, cancelar — mantêm a LÓGICA dos blocos/páginas funcionais do engine; só a pele é tifas.
4. **Genéricos apagados SÓ no batch final**, depois de os templates de arranque migrarem para o catálogo novo e de se verificar que nenhum `Site` na BD os referencia.
5. Regras de plataforma valem no port: alturas por flex (nunca `calc(100vh-x)` — o tifas usa `min-h-[calc(100vh-64px)]`, converter), conteúdo por `block.settings.content[locale]`, schemas editáveis em `blockCatalog.ts` (BO), a11y preservada.

### Batches (ordem de build)

- **T1 — Fundações + primeira dobra**: Plus Jakarta Sans no set curado + defaults de tema tifas; blocos `nav` e `footer` variante tifas; bloco `hero-split` tifas (esq.: badges/logo/título/tagline/stats/card de contacto+sociais; dir.: slot do booking com placeholder). Homepage estática pixel-igual.
- **T2 — Booking re-skin**: widget 3 passos (Serviço → Data+Hora → Confirmação, DayPicker+slots) com a lógica do bloco `booking` existente e a pele tifas; estados de erro/loading/sucesso.
- **T3 — Galeria + Sobre**: grid 9 fotos (aspect 1:1.15) + página sobre (foto 4:5, corpo, pills de especialidades).
- **T4 — Conta/funcionais**: dashboard do cliente (próximas marcações/histórico/perfil), auth modal (login/registo/recuperação), `/cancelar/:token`, privacidade — re-skin tifas das superfícies funcionais.
- **T5 — Movimento + schemas BO**: animações (fadeUp 0.55s/stagger 0–0.35s, fadeIn, slideDown), responsive fino (breakpoints do SPEC), `blockCatalog.ts` com schema de conteúdo para TODOS os blocos tifas (modo-conteúdo editável).
- **T6 — Sites na BD**: Site JSON do tenant tifas (semear — decidir script idempotente vs BO) + CMS import (as ~50 chaves existentes reaproveitam-se; template CSV no §8); site do GYM montado no engine; verificação visual lado-a-lado; template de arranque "barber" passa ao catálogo tifas.
- **T7 — Limpeza final**: remover os blocos genéricos (verificação de referências na BD primeiro) + docs (CLAUDE.md engine/BO) + redirect do host antigo (user/Coolify).

### Correções a claims do recon

- "Subdomínio tifas reclamado ✅ Confirmado" — **não verificável** a partir do código (é estado da BD de produção); tratar como PENDENTE até o dono confirmar.
- Estimativas "4 semanas" ignoradas — o ritmo é por batch verificado, como o resto da plataforma.
