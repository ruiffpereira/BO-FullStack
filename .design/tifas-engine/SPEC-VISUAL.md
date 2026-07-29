# TIFAS BARBER — Complete Site Inventory

**Data de Geração:** 2026-07-29  
**Stack:** Vite + React + TypeScript + Tailwind CSS + React Query  
**Estado:** Público (client-facing) — bilíngue PT/EN, PWA-ready  

---

## Índice
1. [Estrutura de Páginas](#estrutura-de-páginas)
2. [Componentes Visuais](#componentes-visuais)
3. [Paleta de Cores](#paleta-de-cores)
4. [Tipografia](#tipografia)
5. [Layout & Responsive](#layout--responsive)
6. [Animações & Efeitos](#animações--efeitos)
7. [Conteúdo (CMS Keys)](#conteúdo-cms-keys)
8. [Funcionalidades](#funcionalidades)

---

## Estrutura de Páginas

### 1. **HomePage** (`/`)
**Arquivo:** `src/pages/HomePage.jsx`  
**Layout:** Grid 2 colunas (desktop), stacked (mobile)  
**Rota:** URL raiz  

#### Hero Section (Esquerda)
- **Grid:** `lg:grid-cols-[1.1fr_1fr]`
- **Ordem:** `order-2 lg:order-1` (mobile stacked, topo direita; desktop esquerda)
- **Altura mínima:** `min-h-[calc(100vh-64px)]` (preenche viewport menos navbar de 64px)
- **Padding:** `px-6 sm:px-10 lg:px-16 py-10 lg:py-0`
- **Background:** `bg-cream` (paleta: `--bg` = RGB 22 22 28)
- **Decoração:** `.dot-grid` — grid subtil de pontos com gradient mask (fade top/bottom)

**Conteúdo:**
1. **Badge** — "Aberto agora" ou similar
   - Classes: `inline-flex items-center gap-2 px-3.5 py-1.5 bg-maroon/[0.1] border border-maroon/25 rounded-full text-xs font-semibold text-maroon tracking-wide`
   - Ícone: Ponto redondo vermelho (`w-1.5 h-1.5 rounded-full bg-maroon`)
   - Animação: `animate-fadeUp [animation-delay:.0s]`

2. **Logo + Título (H1)**
   - Logo: `src={t("hero.logo")}`, tamanho 80×80px, `object-contain`
   - Título quebrado em 2 linhas (primeiro espaço = quebra)
   - Primeira palavra: `text-navy` normal + negrura
   - Restantes palavras: `text-maroon italic font-bold`
   - Tamanho: `text-[clamp(30px,4.5vw,52px)]` (fluido 30–52px)
   - Espaçamento de linha: `leading-[1.02]` (apertado, aspecto "bold")
   - Animação: `animate-fadeUp [animation-delay:.05s]`

3. **Tagline (P)**
   - Texto: `t("hero.tagline")`
   - Tamanho: `text-[clamp(15px,1.6vw,17px)]` (fluido 15–17px)
   - Cor: `text-ink-soft` (gris-claro)
   - Animação: `animate-fadeUp [animation-delay:.15s]`

4. **Contact Card (address)**
   - Container: `bg-paper border border-line rounded-xl2 p-5 shadow-soft`
   - Espaçador de eyebrow: `w-8 h-0.5 bg-navy rounded-full`
   - Label: `text-[11px] font-bold tracking-[0.1em] uppercase text-navy`
   - Grid interior: `grid grid-cols-2 gap-3.5` (2 colunas)
   - Cada coluna:
     - Ícone+Label: `flex items-center gap-1.5 text-ink-faint text-[11px] font-semibold tracking-wider uppercase mb-1`
     - Conteúdo: `text-sm text-ink font-medium leading-snug`
   - Divisor: `h-px bg-line`
   - Rodapé com contacto + sociais:
     - Telefone: link `tel:` com ícone
     - Redes sociais: lista de 3 ícones SVG (Instagram, Facebook, WhatsApp) em botões 8×8 `rounded-lg` com hover de cor invertida
   - Animação: `animate-fadeUp [animation-delay:.25s]`

5. **Stats (DL)**
   - 3 linhas de estatísticas (valor + label)
   - Valor: `text-2xl font-extrabold text-navy tracking-tight`
   - Label: `block text-[11px] text-ink-faint font-semibold tracking-wider uppercase mt-0.5`
   - Container: `flex gap-8` com espaçamento generoso
   - Animação: `animate-fadeUp [animation-delay:.35s]`

#### Booking Widget (Direita)
- **Grid:** `order-1 lg:order-2`
- **Altura:** `flex flex-col justify-center`
- **Padding:** `px-5 sm:px-10 lg:px-12 py-7 lg:py-12`
- **Background:** `bg-cream-dark` (paleta: `--bg-alt` = RGB 15 15 20)

**Conteúdo:**
- Card com widget de agendamento (ver `BookingWidget.jsx`)
- Container: `w-full max-w-[480px] mx-auto bg-paper border border-line rounded-xl2 p-6 sm:p-7 shadow-lift animate-fadeUp [animation-delay:.1s]`
- Eyebrow + título H2 (style similar ao hero, mas menor)
- Widget dentro (3 passos multiuso)

---

### 2. **GalleryPage** (`/galeria`)
**Arquivo:** `src/pages/GalleryPage.jsx`  

**Layout:**
- Largura máxima: `max-w-5xl mx-auto`
- Padding: `px-5 sm:px-10 lg:px-16 py-10 lg:py-16`
- Altura mínima: `min-h-[calc(100vh-64px)]`

**Conteúdo:**
1. **Badge**: Style idêntico ao hero
2. **H1 Título**: `text-[clamp(30px,4.5vw,50px)] font-extrabold text-navy tracking-tight mb-3.5 leading-tight`
3. **Descrição**: `text-ink-soft text-base max-w-lg mb-9 leading-relaxed`
4. **Grid de fotos**: 
   - Grid: `grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3.5`
   - Cada item: `aspect-[1/1.15] bg-cream-dark rounded-xl2 border border-line overflow-hidden`
   - Imagem: `w-full h-full object-cover`
   - Aspect ratio: 1:1.15 (vertical, ligeiramente mais alto que largo)
   - Alt text: `t('galeria.alt_trabalho') ${i + 1}`

**Imagens (CMS):**
- 9 fotos de trabalhos
- URLs vêm de: `t('galeria.foto.1')`, `t('galeria.foto.2')`, ... `t('galeria.foto.9')`
- Dimensão natural esperada: 1000×1150px (aspect 1:1.15)
- Loading: `lazy`

---

### 3. **AboutPage** (`/sobre`)
**Arquivo:** `src/pages/AboutPage.jsx`  

**Layout:**
- Container: `max-w-4xl mx-auto`
- Grid: `grid md:grid-cols-2 gap-12 items-center`
- Padding: `px-5 sm:px-10 lg:px-16 py-10 lg:py-16`

**Esquerda — Foto:**
- Container: `aspect-[4/5] bg-cream-dark rounded-xl2 border border-line relative overflow-hidden flex flex-col items-center justify-center gap-2.5`
- Padrão diagonal: `[background-image:repeating-linear-gradient(135deg,transparent,transparent_18px,rgba(255,255,255,0.04)_18px,rgba(255,255,255,0.04)_36px)]`
- Imagem: `w-full h-full object-cover`
- Fonte: `t('sobre.foto')`
- Aspect ratio: 4:5 (retrato, 80% da largura)

**Direita — Conteúdo:**
1. **Badge**: Style standard
2. **H1 Título**: `text-[clamp(26px,4vw,40px)] font-extrabold text-navy tracking-tight mb-4 leading-tight`
3. **2× Parágrafos**: `text-ink-soft text-[15px] leading-relaxed mb-3.5` e `mb-6`
4. **Especialidades (Pills)**: 
   - Container: `flex gap-2.5 flex-wrap`
   - Cada pill: `px-3.5 py-1.5 rounded-full bg-navy/[0.08] text-navy text-xs font-semibold`
   - Limite 4 especialidades (de CMS: `sobre.especialidade.1` a `.4`)

---

### 4. **DashboardPage** (`/dashboard`) — Conta do Cliente
**Arquivo:** `src/pages/DashboardPage.jsx`  

**Layout:**
- Container principal: `min-h-[calc(100vh-64px)]`
- Header fixo: `bg-cream-dark border-b border-line px-5 sm:px-10 lg:px-16 py-7`
- Corpo: `max-w-4xl mx-auto px-5 sm:px-10 lg:px-16 py-7 lg:py-10`

**Secções:**

#### Header
- Botão voltar: `text-ink-faint text-[13px] font-medium mb-3.5 inline-flex items-center gap-1.5`
- H1: `text-[clamp(22px,3vw,32px)] font-extrabold text-navy tracking-tight`
- Subtítulo (email): `text-ink-faint text-[13px] mt-1`
- Botões direita: "Nova marcação" (primary) + "Sair" (surface)

#### Próximas Marcações
- Título: `text-xl font-bold text-navy`
- Badge de contagem: `inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase bg-emerald-500/15 text-emerald-600`
- Estado vazio: `bg-paper border-[1.5px] border-dashed border-line-strong rounded-xl2 py-10 px-6 text-center`
  - Emoji: `text-3xl mb-2.5 opacity-40` (📅)
  - Mensagem: `text-ink-faint mb-4 text-sm`
  - CTA: "Marcar agora" (primary, small)
- Lista de BookingCards: `flex flex-col gap-2.5` (ver componente)

#### Histórico
- Título: `text-xl font-bold text-navy mb-1.5`
- Contador: `text-ink-faint text-[13px] mb-4`
- Lista de BookingCards (com `isPast` = true, sem botões de ação)

#### Dados da Conta
- Card: `bg-paper border border-line rounded-xl2 p-6`
- Modo visualização: Grid 4 colunas de labels/valores (`grid-cols-[repeat(auto-fit,minmax(170px,1fr))]`)
- Modo edição: Form com 4 campos (nome, email, telemóvel, NIF) em 2×2 grid
  - Fields: `flex flex-col gap-1.5` cada
  - Toggle "Fatura com NIF": Switch custom (9 linhas de código, animado)

#### Modal de Cancelamento
- Overlay: `fixed inset-0 bg-black/60 flex items-center justify-center z-[9000] p-4`
- Dialog: `bg-paper rounded-2xl p-6 max-w-sm w-full shadow-lift border border-line`
- Focus trap + Escape handling

---

### 5. **PrivacyPage** (`/privacidade`)
**Arquivo:** `src/pages/PrivacyPage.jsx`  

**Layout:**
- Container: `max-w-3xl mx-auto`
- Padding: `px-5 sm:px-10 lg:px-16 py-10 lg:py-16`

**Conteúdo:**
- H1: `text-[clamp(26px,4vw,40px)] font-extrabold text-navy tracking-tight mb-2 leading-tight`
- Data atualização: `text-ink-faint text-[13px] mb-8`
- Corpo em 2 modos:
  1. **Custom (CMS)**: `dangerouslySetInnerHTML` com HTML sanitizado
     - Estilos inline via Tailwind classes: `[&_h2]`, `[&_a]`, `[&_ul]`, `[&_li]`
  2. **Default (fallback)**: 10 secções HTML estruturadas em `<Section>` components

---

### 6. **CancelPage** (`/cancel/:token`)
**Arquivo:** `src/pages/CancelPage.jsx`  

**Layout:**
- Container: `min-h-screen bg-cream flex items-center justify-center px-4 py-16`
- Card: `w-full max-w-md`

**Conteúdo:**
- Centro: Emoji 💈 grande
- Título: `text-2xl font-bold text-navy tracking-tight`
- Card: `bg-paper border border-line rounded-2xl p-6 shadow-soft`
- 3 estados:
  1. **Loading**: Spinner + mensagem
  2. **Error**: Mensagem de erro vermelha
  3. **Appointment Details**: 4 linhas (serviço, data, hora, preço) + status
  4. **Success**: Checkmark verde + mensagem

---

## Componentes Visuais

### 1. **BookingWidget** (`src/components/BookingWidget.jsx`)
**Uso:** Widget principal de agendamento (home page + futura integração em outros pontos)

**Props:**
- `user`: User object (autenticado ou null)
- `onRequireLogin`: Callback para exigir login
- `onBooked`: Callback após sucesso

**3 Passos:**

#### Passo 1 — Serviço
- Lista scrollável de serviços ativos (`max-h-[calc(100dvh-26rem)] overflow-y-auto`)
- Cada serviço é um botão:
  - Não ativo: `bg-paper border-line hover:border-line-strong`
  - Ativo: `bg-electric border-electric text-white`
  - Conteúdo: Emoji (✂️) + nome + duração (min) + preço (€)
  - Classes: `flex items-center gap-3 p-3 rounded-[10px] border-[1.5px] text-left w-full`

#### Passo 2 — Data e Hora
**Data:**
- Atalhos de 3 dias rápidos (próximos dias úteis)
  - Cada dia: botão 3-linhas (dia da semana, número, mês)
  - Classes: `flex-1 py-2 rounded-[10px] border-[1.5px]`
  - Estados: ativo (electric) vs inativo (paper)
- Botão calendário (ícone SVG)
  - Abre DayPicker (react-day-picker) via portal em mobile, dropdown em desktop
  - Desativa fins de semana e datas passadas
- Data selecionada fora de atalhos mostra `(X)` para remover

**Hora:**
- Grid de slots: `grid grid-cols-[repeat(auto-fill,minmax(68px,1fr))] gap-1.5`
- Cada slot é um botão pequeno (`py-2.5 px-1`)
- Estados: ativo (electric) vs inativo (paper)

#### Passo 3 — Confirmação
- Summary card: `bg-paper rounded-[10px] p-4 border border-line mb-3.5`
  - Preço no topo: `text-lg font-bold text-navy`
  - Linhas: serviço, data, hora, cliente
  - Style: 2-coluna (label + valor)
- Textarea para notas: `placeholder={t("ui.notas.placeholder")}`
- Botões: Voltar (ghost) + Confirmar (primary)

**Animações:**
- Fade-in suave entre passos: `animate-fadeUp`
- Indicadores de passo com linha de progresso

---

### 2. **BookingCard** (`src/components/BookingCard.jsx`)
**Uso:** Exibição de uma marcação (lista no dashboard)

**Props:**
- `booking`: Objeto normalizado com `{id, serviceName, servicePrice, date, time, status, cancelToken, notes, barberName, duration}`
- `isPast`: Boolean (sem botões de ação se true ou status cancelado)
- `onEdit`: Callback (futuro)
- `onCancel`: Callback

**Layout:** Linha horizontal `bg-paper border border-line rounded-xl2 px-5 py-4`
- Esquerda: Emoji 💈 (11×11 bg-cream-dark) + conteúdo
  - Serviço + status badge
  - Data · Hora (linha)
  - Nome do barbeiro
  - Notas em itálico (se houver)
  - "Adicionar ao calendário" (link compacto)
- Direita: Preço (large navy bold) + botões (Editar, Cancelar)

**Status Badges:**
- `confirmed`: `bg-emerald-500/15 text-emerald-600`
- `pending`: `bg-amber-500/15 text-amber-600`
- `completed`: `bg-ink/8 text-ink-soft`
- `cancelled`: `bg-maroon/12 text-maroon`

**Efeito:** Opacity 60% se cancelada

---

### 3. **Navbar** (`src/components/Navbar.jsx`)
**Layout em 2 partes:**

#### Top Bar
- Altura: `h-16` (64px)
- Fundo: `bg-cream-dark border-b border-line-strong`
- Sticky em desktop: `lg:sticky lg:top-0 z-[900]`

**Conteúdo:**
1. **Logo** (esquerda)
   - Botão com logo + texto do negócio
   - Logo: `h-11 w-11 object-contain`
   - Texto em 2 linhas:
     - Segundas palavras do título (maiúsculas)
     - Primeira palavra (maiúsculas, maroon, tracking maior, `text-[9px]`)

2. **Desktop Nav** (centro, `hidden lg:flex`)
   - LanguageSwitcher + 3 links (Início, Trabalhos, Sobre)
   - Estilos de ativa: `text-electric font-semibold` + underline (transform: scaleX)
   - Se autenticado: Botões "Conta" + "Sair"
   - Se não autenticado: Botão "Entrar"

3. **Mobile Top Right**
   - LanguageSwitcher
   - Se autenticado: Ícone de conta (UserIcon)
   - Se não autenticado: Botão "Entrar" (inline, maroon)

#### Bottom Nav (Mobile/Tablet)
- Altura: `h-16` (64px)
- Fixo no rodapé: `fixed bottom-0 left-0 right-0`
- Fundo: `bg-cream-dark border-t border-line`
- Safe-area inset para notches

**Itens:**
- 3 nav items (Início, Trabalhos, Sobre) com ícones + labels
- Conta / Entrar (dinâmico)
- Instalar PWA (se aplicável, ícone especial)
  - iOS: tooltip com instruções (⎙ Partilhar > "Adicionar ao Ecã")
  - Android: direct install trigger

**Ícones SVG Custom:**
- HomeIcon, GridIcon, InfoIcon, UserIcon, LoginIcon, InstallIcon
- Stroke width dinâmica por estado (ativo: 2.2, inativo: 1.8)

---

### 4. **AuthModal** (`src/components/AuthModal.jsx`)
**Uso:** Modal de autenticação (login, registo, recuperação de password)

**Modos:**
1. **Login**
   - Botão Google (desativado)
   - Email + Password
   - Link "Esqueceu password?" (switch para forgot)
   - Link "Não tem conta? Registar"

2. **Register**
   - Botão Google (desativado)
   - Nome + Telemóvel + Email + Password
   - Link "Já tem conta? Entrar"

3. **Forgot (Recuperação)**
   - Email
   - Após sucesso: mensagem com emoji ✉️ + instruções

4. **Reset (Redefinição)**
   - Nova password + Confirmação
   - Via token no URL

**Formulário Padrão:**
- Fields com Labels (uppercase, small)
- Input/Textarea com focus states
- Erros em banner vermelho/maroon
- Buttons: Primary (submit) + Ghost (switch)

**Validação:**
- Zod schemas (loginFormSchema, registerFormSchema, etc.)
- firstZodError() extrai primeira mensagem

---

### 5. **UI Components** (`src/components/ui.jsx`)

#### Button
- **Variantes:**
  - `primary`: maroon + white, shadow
  - `accent`: electric + white, shadow
  - `ghost`: transparent, navy border, hover navy/10
  - `surface`: paper bg, border, hover cream-dark
  - `danger`: maroon/10 bg, maroon text, maroon/25 border
- **Tamanhos:**
  - `sm`: `px-4 py-2 text-[13px] rounded-lg`
  - `md` (default): `px-6 py-3 text-sm rounded-[10px]`
- **Estados:**
  - Disabled: opacity-40, cursor-not-allowed
  - Hover: translate-y -1px (lift effect)
- **Classes base:** `inline-flex items-center justify-center gap-2 font-semibold tracking-tight transition-all duration-200`

#### Spinner
- SVG de anel rotatório
- Classes: `.spinner` (border branco)
- Variante dark: `.spinner-dark` (border primary-clear)
- Animação: `@keyframes spin` 360° em 0.7s

#### Modal
- **Overlay:** `fixed inset-0 z-[1000] bg-black/70 backdrop-blur-sm`
- **Dialog:** `bg-paper border border-line rounded-xl2 shadow-lift`
- **Header:** `flex items-center justify-between px-6 pt-5 pb-4 border-b border-line`
  - Título: `text-[19px] font-bold text-navy tracking-tight`
  - Botão fechar: `w-8 h-8 rounded-full border border-line`
- **Corpo:** `px-6 py-5`
- **Focus Trap:** Esc fecha, Tab recicla dentro do modal
- **Max width:** `max-w-md` (configurável via prop)

#### Label
- Style: `text-[11px] tracking-wider uppercase text-ink-faint font-semibold`
- Link com `htmlFor`

#### Input
- Style: `w-full bg-paper border-[1.5px] border-line rounded-[10px] text-sm px-3.5 py-2.5`
- Focus: `border-electric` (cor accent)
- Placeholder: `text-ink-faint`

#### Textarea
- Style base igual ao Input
- `resize-y min-h-[70px]`

---

## Paleta de Cores

**Fonte primária:** CSS variables em `src/index.css` (RGB channels)

### Cores Principais

| Variável | RGB (Channels) | HEX | Propósito |
|----------|---|---|---|
| `--bg` | 22 22 28 | #16161c | Fundo principal (grafite frio) |
| `--bg-alt` | 15 15 20 | #0f0f14 | Fundo secundário (mais profundo) |
| `--surface` | 32 32 40 | #202028 | Cards, widgets (elevado) |
| `--ink` | 208 208 218 | #d0d0da | Texto principal (quase branco) |
| `--ink-soft` | 136 136 150 | #888896 | Texto secundário (médio) |
| `--ink-faint` | 135 135 153 | #878799 | Texto terciário (subtil, WCAG AA min) |
| `--primary` | 230 230 242 | #e6e6f2 | Headings (claro frio) |
| `--primary-dk` | 248 248 255 | #f8f8ff | Headings bright (muito claro) |
| `--primary-lt` | 178 178 196 | #b2b2c4 | Headings light (suave) |
| `--red` | 165 25 25 | #a51919 | Vermelho escuro (accent, CTAs) |
| `--red-dk` | 128 16 16 | #801010 | Vermelho hover (mais fundo) |
| `--red-lt` | 190 35 35 | #be2323 | Vermelho hover (mais claro) |
| `--blue` | 212 40 40 | #d42828 | Accent secundário (igual ao red) |
| `--blue-dk` | 176 30 30 | #b01e1e | Variante dark |
| `--blue-lt` | 232 64 64 | #e84040 | Variante light |
| `--line` | 200 200 200 | #c8c8c8 | Bordas (opacidade: 9% default, 16% strong) |
| `--silver` | 52 52 64 | #343440 | Muted, scrollbar |

### Aliases Tailwind

**Mapeamento CSS Variables → Tailwind:**

```js
cream: {
  DEFAULT: 'rgb(var(--bg) / <alpha-value>)',       // 22 22 28
  dark:    'rgb(var(--bg-alt) / <alpha-value>)',   // 15 15 20
}
paper: 'rgb(var(--surface) / <alpha-value>)',      // 32 32 40
navy: {
  DEFAULT: 'rgb(var(--primary) / <alpha-value>)',  // 230 230 242
  dark:    'rgb(var(--primary-dk) / <alpha-value>)',
  light:   'rgb(var(--primary-lt) / <alpha-value>)',
}
maroon: {
  DEFAULT: 'rgb(var(--red) / <alpha-value>)',      // 165 25 25
  dark:    'rgb(var(--red-dk) / <alpha-value>)',
  light:   'rgb(var(--red-lt) / <alpha-value>)',
}
electric: {
  DEFAULT: 'rgb(var(--blue) / <alpha-value>)',     // 212 40 40
  dark:    'rgb(var(--blue-dk) / <alpha-value>)',
  light:   'rgb(var(--blue-lt) / <alpha-value>)',
}
silver: 'rgb(var(--silver) / <alpha-value>)',      // 52 52 64
ink: {
  DEFAULT: 'rgb(var(--ink) / <alpha-value>)',
  soft:    'rgb(var(--ink-soft) / <alpha-value>)',
  faint:   'rgb(var(--ink-faint) / <alpha-value>)',
}
line: {
  DEFAULT: 'rgb(var(--line) / 0.09)',              // opacidade fixa 9%
  strong:  'rgb(var(--line) / 0.16)',              // opacidade fixa 16%
}
```

**Tema:** Dark mode nativo (fundo escuro, texto claro)  
**Acessibilidade:** Cores respeitam WCAG AA mínimo (4.5:1 contraste)

---

## Tipografia

### Fonte Principal
- **Family:** 'Plus Jakarta Sans' (Google Fonts ou system-ui fallback)
- **Peso:** 400 (regular), 500 (medium), 600 (semibold), 700 (bold), 800 (extrabold)
- **Smoothing:** `-webkit-font-smoothing: antialiased`

### Tamanhos Fluidos (Clamp)

| Contexto | Clamp | Min–Max | Uso |
|----------|-------|---------|-----|
| Hero H1 | `clamp(30px, 4.5vw, 52px)` | 30–52px | Título principal |
| Hero tagline | `clamp(15px, 1.6vw, 17px)` | 15–17px | Tagline |
| Page H1 (Gallery, About, Privacy) | `clamp(26px–30px, 4vw, 40px–50px)` | Varia | Títulos de página |
| Dashboard H1 | `clamp(22px, 3vw, 32px)` | 22–32px | Greeting no dashboard |

### Tamanhos Fixos

| Classe | Tamanho | Peso | Contexto |
|--------|---------|------|----------|
| `text-xs` | 12px | — | Pequenos labels, hints |
| `text-[10px]` | 10px | 600–700 | Badge de contagem |
| `text-[11px]` | 11px | 600–700 | Eyebrow, labels uppercase |
| `text-[12px]` | 12px | — | Feedback text, secondary |
| `text-[13px]` | 13px | 400–600 | Body text, form fields, help |
| `text-sm` | 14px | 400–600 | Button text, standard form |
| `text-[15px]` | 15px | 400–600 | Descrições de seção |
| `text-[15.5px]` | 15.5px | — | Detalhe dentro de cards |
| `text-[17px]` | 17px | — | Tagline max |
| `text-base` | 16px | 400–600 | Padrão body |
| `text-lg` | 18px | 700 | Subtítulo de card |
| `text-[19px]` | 19px | 700 | Modal title |
| `text-xl` | 20px | 700 | Seção heading (dashboard) |
| `text-2xl` | 24px | 700 | Stat value, Cancel page title |
| `text-3xl` | 30px | 700 | Large emoji |

### Font Weight Mapping

```
font-medium     → 500 (inputs, secondary labels)
font-semibold   → 600 (eyebrows, badges, button labels)
font-bold       → 700 (headings, values, titles)
font-extrabold  → 800 (hero titles, key values)
```

### Letter Spacing

| Classe | Valor | Contexto |
|--------|-------|----------|
| `tracking-tight` | -0.015em | Headings (compactos) |
| `tracking-wide` | 0.025em | Labels, badges (uppercase) |
| `tracking-[0.1em]` | 0.1em | Eyebrow labels (muito espaçado) |
| `tracking-[0.25em]` | 0.25em | "TIAGO" em navbar (máximo espaçamento) |

### Line Height

| Classe | Valor | Contexto |
|--------|-------|----------|
| `leading-none` | 1 | Botões, badges |
| `leading-snug` | 1.375 | Contacto dentro de card |
| `leading-relaxed` | 1.625 | Parágrafos, descrições |
| `leading-tight` | 1.25 | Headings |
| `leading-[1.02]` | 1.02 | Hero title (muito compacto) |

---

## Layout & Responsive

### Breakpoints (Tailwind Default)

| Breakpoint | Classe | Valor | Uso |
|----------|--------|-------|-----|
| Mobile | nenhum | 0–640px | Default (mobile-first) |
| Tablet | `sm:` | 640px+ | Alguns ajustes |
| Desktop | `lg:` | 1024px+ | Mudanças estruturais (grids) |

### Padding/Margin Padrão

**Horizontal (páginas):**
- Mobile: `px-5` (20px)
- Tablet: `px-10` (40px)
- Desktop: `px-16` (64px)

**Vertical (seções):**
- Padrão: `py-10 lg:py-16`

### Grid Layouts

#### Hero (HomePage)
```
Desktop: lg:grid-cols-[1.1fr_1fr]
Mobile: stacked com order-2/order-1 (booking topo)
```

#### Gallery Grid
```
grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3.5
Responsivo: min-width 220px, expande conforme espaço
```

#### About
```
md:grid-cols-2 gap-12 items-center
Mobile: stacked
```

#### Dashboard Grids
- Próximas/Histórico: Coluna única de cards
- Dados da conta: `grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3.5`

### Heights

**Min-heights padrão:**
- Páginas completas: `min-h-[calc(100vh-64px)]` (viewport menos navbar)
- Cards: Auto (content-driven)

**Alturas fixas:**
- Navbar: `h-16` (64px)
- Botões sm: Implícito em `py-2`
- Botões md: Implícito em `py-3`

### Overflow & Scrolling

- Página (global): Normal flow, scrolls naturally
- Booking Widget (passo 1): `max-h-[calc(100dvh-26rem)] overflow-y-auto` (serviços rolam)
- Booking Widget (passo 2, slots): `md:h-[148px] md:max-h-none` (altura fixa em desktop)
- Modal: `max-h-[90vh] overflow-y-auto`
- Mobile bottom nav: `safe-area-inset-bottom` (respeita notches)

---

## Animações & Efeitos

### Keyframes Customizadas

```css
fadeUp: {
  0%: { opacity: 0, transform: 'translateY(16px)' }
  100%: { opacity: 1, transform: 'translateY(0)' }
}
Duration: 0.55s, timing: ease, fill: both

fadeIn: {
  0%: { opacity: 0 }
  100%: { opacity: 1 }
}
Duration: 0.35s, timing: ease, fill: both

slideDown: {
  0%: { opacity: 0, transform: 'translateY(-6px)' }
  100%: { opacity: 1, transform: 'translateY(0)' }
}
Duration: 0.2s, timing: ease, fill: both

pageLoad (progress bar):
  0%: { width: 0% }
  80%: { width: 70% }
  100%: { width: 100% }
Duration: 0.4s, timing: ease-out
```

### Uso das Animações

| Elemento | Animação | Delay |
|----------|----------|-------|
| Hero badge | fadeUp | 0s |
| Hero logo+title | fadeUp | 0.05s |
| Hero tagline | fadeUp | 0.15s |
| Hero contact card | fadeUp | 0.25s |
| Hero stats | fadeUp | 0.35s |
| Booking widget card | fadeUp | 0.1s |
| Passo 1, 2, 3 (widget) | fadeUp | — |
| Sucesso widget | fadeUp | — |
| Modal backdrop | fadeIn | — |
| Modal conteúdo | fadeUp | — |
| Calendar portal | fadeIn + fadeUp | — |

### Efeitos de Hover

- **Botões:** `-translate-y-px` (lift 1px)
- **Cards:** `hover:border-line-strong hover:shadow-soft`
- **Links:** `hover:text-navy transition-colors`
- **Icons (active):** Stroke width 2.2 vs 1.8 (inativo)

### Shadows

| Classe | Valor |
|--------|-------|
| `shadow-soft` | `0 4px 20px rgba(8,8,18,0.45)` |
| `shadow-lift` | `0 16px 48px rgba(8,8,18,0.65)` |

---

## Conteúdo (CMS Keys)

**Contexto:** `website` (principal)  
**Idiomas:** PT (padrão) + EN (dinâmico via LanguageSwitcher)

### Hero (HomePage)

| Chave | Tipo | Descrição |
|-------|------|-----------|
| `hero.logo` | image | URL do logótipo (80×80) |
| `hero.titulo` | text | Nome do negócio (ex: "Tiago Barbeiro") — primeiro espaço quebra em 2 linhas |
| `hero.badge` | text | Badge status (ex: "Aberto agora") |
| `hero.tagline` | text | Frase breve (ex: "Cortes à medida, estilo sem compromisso") |
| `hero.stat1.valor` | text | Número (ex: "15+") |
| `hero.stat1.label` | text | Descrição (ex: "Anos de Experiência") |
| `hero.stat2.valor` | text | Número |
| `hero.stat2.label` | text | Descrição |
| `hero.stat3.valor` | text | Número |
| `hero.stat3.label` | text | Descrição |
| `home.contacto.titulo` | text | Eyebrow (ex: "Localização & Horário") |
| `home.contacto.morada.label` | text | Label (ex: "Morada") |
| `home.contacto.horario.label` | text | Label (ex: "Horário") |
| `home.booking.eyebrow` | text | Eyebrow (ex: "Marcar online") |
| `home.booking.titulo` | text | Título (ex: "Marcar") |
| `home.booking.subtitulo` | text | Subtítulo (ex: "a sua próxima sessão") |

### Contacto

| Chave | Tipo |
|-------|------|
| `contacto.morada1` | text |
| `contacto.morada2` | text |
| `contacto.mapa_url` | url (Google Maps) |
| `contacto.horario.dias` | text |
| `contacto.horario.manha` | text |
| `contacto.horario.tarde` | text |
| `contacto.telefone` | text |
| `contacto.telefone.href` | data (digits only, ex: "911234567") |
| `contacto.email` | email |

### Redes Sociais

| Chave | Tipo |
|-------|------|
| `redes.instagram` | url |
| `redes.facebook` | url |
| `redes.whatsapp` | url |

### Gallery

| Chave | Tipo | Descrição |
|-------|------|-----------|
| `galeria.label` | text | Badge label |
| `galeria.titulo` | text | Página title |
| `galeria.descricao` | text | Paragraph |
| `galeria.alt_trabalho` | text | Alt text base (sufixo: " 1", " 2", etc.) |
| `galeria.foto.1` – `.9` | image | URLs das 9 fotos |

### About

| Chave | Tipo |
|-------|------|
| `sobre.label` | text |
| `sobre.titulo` | text |
| `sobre.foto` | image |
| `sobre.corpo1` | text |
| `sobre.corpo2` | text |
| `sobre.especialidade.1` – `.4` | text |

### Booking Widget

| Chave | Tipo |
|-------|------|
| `booking.passo.1` | text |
| `booking.passo.2` | text |
| `booking.passo.3` | text |
| `booking.resumo.titulo` | text |
| `booking.resumo.servico` | text |
| `booking.resumo.data` | text |
| `booking.resumo.hora` | text |
| `booking.resumo.cliente` | text |
| `booking.confirmar` | text |
| `booking.sucesso.titulo` | text |
| `booking.sucesso.mensagem` | text |
| `booking.sucesso.ver` | text |
| `booking.sucesso.nova` | text |
| `booking.data.outra` | text (title do botão calendário) |
| `booking.sem_data` | text (alerta) |
| `booking.sem_horarios` | text (alerta) |

### Dashboard

| Chave | Tipo |
|-------|------|
| `dashboard.ola` | text |
| `dashboard.nova_marcacao` | text |
| `dashboard.proximas.titulo` | text |
| `dashboard.proximas.label` | text |
| `dashboard.nenhuma` | text |
| `dashboard.pode_cancelar` | text |
| `dashboard.carregando` | text |
| `dashboard.erro` | text |
| `dashboard.erro.reload` | text |
| `dashboard.sem_marcacoes` | text |
| `dashboard.marcar_agora` | text |
| `dashboard.historico.titulo` | text |
| `dashboard.historico.carregando` | text |
| `dashboard.historico.contagem` | text |
| `dashboard.conta.titulo` | text |
| `dashboard.sucesso` | text |
| `dashboard.cancelar_dialog.titulo` | text |
| `dashboard.cancelar_dialog.texto` | text |
| `dashboard.cancelar_dialog.sim` | text |
| `dashboard.cancelar_dialog.nao` | text |
| `dashboard.contribuinte.label` | text |
| `dashboard.contribuinte.hint` | text |

### Privacy

| Chave | Tipo |
|-------|------|
| `privacy.title` | text |
| `privacy.updated_label` | text |
| `privacy.updated` | text |
| `privacy.content` | richtext (opcional; se vazio, usa default) |

### Cancelamento

| Chave | Tipo |
|-------|------|
| `cancel.titulo` | text |
| `cancel.confirmar_texto` | text |
| `cancel.confirmar_btn` | text |
| `cancel.ja_cancelada` | text |
| `cancel.ja_concluida` | text |
| `cancel.nao_encontrada` | text |
| `cancel.nao_encontrada.mensagem` | text |
| `cancel.erro` | text |
| `cancel.sucesso.titulo` | text |
| `cancel.sucesso.mensagem` | text |

### UI Geral

| Chave | Tipo |
|-------|------|
| `ui.entrar` | text |
| `ui.sair` | text |
| `ui.nome` | text |
| `ui.email` | text |
| `ui.telemovel` | text |
| `ui.nif` | text |
| `ui.data` | text |
| `ui.hora` | text |
| `ui.servico` | text |
| `ui.preco` | text |
| `ui.estado` | text |
| `ui.voltar` | text |
| `ui.continuar` | text |
| `ui.cancelar` | text |
| `ui.editar` | text |
| `ui.guardar` | text |
| `ui.a_carregar` | text |
| `ui.a_guardar` | text |
| `ui.a_processar` | text |
| `ui.a_cancelar` | text |
| `ui.notas_opcional` | text |
| `ui.notas.placeholder` | text |
| `ui.sim` | text |
| `ui.nao` | text |
| `ui.status.pendente` | text |
| `ui.status.confirmada` | text |
| `ui.status.concluida` | text |
| `ui.status.cancelada` | text |

### Navegação

| Chave | Tipo |
|-------|------|
| `nav.inicio` | text |
| `nav.trabalhos` | text |
| `nav.sobre` | text |
| `nav.conta` | text |
| `nav.instalar` | text |
| `nav.instalar.titulo` | text |
| `nav.instalar.ios.partilhar` | text |
| `nav.instalar.ios.ecra` | text |

### PWA

| Chave | Tipo |
|-------|------|
| `pwa.ios.texto_pre` | text |
| `pwa.ios.texto_mid` | text |

### Autenticação

| Chave | Tipo |
|-------|------|
| `auth.login.titulo` | text |
| `auth.register.titulo` | text |
| `auth.forgot.titulo` | text |
| `auth.reset.titulo` | text |
| `auth.google` | text |
| `auth.ou` | text |
| `auth.email.placeholder` | text |
| `auth.password.label` | text |
| `auth.password.placeholder` | text |
| `auth.esqueceu` | text |
| `auth.sem_conta` | text |
| `auth.registar` | text |
| `auth.nome.placeholder` | text |
| `auth.telemovel.placeholder` | text |
| `auth.ja_tem_conta` | text |
| `auth.entra` | text |
| `auth.criar_conta` | text |
| `auth.email_enviado.titulo` | text |
| `auth.email_enviado.mensagem` | text |
| `auth.voltar_login` | text |
| `auth.erro.credenciais` | text |
| `auth.erro.token` | text |
| `auth.erro.email_registado` | text |
| `auth.erro.dados` | text |
| `auth.erro.generico` | text |

---

## Funcionalidades

### 1. **Autenticação**
- Login/Registo via email+password (API `/api/customers/login`, `/api/customers/register`)
- Recuperação de password (token via email)
- Refresh automático de JWT (cookie httpOnly)
- Context: `AuthContext.jsx` (useAuth hook)

### 2. **Marcações de Serviço (Booking)**
- Widget 3-passos: Serviço → Data+Hora → Confirmação
- APIs:
  - `GET /api/websites/booking/services?locale=` (lista de serviços)
  - `GET /api/websites/booking/slots?date=&serviceId=` (horários disponíveis)
  - `POST /api/websites/booking/appointments` (criar marcação)
  - `GET /api/websites/booking/my-appointments?status=` (minhas marcações — logado)
  - `PATCH /api/websites/booking/appointments/:cancelToken/cancel` (cancelar)
  - `GET /api/websites/booking/appointments/:token` (info pública via token)

### 3. **Calendário (iCal)**
- Subscrever marcação no calendário do telemóvel (feed .ics)
- Link gerado no sucesso do booking + no card da marcação
- Componente: `AddToCalendar.jsx`

### 4. **CMS Multilíngua**
- Contexto: `website`
- Todas as strings UI carregam do CMS
- Fallback PT se chave não existir
- Suporta 18+ idiomas (i18n via react-i18next ou similar)
- LanguageSwitcher: Combobox de bandeiras

### 5. **PWA (Progressive Web App)**
- Instalação on-home-screen (Android + iOS)
- Service worker (Workbox)
- Bottom nav com botão de instalação (iOS mostra tooltip)
- Manifesto: `public/manifest.json`

### 6. **Responsivo & Acessibilidade**
- Mobile-first design
- WCAG AA compliance (cores, ratios, labels)
- Focus visible (anel 2px, offset 3px)
- Skip-link (foco visível ao teclado)
- Aria labels, roles, live regions
- Focus trap em modais
- Keyboard navigation (Tab, Shift+Tab, Escape)

### 7. **Cookies & Consent**
- Banner de cookies (componente `CookieConsent.jsx`)
- Essenciais apenas (sem Google Analytics)
- Plausible stats sem cookies (auto-hospedado, anónimo)

---

## Ficheiros Estrutura

```
tifas-barber/
├── src/
│   ├── pages/
│   │   ├── HomePage.jsx
│   │   ├── GalleryPage.jsx
│   │   ├── AboutPage.jsx
│   │   ├── DashboardPage.jsx
│   │   ├── PrivacyPage.jsx
│   │   └── CancelPage.jsx
│   ├── components/
│   │   ├── Navbar.jsx
│   │   ├── BookingWidget.jsx
│   │   ├── BookingCard.jsx
│   │   ├── AuthModal.jsx
│   │   ├── AddToCalendar.jsx
│   │   ├── LanguageSwitcher.jsx
│   │   ├── CookieConsent.jsx
│   │   ├── PwaInstallBanner.jsx
│   │   ├── EditModal.jsx
│   │   └── ui.jsx
│   ├── context/
│   │   ├── CmsContext.jsx
│   │   ├── LanguageContext.jsx
│   │   └── (via App.jsx setup)
│   ├── hooks/
│   │   ├── usePwaInstall.js
│   │   └── (outros hooks customizados)
│   ├── lib/
│   │   ├── formSchemas.ts (Zod)
│   │   └── (utilitários)
│   ├── servers/
│   │   └── booking/
│   │       ├── index.ts (Kubb exports)
│   │       └── hooks/ (React Query hooks Kubb-generated)
│   ├── utils.js (fmtDate, langToLocale, nextWorkdays, etc.)
│   ├── storage.js (localStorage helpers)
│   ├── AuthContext.jsx (useAuth hook)
│   ├── data.js (configuração estática)
│   ├── index.css (estilos global + paleta CSS vars)
│   ├── main.jsx (entry point)
│   └── App.jsx (router setup, Shell layout)
├── tailwind.config.js (extends cores, radius, shadows, animations)
├── vite.config.js (React plugin, PWA plugin)
├── postcss.config.js (Tailwind)
├── tsconfig.json (TypeScript)
├── kubb.config.ts (Geração de hooks/types a partir de OpenAPI)
├── spec.*.json (OpenAPI specs: booking, customers, content)
├── package.json (dependências)
├── public/
│   ├── manifest.json (PWA metadata)
│   ├── sw.js (Service Worker)
│   └── icons/ (PWA icons)
└── .env (local, gitignored)
```

---

## Notas Importantes

1. **Sem Google Analytics** — Privacidade RGPD. Apenas Plausible anónimo.
2. **CMS-first UI** — Todas as strings cliente-facing vêm do CMS, não hardcoded.
3. **Upload diferido** — Booking widget não carrega fotos; só dados (API makes requests).
4. **Focus management** — Modais e widget steps fazem focus trap + announce states.
5. **Animações suaves** — Todas com `animate-fadeUp` ou `fadeIn`, delays decrescentes.
6. **Paleta editável** — Mudar `--bg`, `--red`, etc. em `index.css` recompila tudo.
7. **Responsive fluid** — Títulos com `clamp()`, sem media queries rígidas.
8. **Multilíngua real** — LanguageSwitcher carrega locales react-day-picker dinamicamente (lazy import).
9. **PWA iOS-aware** — Bottom nav mostra tooltip especial com instruções de instalação.

---

**Fim do Inventário.**
