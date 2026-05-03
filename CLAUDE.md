# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Goal

Multi-tenant backoffice platform supporting multiple business verticals:
- **E-commerce** — product, category, order, and customer management (partially built)
- **Hairdresser / Cabeleireiro** — scheduling, appointments, services (priority — being built for a friend)
- **Gym / Ginásio** — planned for the future

There is also a super-admin role (the project owner) who manages users, assigns permissions, and configures the system for each business type.

## Commands

```bash
pnpm dev          # Generate API hooks (kubb) + start dev server with Turbopack
pnpm build        # Generate API hooks + format + build for production
pnpm start        # Generate API hooks + format + start production server
pnpm lint         # Run ESLint
pnpm kubb         # Regenerate API hooks and types from OpenAPI spec + format
```

> **Important:** `pnpm dev` always runs `kubb generate` first. If the backend API at `http://localhost:3001` is not running, the dev command will fail. Start the backend before running the frontend.

## Architecture

### Backend Integration via Kubb (code generation)

All API communication is handled through auto-generated code in `src/servers/backoffice/`. **Never edit these files manually** — they are regenerated on every `dev`/`build`/`start`.

- **Source spec:** `http://localhost:3001/api-docs/backoffice.json` (OpenAPI/Swagger)
- **Generated hooks:** `src/servers/backoffice/hooks/` — TanStack React Query hooks (`useGetX`, `usePostX`, `usePutX`, `useDeleteX`, and Suspense variants)
- **Generated types:** `src/servers/backoffice/types/` — TypeScript interfaces for all entities
- **Config:** `kubb.config.ts`

To add a new API endpoint: add it to the backend OpenAPI spec, then run `pnpm kubb`.

### Authentication & Session

NextAuth.js with JWT strategy. Login page is `/admin`.

Flow: credentials form → `POST /api/users/login` → returns `{ accessToken }` → stored in JWT → available as `session.accessToken` in all components.

Every API call requires `Authorization: Bearer <token>` in headers. The pattern is:
```ts
const { data: session } = useSession()
useGetSomething({ client: { headers: { Authorization: `Bearer ${session?.accessToken}` } } })
```

Server components (like `layout.tsx`) use `getServerSession(authOptions)` and call API functions directly.

### Permission System

Permissions are fetched server-side in `src/app/layout.tsx` and passed down to `Layout` → `Sidebar`. The sidebar renders navigation items conditionally based on permission names:

| Permission name | Shows in sidebar |
|---|---|
| `VIEW_PRODUCTS` | Ecommerce section |
| `VIEW_SCHEDULE` | Schedule section |
| `VIEW_CUSTOMERS` | Customers section |
| `VIEW_ADMIN` | Admin section |

The admin (super-user) manages permissions via the API (`usePostUserpermissions`, `useGetPermissions`, etc.). New verticals (hairdresser, gym) need new permission names added on the backend and mapped in `sidebar.tsx`.

### Page & Component Structure

- **`src/app/`** — Next.js App Router pages. Each route segment can have `page.tsx`, `loading.tsx`, `layout.tsx`.
- **`src/components/`** — Feature components organized by domain (`product/`, `orders/`, `categories/`, `login/`, `layout/`).
- **`src/components/shadcn/ui/`** — shadcn/ui component library (Radix UI wrappers). Use these for all UI primitives.
- **`src/lib/`** — React Query provider, query client factory (SSR-aware with 5-minute stale time, no refetch on focus).
- **`src/routes/index.tsx`** — Centralized route constants. Add new routes here.
- **`src/context/AuthProvider.tsx`** — Wraps `SessionProvider` from NextAuth.

### Data Fetching Pattern

- Server components: call generated hook functions directly (they accept a config object with headers)
- Client components: use generated `useGet*` hooks with session token
- Mutations: `usePost*`, `usePut*`, `useDelete*` hooks with `onSuccess` → `toast.success(...)` / `toast.error(...)`
- Toast notifications via `sonner` (`import { toast } from 'sonner'`)

### Key Issues to Be Aware Of

1. **`VIEW_ADMIN` sidebar bug** (`sidebar.tsx:79-89`): The `VIEW_ADMIN` permission renders a link to `/admin` (the login page) with label "Schedule". This should link to an admin management panel, not the login page.

2. **No `/schedule` route exists yet** — `VIEW_SCHEDULE` in the sidebar links to `/schedule` but the page hasn't been created. This is where the hairdresser appointment system will live.

3. **`console.log` statements** in `layout.tsx` (lines 32, 34) log session and permissions to the server console — remove before production.

4. **`postUsersLogin` is imported from hooks** (`authOptions.ts`) but is used as a plain async function (not as a React hook) — this is correct for the NextAuth authorize callback context.

## Environment Variables

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/api   # Backend REST API base
NEXT_PUBLIC_CONTAINERRAIZ=http://localhost:3001/uploads  # Media/image base URL
NEXTAUTH_SECRET=<random>
NEXTAUTH_URL=http://localhost:3000
```

## Docker

```bash
docker compose up          # Start dev container (port 3000)
docker compose --profile prod up  # Start production container (port 3002)
```
