# Backoffice — React + Vite + TailwindCSS

Backoffice multi-negócio com sistema de **componentes → permissões**. Suporta vários tipos de cliente (ex.: barbearia e loja online) e adapta os menus e o dashboard às permissões de cada conta.

## Módulos

- **Dashboard** — KPIs e gráficos que se adaptam à permissão ativa (vendas, cortes, encomendas, etc.)
- **Clientes** — clientes finais do negócio; ficha detalhada (visitas vs. encomendas conforme a permissão), bloquear/desbloquear
- **Loja** — produtos (imagem, stock, categorias, preço), criar/editar, e encomendas
- **Agenda** — submenu com:
  - **Calendário** semanal — clica num espaço livre para criar marcação; faixa de almoço; dias bloqueados continuam marcáveis
  - **Horário & Pausas** — horas de abertura e pausa de almoço por dia
  - **Férias & Bloqueios** — bloquear datas (férias, feriados, bloqueio pontual)
  - Serviços (nome, duração, preço), confirmar/cancelar marcações, bloquear clientes
- **Admin** — criar contas de clientes, gerir **permissões** (e os componentes a que dão acesso) e criar **componentes** (com "Nome na BD" / chave enviada)

Funcionalidades transversais: **login** (user + password, com atalhos de perfil para demo), **tema claro/escuro**, **"Ver como"** (pré-visualizar qualquer permissão), e layout **responsivo** (desktop → tablet → mobile com sidebar em drawer).

## Como correr

Requer [Node.js](https://nodejs.org/) 18+ instalado.

```bash
# 1. Instalar dependências
npm install

# 2. Servidor de desenvolvimento (abre em http://localhost:5173)
npm run dev

# 3. Build de produção (gera a pasta dist/)
npm run build

# 4. Pré-visualizar o build
npm run preview
```

## Stack

- **React 18** + **Vite 5**
- **TailwindCSS 3** (config em `tailwind.config.js`)
- Tipografia: **Hanken Grotesk** (Google Fonts)
- Sem dependências de UI externas — todos os componentes, ícones (SVG) e gráficos são próprios

## Estrutura

```
src/
  main.jsx          Entry point
  App.jsx           Root: auth, tema, routing, estado de permissões
  index.css         Tailwind + keyframes + scrollbar
  data.js           Dados fictícios (substituir por chamadas à API)
  icons.jsx         Conjunto de ícones SVG
  charts.jsx        Gráficos SVG (área, barras, donut, sparkline)
  ui.jsx            Primitivos (Card, Button, Badge, Input, Modal, ...)
  Login.jsx         Ecrã de login
  Shell.jsx         Sidebar + topbar + navegação responsiva
  Dashboard.jsx     Dashboard com KPIs e gráficos
  Clientes.jsx      Clientes finais
  Loja.jsx          Produtos + encomendas
  AgendaPanels.jsx  Modais e painéis da Agenda
  Agenda.jsx        Calendário semanal + submenu
  Admin.jsx         Contas, permissões e componentes
```

## Notas

- Os dados em `src/data.js` são **fictícios** e mantidos em memória (estado React). Ao recarregar, voltam ao estado inicial. Para produção, liga estes módulos à tua API/base de dados.
- O sistema de permissões é a base: cada **permissão** lista os **componentes** (`id`/chave) a que dá acesso, e a navegação + dashboard adaptam-se automaticamente. Novos componentes criados no Admin ficam disponíveis para atribuir a qualquer permissão.
- O accent (cor principal) é controlado por variáveis CSS `--accent` / `--accent-hex` em `App.jsx` (mudam com o tema). Ajusta aí para mudar a cor de marca.
