# DESIGN BRIEF — Simplificar a página Website (website-simplify)

**Data:** 2026-08-11 · **Decisão do dono:** a página Website encolhe para 3 vistas — o tenant não gere template, rodapé/nav nem definições finas. Estrutura é decidida na criação da conta; texto vive no CMS (ver brief `site-cms-content`).

## O que sai

1. **Template** (galeria): o template é semeado no signup pela vertical (`seedDraftSite` → `getTemplateForVertical`) e **nunca mais muda**. Remover: vista/rota/subitem no BO, hook `useGetWebsiteTemplates` + consumo, e na API o endpoint `GET /website/templates` (rota + controller + swagger + teste `websiteTemplates.test.ts`). O catálogo `src/data/siteTemplates.ts` FICA (alimenta o seed). `template` e `skin` saem de `EDITABLE_FIELDS` (imutáveis via PUT).
2. **Rodapé & Nav** (`FooterNavTab` + editores auxiliares): remover vista/rota/subitem. Na API, `nav` e `footer` saem de `EDITABLE_FIELDS` (o seed continua a escrevê-los; texto do rodapé passa a editar-se no CMS — `site.footer.*`).
3. **Definições** (`SettingsTab` + 6 cards + validações + `LocaleTextEditor`): remover vista/rota/subitem. `settings` sai de `EDITABLE_FIELDS` se lá estiver. O renderer mantém a leitura tolerante (dados antigos não partem).

## O que funde

4. **"O meu site" + "Domínio"** → uma só vista `site`: estado/URL/publicar/checklist + secção de subdomínio (o `CustomDomainCard` continua atrás da flag `CUSTOM_DOMAIN_UI = false`, exportado para testes). A secção de domínio só aparece com `canEditStructure` (mesma permissão que gateava a tab Domínio: `VIEW_SITE_BUILDER` ou `VIEW_ADMIN`).

## Navegação resultante

`SUBMENU["/website"]`: **O meu site** (`/website`) · **Páginas** (`/website/paginas`) · **Marca** (`/website/marca`). Rotas removidas (`/website/template`, `/website/rodape-nav`, `/website/definicoes`, `/website/dominio`) redirecionam para `/website` (Navigate) para não partir deep-links/bookmarks. `WebsiteView` = `"site" | "pages" | "brand"`.

## Testes a adaptar

- `tests/unit/Website.test.tsx`: fora os describes de Template/Rodapé/Definições; testes de domínio passam a montar `view="site"`; `CustomDomainCard` mantém cobertura direta.
- `tests/e2e/pages/WebsitePage.ts` (`PATH_BY_LABEL`) + `website.spec.ts` (lista de tabs) + `rbac-matriz.spec.ts` (`SITE_BUILDER_GATED_ROUTES` deixa de ter rotas gated próprias — a secção de domínio é testada dentro de `/website`).
- API: `site.test.ts` ganha asserts de que `template`/`nav`/`footer`/`settings` são ignorados no PUT; `websiteTemplates.test.ts` sai (cobertura do catálogo continua em `signupSiteSeed.test.ts`/`verticalTemplates.test.ts`).

## Pós-mudança

Regenerar swagger→`spec.json`→Kubb (o hook `useGetWebsiteTemplates` gerado desaparece). Atualizar FUNCIONALIDADES.md e CLAUDE.md (BO + workspace).
