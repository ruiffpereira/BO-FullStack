# B27 · Fase 3 — inventário do texto do site-engine sem chave semeada

Varredura de 2026-09-26 contra `site-engine@2c2d9ca` e `API-FullStack` (`src/utils/siteCms.ts`,
`src/cmsDefaults/gymApp.*.json`). Contagens aproximadas. **Um retrato, não uma garantia** — refazer
antes de fechar a fase 5.

## 1. Famílias com fallback em `lib/*Labels.ts`

| Fallback | site-engine | API PT / EN | Falta |
|---|---|---|---|
| `authLabels.ts` | 26 | 25 / 25 | `site.auth.forgotError` |
| `contaLabels.ts` | 52 | 52 / 52 | — |
| `pwaLabels.ts` | 10 | 10 / 10 | — |
| `cookieLabels.ts` | 5 | **0 / 0** | `site.cookies.*` inteiro |
| `privacyContent.ts` | 2 | 1 / 1 | `site.privacy.content` — espera pelo B23 (markdown) |

## 2. App do sócio (`appgym/i18n` vs `gymApp.*.json`)

Os JSON são iguais (362 chaves, PT = EN). As lacunas estão no código:
- **11 chaves usadas sem entrada:** `gym.app.cookies.{title,text,accept,reject,privacy}`
  (`CookieConsent.tsx`), `gym.app.privacy.{title,content,updated,updated_label}` e
  `gym.app.business.name` (`screens/Privacy.tsx`), `gym.app.workouts.view` (`Workouts.tsx:76`).
- **56 chaves sem uso literal** (`exec.*`, `install.perk*_title`, …) — algumas são dinâmicas
  (`muscle.*`, `calendar.day.long.*`). Confirmar antes de apagar.
- **Valores errados no default da plataforma:** `install.subtitle` diz "GYMNOPRADO" (nome de um
  cliente); `install.perk1_desc` = `perk1_title`; 4 valores com `<b>` (`install.ios_step1-3`,
  `ios_note`) — a sanitização da API come-os.
- **~55 literais fora do `t()`:** corpo da privacidade (~40 segmentos), "A carregar app…",
  "Aplicação indisponível", "Desenvolvido por RufVision", marca "GYMNOPRADO" fixa em `ui/index.tsx:15`,
  "Close", "min", "kg".

## 3. Estrutural (API)

- **Nenhum conteúdo de bloco tem EN.** O `flattenSiteText` só semeia os idiomas presentes no
  conteúdo, e os 3 templates só têm `pt`. `site.<blockId>.*`, `site.page.*`, `site.footer.*`: só PT.
- **Nav fora do CMS:** `nav.items[].label` e `nav.cta.label` não são achatados.
- **Rótulos de sistema por instância de bloco:** lidos com `str(content, key, default)` só existem
  por `blockId`; o template não os traz, logo não são semeados.

## 4. Texto visível sem chave nenhuma (sites agenda + loja)

| Área | Onde | Nº | Prefixo sugerido |
|---|---|---|---|
| Carrinho | `blocks/CartClient.tsx`, `AddToCart.tsx` | ~25 | `site.cart.*` |
| Checkout | `blocks/CheckoutClient.tsx`, `StripePayment.tsx`, `CheckoutSuccessClient.tsx` | ~70 | `site.checkout.*` |
| Ficha de produto | `app/loja/[produto]/page.tsx` | ~6 | `site.shop.*` |
| Marcações | `blocks/Booking.tsx` (44 defaults via `str`) | ~50 | `site.booking.*` |
| Hero agenda | `blocks/Hero.tsx:136-316` | ~12 | `site.booking.*` / `site.a11y.*` |
| Cancelar marcação | `blocks/CancelPageClient.tsx` | ~18 | `site.cancel.*` |
| Redefinir password | `app/reset-password/ResetPasswordClient.tsx` | ~14 | `site.auth.reset*` |
| Entrar | `EntrarClient.tsx`, `EntrarClientSimple.tsx`, `CustomerAuthPanel.tsx` | ~11 | `site.auth.*` |
| Conta simples | `ContaClientSimple.tsx`, `ContaClient.tsx:362,593` | ~19 | `site.conta.*` |
| Validação e estados | `lib/publicApiShared.ts` | ~30 únicas | `site.validation.*`, `site.status.*` |
| Leads e contacto | `LeadFormClient.tsx`, `Contact.tsx`, `ContactInfo.tsx`, `Lead.tsx` | ~22 | `site.form.*` |
| Template loja (stand) | `HeroStand`, `CtaStand`, `ContactStand`, `ServicesStand`, `StatsStand`, `ProductsStand` | ~85 (~40 nem PT) | `site.stand.*` |
| Nav, rodapé, a11y | `Nav*.tsx`, `LocaleSwitcher.tsx`, `Footer*.tsx`, `AnnouncementBar`, `SiteModal`, `PwaInstallBanner`, `WhatsappFloat`, `lib/nav.ts` | ~45 + 17 nomes de línguas | `site.nav.*`, `site.a11y.*` |
| Blocos genéricos | `About`, `Gallery*`, `Testimonials`, `Pricing`, `Collection*`, `Products` | ~22 | `site.a11y.*`, `site.<blockId>.*` |
| Páginas e SEO | metadata de `cancelar`, `carrinho`, `checkout`, `conta`, `entrar`, `inscrever`, `privacidade`, `reset-password`; `not-found`; `preview`; `lib/pwa.ts:53`; `lib/jsonLd.ts:260` | ~35 | `site.meta.*`, `site.notFound.*` |

**Demonstração** (`lib/demoSite.ts`, `demoProducts.ts`, `blockHelpers.ts:113` `demoServices`): ~46.

**Total:** ~470 nos sites + ~66 na app do sócio (+ ~46 de demonstração).

## 5. Armadilhas a resolver ao mover (só listadas)

- **Interpolação:** `{{servico}}`, `{{negocio}}`, `{n}`/`{d}`; template literals ("Últimas ${n}
  unidades", "${data} às ${hora}", "Série ${n} de ${total}"); plurais; "min", "kg".
- **Locale fixo `pt-PT`/€** em `CtaStand`, `HeroStand`, `ProductsStand`, `PrivacyPageClient:77`,
  `Mensalidade*`, `Booking.tsx:669`, `publicApiShared.ts:159`, `lib/dates.ts`.
- **Ids em PT:** `gym.app.muscle.Bíceps` usa o nome como id.
- **Mapeamento por texto exacto:** `appgym/api/client.ts:129-143` traduz mensagens de erro PT da API
  para `gym.app.error.*` — se a API mudar o texto, parte.
