# BO-FullStack

Este é um projeto fullstack desenvolvido com [Next.js](https://nextjs.org), focado em gestão de backoffice para e-commerce, incluindo administração de produtos, categorias, clientes, encomendas e integração com pagamentos.

---

## 🚀 Propósito

O objetivo deste projeto é fornecer uma plataforma de gestão completa para lojas online, permitindo ao administrador:

- Gerir produtos e respetivas categorias/subcategorias
- Gerir clientes e encomendas
- Visualizar estatísticas de vendas e faturação
- Integrar métodos de pagamento (Stripe)
- Gerir autenticação e permissões de utilizadores
- Ter uma interface moderna, responsiva e fácil de usar

---

## 🛠️ Tecnologias Utilizadas

- **Next.js** (App Router)
- **React** (com hooks e componentes funcionais)
- **TypeScript**
- **TailwindCSS** (design moderno e responsivo)
- **Radix UI** e **shadcn/ui** (componentes de UI acessíveis)
- **React Hook Form** + **Zod** (validação de formulários)
- **Zustand** (state management)
- **NextAuth.js** (autenticação)
- **Stripe** (pagamentos)
- **date-fns** (manipulação de datas)
- **ESLint** + **Prettier** (qualidade e formatação de código)
- **Docker/Nixpacks** (deploy e ambiente de produção)
- **pnpm** (gestor de pacotes)

---

## ✨ Funcionalidades

- **Gestão de Produtos:**  
  Adicionar, editar, remover produtos, upload de imagens, gestão de stock e preços.

- **Gestão de Categorias/Subcategorias:**  
  Organização hierárquica de produtos.

- **Gestão de Clientes:**  
  Visualização, pesquisa e edição de dados de clientes.

- **Gestão de Encomendas:**  
  Listagem, detalhe, atualização de estado e faturação.

- **Dashboard e Estatísticas:**  
  Visualização de totais de vendas, faturação, clientes e encomendas.

- **Pagamentos Online:**  
  Integração com Stripe para checkout seguro.

- **Autenticação e Sessão:**  
  Login seguro com NextAuth.js, proteção de rotas e permissões.

- **Interface Moderna:**  
  UI responsiva, dark mode, componentes acessíveis e experiência de utilizador otimizada.

---

## ▶️ Como começar

1. Instale as dependências:

   ```bash
   pnpm install
   # ou
   npm install
   ```

2. Configure as variáveis de ambiente no arquivo `.env` (veja o exemplo em `.env.example`).

3. Inicie o servidor de desenvolvimento:

   ```bash
   pnpm dev
   # ou
   npm run dev
   ```

4. Acesse [http://localhost:3000](http://localhost:3000) no navegador.

---

## 📦 Deploy

- Suporta deploy automático em plataformas como [Vercel](https://vercel.com/) e [Railway](https://railway.app/).
- Pronto para produção com Docker/Nixpacks.

---
