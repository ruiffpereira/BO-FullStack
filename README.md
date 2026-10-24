# Backoffice — React + Vite + TailwindCSS
> **Lê-se:** quem instala ou corre o repo · **Verdadeiro por:** `coerencia.test.mjs` (caminhos)

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
  main.tsx          Entry point
  App.tsx           Root: auth, tema, routing, estado de permissões
  index.css         Tailwind + keyframes + scrollbar
  gen/              Cliente da API gerado pelo Kubb (nunca à mão)
  ui/               Primitivos (ui.jsx: Card, Button, Badge, Input, Modal, ...), ícones e gráficos SVG
  pages/            Uma página por módulo (Dashboard, Clientes, Loja, Agenda, Admin, ...)
  components/       Componentes partilhados
  hooks/ lib/ utils/ context/   Dados da API (React Query), helpers e contexto
```

Mapa página a página: [REFERENCIA-PAGINAS.md](REFERENCIA-PAGINAS.md).

## Notas

- Os dados vêm todos da API (`API-FullStack`), pelo cliente gerado em `src/gen`; não há dados fictícios.
- O sistema de permissões é a base: cada **permissão** lista os **componentes** (`id`/chave) a que dá acesso, e a navegação + dashboard adaptam-se automaticamente. Novos componentes criados no Admin ficam disponíveis para atribuir a qualquer permissão.
- O accent (cor principal) é controlado por variáveis CSS `--accent` / `--accent-hex` em `App.tsx` (mudam com o tema). Ajusta aí para mudar a cor de marca.
