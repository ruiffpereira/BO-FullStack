import { useState, useMemo } from "react";
import { usePagination, Pagination } from "../components/Pagination";
import { useGetSettingsLanguages } from "../hooks/useSettingsLanguages";
import { confirmDialog } from "../components/confirm";
import { Icon } from "../ui/icons.jsx";
import { Card, PageHeader, EmptyState, BADGE_TONES } from "../ui/ui.jsx";
import { GuardButton } from "../components/GuardButton";
import { useTeamAccess } from "../hooks/useTeamAccess";
import { useGetProducts } from "../gen/backoffice/hooks/useGetProducts.js";
import { useGetCategories } from "../gen/backoffice/hooks/useGetCategories.js";
import type { Category } from "../gen/backoffice/types/Category.js";
import { ProdutoModal } from "./loja/ProdutoModal";
import { CategoriasTab } from "./loja/CategoriasTab";
import { EncomendasTab } from "./loja/EncomendasTab";
import { useProductEditor } from "./loja/useProductEditor";
import { usePageSubtitle } from "../context/PageMetaContext";
import { ProdutoCard } from "./loja/ProdutoCard";

// ─── Página principal ─────────────────────────────────────────────────────────

export type LojaView = "produtos" | "encomendas" | "categorias";

/**
 * Página "Loja" (VIEW_PRODUCTS). Cada separador vive na sua própria rota
 * (`/loja`, `/loja/encomendas`, `/loja/categorias`, T2.1 — Fase 2 da sidebar
 * com submenus) — a navegação entre vistas já não é feita por `Tabs` de topo,
 * é a sidebar (`NavItemGroup`/`Shell.tsx`); a página só recebe a vista pedida
 * via `view`. Sem gate por subitem: a página inteira já está atrás de
 * `VIEW_PRODUCTS` (Shell.tsx), por isso os 3 subitens de `SUBMENU["/loja"]`
 * não têm `perm` individual.
 */
export function Loja({ view }: { view: LojaView }) {
  // O custo só segue no pedido a quem o pode editar (a API também o ignora a quem não pode).
  const { can: canTeam } = useTeamAccess();
  const canEditCost = canTeam("loja.produtos.custo", "edit");
  const tab = view;
  const [q, setQ] = useState("");

  const { data: langData } = useGetSettingsLanguages();
  const defaultLang = langData?.default ?? "pt";

  const { data: productsData, isLoading: loadingProds } = useGetProducts({
  });
  const { data: categoriesData } = useGetCategories();
  const products = useMemo(() => productsData?.rows ?? [], [productsData]);
  const categories = (categoriesData?.rows ?? []) as Category[];

  const filtered = useMemo(
    () =>
      products.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())),
    [products, q],
  );
  const pgProd = usePagination(filtered, { resetKey: q });

  // Contadores de stock e total faturado: calculados na API (LJ-05, LJ-11) — o ecrã só lê.
  const pStats = productsData?.stats;
  const lowStockMax = pStats?.lowStockMax ?? 5;
  const stats = {
    total: pStats?.total ?? products.length,
    stock: pStats?.stock ?? 0,
    baixo: pStats?.low ?? 0,
    esgotado: pStats?.out ?? 0,
  };

  const { modal, editing, openEdit, openNew, closeModal, handleSave, isPending, deleteProduct } = useProductEditor({ canEditCost, defaultLang, products });
  usePageSubtitle("Gere produtos, stock e encomendas.");

  return (
    <div>
      <PageHeader>
        <GuardButton icon="plus" onClick={openNew}>
          Novo produto
        </GuardButton>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { l: "Produtos", v: stats.total, i: "box", t: "blue" as const },
          { l: "Em stock", v: stats.stock, i: "package", t: "green" as const },
          { l: "Stock baixo", v: stats.baixo, i: "trend", t: "amber" as const },
          { l: "Esgotados", v: stats.esgotado, i: "ban", t: "red" as const },
        ].map((s) => (
          <Card key={s.l} className="p-4 flex items-center gap-3">
            <span
              className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${BADGE_TONES[s.t]}`}
            >
              <Icon name={s.i} className="w-5 h-5" />
            </span>
            <div>
              <p className="text-xl font-semibold text-zinc-900 dark:text-white tabular-nums">
                {s.v}
              </p>
              <p className="text-[13px] text-zinc-500">{s.l}</p>
            </div>
          </Card>
        ))}
      </div>

      {tab === "produtos" && (
        <div>
          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <div className="relative flex-1 max-w-xs">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
                <Icon name="search" className="w-[18px] h-[18px]" />
              </span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Procurar produto…"
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm pl-10 pr-3 py-2 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 text-zinc-800 dark:text-zinc-100"
              />
            </div>
          </div>

          {loadingProds ? (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Card key={i} className="overflow-hidden animate-pulse">
                  <div className="h-36 bg-zinc-100 dark:bg-zinc-800" />
                  <div className="p-4 space-y-2">
                    <div className="h-4 w-3/4 rounded bg-zinc-100 dark:bg-zinc-800" />
                    <div className="h-3 w-1/2 rounded bg-zinc-100 dark:bg-zinc-800" />
                  </div>
                </Card>
              ))}
            </div>
          ) : filtered.length ? (
            <>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {pgProd.pageItems.map((p) => (
                <ProdutoCard
                  key={p.productId}
                  p={p}
                  lowStockMax={lowStockMax}
                  onEdit={() => openEdit(p)}
                  onDelete={async () => {
                    if (await confirmDialog({ title: `Eliminar "${p.name}"?`, danger: true }))
                      deleteProduct.mutate({ id: p.productId });
                  }}
                />
              ))}
            </div>
            <Pagination {...pgProd} />
            </>
          ) : (
            <Card>
              <EmptyState
                icon="search"
                title="Sem produtos"
                desc="Não há produtos que correspondam à pesquisa."
              />
            </Card>
          )}
        </div>
      )}

      {tab === "encomendas" && <EncomendasTab />}

      {tab === "categorias" && <CategoriasTab categories={categories} />}

      <ProdutoModal
        open={modal}
        produto={editing}
        categories={categories}
        onClose={closeModal}
        onSave={handleSave}
        isPending={isPending}
        defaultLang={defaultLang}
      />
    </div>
  );
}
