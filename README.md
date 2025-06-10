# BO-FullStack

This is a fullstack project developed with [Next.js](https://nextjs.org), focused on backoffice management for e-commerce, including administration of products, categories, customers, orders, and payment integration.

---

## 🚀 Purpose

The goal of this project is to provide a complete management platform for online stores, allowing the administrator to:

- Manage products and their categories/subcategories
- Manage customers and orders
- View sales and revenue statistics
- Integrate payment methods (Stripe)
- Manage user authentication and permissions
- Have a modern, responsive, and easy-to-use interface

---

## 🛠️ Technologies Used

- **Next.js** (App Router)
- **React** (with hooks and functional components)
- **TypeScript**
- **TailwindCSS** (modern and responsive design)
- **Radix UI** and **shadcn/ui** (accessible UI components)
- **React Hook Form** + **Zod** (form validation)
- **Zustand** (state management)
- **NextAuth.js** (authentication)
- **Stripe** (payments)
- **date-fns** (date manipulation)
- **ESLint** + **Prettier** (code quality and formatting)
- **Docker/Nixpacks** (deployment and production environment)
- **pnpm** (package manager)

---

## ✨ Features

- **Product Management:**  
  Add, edit, remove products, image upload, stock and price management.

- **Category/Subcategory Management:**  
  Hierarchical organization of products.

- **Customer Management:**  
  View, search, and edit customer data.

- **Order Management:**  
  Listing, details, status updates, and invoicing.

- **Dashboard and Statistics:**  
  View sales, revenue, customer, and order totals.

- **Online Payments:**  
  Integration with Stripe for secure checkout.

- **Authentication and Session:**  
  Secure login with NextAuth.js, route protection, and permissions.

- **Modern Interface:**  
  Responsive UI, dark mode, accessible components, and optimized user experience.

---

## ▶️ Getting Started

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Configure the environment variables in the `.env` file (see the example in `.env.example`).

3. Start the development server:

   ```bash
   pnpm dev
   ```

4. Access [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📦 Deployment

- Supports automatic deployment on platforms like [Vercel](https://vercel.com/) and [Railway](https://railway.app/).
- Ready for production with Docker/Nixpacks.

---
