# Design Review: Site Engine — renderer (biblioteca de blocos completa)

Reviewed against: `.design/site-engine/DESIGN_BRIEF.md`
Philosophy: **Editorial + Sistema** (token-driven; qualquer marca fica bem)
Data: 2026-07-01 · App: `localhost:3002` (demo Barbearia, tema ink/editorial)

## Screenshots Captured
| Screenshot | Breakpoint | Mostra |
| --- | --- | --- |
| `screenshots/review-full-desktop-1280.png` | Desktop 1280 | Home demo completa: Nav · Hero · Stats · **Booking** · Services · Pricing · About · Gallery · Testimonials · FAQ · Contact · CTA · **Lead** · Footer |
| `screenshots/review-full-mobile-375.png` | Mobile 375 | Mesma, coluna única |

## Summary
A biblioteca de blocos (17 blocos + funcionais) é **coerente, editorial e 100% token-driven** — o brief está cumprido no visual. As duas questões que interessam são de **produção/robustez**, não de estética: (1) o **hydration mismatch** persistente, e (2) os blocos funcionais fazem fetch à API **no cliente** → **CORS bloqueia cross-origin** (renderer ≠ API), por isso não funcionam em produção sem proxy. A composição do demo também ficou **sobrecarregada** (3 formulários de captura na mesma página).

## Estado das correções (2026-07-01 — pós-review)
- ✅ **Must #1 Hydration** — RESOLVIDO: `<style>` inline → `app/blocks.css` global (19 componentes). Verificado: zero "did not match", overlay sumiu.
- ✅ **Must #2 CORS/funcionais** — RESOLVIDO: proxy same-origin no renderer (`app/api/site/*`) + `RENDERER_API_KEY` env-gated na API. Verificado: zero CORS na consola (dev sem chave → 401 → fallback demo).
- ✅ **Should #3 Demo sobrecarregado** — RESOLVIDO: bloco Lead retirado do demo home (fica Booking + Contact).
- ⏳ **Should #4 Mapa vazio** — o `Contact` já só renderiza o mapa com `mapEmbedUrl`; a caixa vazia era do bloco Lead (removido). Sem ação adicional.

---

## Must Fix
1. **Hydration mismatch** (`Text content did not match. Server vs Client`, fora de Suspense → o root inteiro cai para client-render). Mata o benefício do SSR e mostra o overlay de erro. `screenshots/review-full-desktop-1280.png` (overlay "1 error"). _Fix: isolar o nó de texto que difere (candidatos: `<html lang>`/data-attrs no `layout.tsx` derivados de headers; algo num client component). Investigar e eliminar._
2. **Blocos funcionais fazem fetch à API no CLIENTE → CORS.** `Booking`/`Lead` (client) chamam `http://…:3001/api/…` a partir da origem do renderer → `No 'Access-Control-Allow-Origin'` (visto na consola: `booking/services`). Em produção `barbearia.dominio → api.dominio` é cross-origin → **falha** (cai sempre no fallback demo). _Fix: **proxy via route handlers do Next** (`app/api/…` no renderer faz o fetch server-side à API — sem CORS, e permite injetar o `SITE_TOKEN` no servidor sem o expor ao cliente). Alternativa pior: abrir o CORS da API aos domínios dos tenants._

## Should Fix
3. **Demo home sobrecarregado** — tem **3 formulários de captura** (Booking "Marca a tua hora" + Contact "Passa por cá" + Lead "Deixa o teu contacto"). Redundante e cansativo; um barbeiro real não teria isto. _Fix: curar o `demoSite` — manter o Booking (ação principal) + Contact; tirar o Lead do demo (o bloco existe na mesma para quem o quiser)._
4. **Contact: caixa de mapa vazia** quando não há `mapEmbedUrl` (aparece um retângulo vazio com borda). `screenshots/review-full-desktop-1280.png` (abaixo dos contactos). _Fix: não renderizar o contentor do mapa quando não há URL._

## Could Improve
5. **`userId=demo` literal** nos fetches do demo (cosmético; some quando resolve um tenant real).
6. **CookieConsent em `position: fixed`** aparece no topo nos screenshots full-page (artefacto de captura; no browser real fica no fundo). Sem ação.

## What Works Well
- **Fidelidade ao brief**: editorial/ink consistente, tipografia display serif forte, alto contraste, cantos afiados — reconhece-se a direção à primeira. Zero cores/spacing hardcoded (tudo `--site-*`).
- **Consistência entre blocos**: mesmo ritmo de secção (`--site-space-section`), mesma largura de contentor, mesmos botões accent. 17 blocos parecem do mesmo sistema.
- **Responsivo a sério**: mobile reorganiza (nav→hamburger, grelhas→1 coluna, Stats→2 col, forms full-width), não só encolhe. Sem overflow horizontal.
- **A11y de base**: `<details>` no FAQ, foco visível, semântica, `prefers-reduced-motion` via tokens.
- **SEO + RGPD** presentes (metadata/hreflang, sitemap/robots, cookie consent, /privacidade).

## Próximo (a corrigir já, nesta ordem)
1. Hydration mismatch (Must #1). 2. Proxy dos blocos funcionais (Must #2). 3. Curar o demo + caixa de mapa (Should #3/#4).
