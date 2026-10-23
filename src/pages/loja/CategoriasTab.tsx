import { useState } from "react";
import { TranslationInputs, type TranslationMap } from "../../components/TranslationInputs";
import { confirmDialog } from "../../components/confirm";
import { toast } from "sonner";
import { getApiError } from "../../lib/apiError";
import { useQueryClient } from "@tanstack/react-query";
import { Icon } from "../../ui/icons.jsx";
import { Card, Button, Modal } from "../../ui/ui.jsx";
import { GuardButton, GuardIconButton } from "../../components/GuardButton";
import { getCategoriesQueryKey } from "../../gen/backoffice/hooks/useGetCategories.js";
import { usePostCategories } from "../../gen/backoffice/hooks/usePostCategories.js";
import { usePostSubcategories } from "../../gen/backoffice/hooks/usePostSubcategories.js";
import { usePutCategoriesId } from "../../gen/backoffice/hooks/usePutCategoriesId.js";
import { useDeleteCategoriesId } from "../../gen/backoffice/hooks/useDeleteCategoriesId.js";
import { usePutSubcategoriesId } from "../../gen/backoffice/hooks/usePutSubcategoriesId.js";
import { useDeleteSubcategoriesId } from "../../gen/backoffice/hooks/useDeleteSubcategoriesId.js";
import type { Category } from "../../gen/backoffice/types/Category.js";

/** Separador «Categorias» da Loja: categorias e subcategorias (criar, renomear, traduzir, eliminar). */
export function CategoriasTab({ categories }: { categories: Category[] }) {
  const qc = useQueryClient();
  const invalidateCats = () =>
    qc.invalidateQueries({ queryKey: getCategoriesQueryKey() });

  // ── Categories state ──
  const [newCatVisible, setNewCatVisible] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [editCat, setEditCat] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [newSubCatId, setNewSubCatId] = useState<string | null>(null);
  const [newSubName, setNewSubName] = useState("");
  const [editSub, setEditSub] = useState<{
    id: string;
    name: string;
    categoryId: string;
  } | null>(null);
  const [transModal, setTransModal] = useState<{
    id: string;
    name: string;
    translations: TranslationMap;
    type: "cat" | "sub";
    categoryId?: string;
  } | null>(null);

  const putCategory = usePutCategoriesId({
    mutation: {
      onSuccess: () => {
        toast.success("Categoria guardada");
        invalidateCats();
        setEditCat(null);
        setNewCatVisible(false);
        setNewCatName("");
      },
      onError: (e) => toast.error(getApiError(e, "Erro ao guardar categoria")),
    },
  });
  const postCategory = usePostCategories({
    mutation: {
      onSuccess: () => {
        toast.success("Categoria guardada");
        invalidateCats();
        setEditCat(null);
        setNewCatVisible(false);
        setNewCatName("");
      },
      onError: (e) => toast.error(getApiError(e, "Erro ao guardar categoria")),
    },
  });
  const delCategory = useDeleteCategoriesId({
    mutation: {
      onSuccess: () => {
        toast.success("Categoria eliminada");
        invalidateCats();
      },
      onError: (e) => toast.error(getApiError(e, "Erro ao eliminar categoria")),
    },
  });
  const putSubcategory = usePutSubcategoriesId({
    mutation: {
      onSuccess: () => {
        toast.success("Subcategoria guardada");
        invalidateCats();
        setEditSub(null);
        setNewSubCatId(null);
        setNewSubName("");
      },
      onError: (e) => toast.error(getApiError(e, "Erro ao guardar subcategoria")),
    },
  });
  const postSubcategory = usePostSubcategories({
    mutation: {
      onSuccess: () => {
        toast.success("Subcategoria guardada");
        invalidateCats();
        setEditSub(null);
        setNewSubCatId(null);
        setNewSubName("");
      },
      onError: (e) => toast.error(getApiError(e, "Erro ao guardar subcategoria")),
    },
  });
  const delSubcategory = useDeleteSubcategoriesId({
    mutation: {
      onSuccess: () => {
        toast.success("Subcategoria eliminada");
        invalidateCats();
      },
      onError: (e) => toast.error(getApiError(e, "Erro ao eliminar subcategoria")),
    },
  });

  const saveCat = (id: string | null) => {
    const name = id ? editCat?.name?.trim() : newCatName.trim();
    if (!name) {
      toast.error("Nome obrigatório");
      return;
    }
    if (id) putCategory.mutate({ id, data: { name } });
    else postCategory.mutate({ data: { name } });
  };
  const saveSub = (id: string | null, categoryId: string) => {
    const name = id ? editSub?.name?.trim() : newSubName.trim();
    if (!name) {
      toast.error("Nome obrigatório");
      return;
    }
    if (id) putSubcategory.mutate({ id, data: { name, categoryId } });
    else postSubcategory.mutate({ data: { name, categoryId } });
  };
  const saveTranslations = () => {
    if (!transModal) return;
    if (transModal.type === "cat") {
      putCategory.mutate(
        {
          id: transModal.id,
          data: {
            name: transModal.name,
            translations: transModal.translations,
          },
        },
        {
          onSuccess: () => {
            toast.success("Traduções guardadas");
            setTransModal(null);
          },
          onError: () => toast.error("Erro ao guardar traduções"),
        },
      );
    } else {
      putSubcategory.mutate(
        {
          id: transModal.id,
          data: {
            name: transModal.name,
            categoryId: transModal.categoryId!,
            translations: transModal.translations,
          },
        },
        {
          onSuccess: () => {
            toast.success("Traduções guardadas");
            setTransModal(null);
          },
          onError: () => toast.error("Erro ao guardar traduções"),
        },
      );
    }
  };

  return (
    <>
        <div className="max-w-xl space-y-3">
          {/* Add category */}
          {newCatVisible ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveCat(null);
                  if (e.key === "Escape") {
                    setNewCatVisible(false);
                    setNewCatName("");
                  }
                }}
                placeholder="Nome da categoria…"
                className="flex-1 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-900 focus:outline-none focus:border-accent"
              />
              <GuardButton
                size="sm"
                onClick={() => saveCat(null)}
                disabled={putCategory.isPending || postCategory.isPending}
              >
                Criar
              </GuardButton>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setNewCatVisible(false);
                  setNewCatName("");
                }}
              >
                Cancelar
              </Button>
            </div>
          ) : (
            <GuardButton
              icon="plus"
              variant="ghost"
              size="sm"
              onClick={() => {
                setNewCatVisible(true);
                setNewCatName("");
              }}
            >
              Nova categoria
            </GuardButton>
          )}

          {/* Category list */}
          {categories.map((cat) => (
            <Card key={cat.categoryId} className="p-4">
              {/* Category header */}
              <div className="flex items-center gap-2">
                <Icon name="folder" className="w-4 h-4 text-accent shrink-0" />
                {editCat?.id === cat.categoryId ? (
                  <input
                    autoFocus
                    value={editCat.name}
                    onChange={(e) =>
                      setEditCat({ ...editCat, name: e.target.value })
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveCat(cat.categoryId);
                      if (e.key === "Escape") setEditCat(null);
                    }}
                    className="flex-1 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-1 text-sm bg-white dark:bg-zinc-900 focus:outline-none focus:border-accent font-medium"
                  />
                ) : (
                  <span className="flex-1 font-medium text-zinc-800 dark:text-zinc-100">
                    {cat.name}
                  </span>
                )}
                {editCat?.id === cat.categoryId ? (
                  <>
                    <GuardButton
                      size="sm"
                      onClick={() => saveCat(cat.categoryId)}
                      disabled={putCategory.isPending || postCategory.isPending}
                    >
                      Guardar
                    </GuardButton>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditCat(null)}
                    >
                      Cancelar
                    </Button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() =>
                        setEditCat({ id: cat.categoryId, name: cat.name })
                      }
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                      title="Editar"
                    >
                      <Icon name="edit" className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() =>
                        setTransModal({
                          id: cat.categoryId,
                          name: cat.name,
                          translations: cat.translations ?? {},
                          type: "cat",
                        })
                      }
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-accent hover:bg-accent/10 transition"
                      title="Traduções"
                    >
                      <Icon name="globe" className="w-3.5 h-3.5" />
                    </button>
                    <GuardIconButton
                      icon="trash"
                      label="Eliminar categoria"
                      title="Eliminar"
                      onClick={async () => {
                        if (await confirmDialog({ title: `Eliminar categoria "${cat.name}"?`, message: "As subcategorias e a associação aos produtos são afetadas.", danger: true }))
                          delCategory.mutate({ id: cat.categoryId });
                      }}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition"
                    />
                  </>
                )}
              </div>

              {/* Subcategories */}
              <div className="mt-2.5 ml-6 space-y-1.5">
                {(cat.subcategories ?? []).map((sub) => (
                  <div
                    key={sub.subcategoryId}
                    className="flex items-center gap-2"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-600 shrink-0" />
                    {editSub?.id === sub.subcategoryId ? (
                      <input
                        autoFocus
                        value={editSub.name}
                        onChange={(e) =>
                          setEditSub({ ...editSub, name: e.target.value })
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter")
                            saveSub(sub.subcategoryId, cat.categoryId);
                          if (e.key === "Escape") setEditSub(null);
                        }}
                        className="flex-1 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-0.5 text-sm bg-white dark:bg-zinc-900 focus:outline-none focus:border-accent"
                      />
                    ) : (
                      <span className="flex-1 text-sm text-zinc-700 dark:text-zinc-300">
                        {sub.name}
                      </span>
                    )}
                    {editSub?.id === sub.subcategoryId ? (
                      <>
                        <GuardButton
                          size="sm"
                          onClick={() =>
                            saveSub(sub.subcategoryId, cat.categoryId)
                          }
                          disabled={putSubcategory.isPending || postSubcategory.isPending}
                        >
                          Guardar
                        </GuardButton>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditSub(null)}
                        >
                          Cancelar
                        </Button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() =>
                            setEditSub({
                              id: sub.subcategoryId,
                              name: sub.name,
                              categoryId: cat.categoryId,
                            })
                          }
                          className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                          title="Editar"
                        >
                          <Icon name="edit" className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() =>
                            setTransModal({
                              id: sub.subcategoryId,
                              name: sub.name,
                              translations: sub.translations ?? {},
                              type: "sub",
                              categoryId: cat.categoryId,
                            })
                          }
                          className="p-1 rounded text-zinc-400 hover:text-accent hover:bg-accent/10 transition"
                          title="Traduções"
                        >
                          <Icon name="globe" className="w-3 h-3" />
                        </button>
                        <GuardIconButton
                          icon="trash"
                          label="Eliminar subcategoria"
                          title="Eliminar"
                          onClick={async () => {
                            if (await confirmDialog({ title: `Eliminar subcategoria "${sub.name}"?`, danger: true }))
                              delSubcategory.mutate({ id: sub.subcategoryId });
                          }}
                          className="p-1 rounded text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition"
                        />
                      </>
                    )}
                  </div>
                ))}

                {/* Add subcategory */}
                {newSubCatId === cat.categoryId ? (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700 shrink-0" />
                    <input
                      autoFocus
                      value={newSubName}
                      onChange={(e) => setNewSubName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveSub(null, cat.categoryId);
                        if (e.key === "Escape") {
                          setNewSubCatId(null);
                          setNewSubName("");
                        }
                      }}
                      placeholder="Nome da subcategoria…"
                      className="flex-1 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-0.5 text-sm bg-white dark:bg-zinc-900 focus:outline-none focus:border-accent"
                    />
                    <GuardButton
                      size="sm"
                      onClick={() => saveSub(null, cat.categoryId)}
                      disabled={putSubcategory.isPending || postSubcategory.isPending}
                    >
                      Criar
                    </GuardButton>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setNewSubCatId(null);
                        setNewSubName("");
                      }}
                    >
                      Cancelar
                    </Button>
                  </div>
                ) : (
                  <GuardButton
                    variant="ghost"
                    size="sm"
                    icon="plus"
                    onClick={() => {
                      setNewSubCatId(cat.categoryId);
                      setNewSubName("");
                    }}
                    className="mt-1"
                  >
                    Nova subcategoria
                  </GuardButton>
                )}
              </div>
            </Card>
          ))}

          {categories.length === 0 && !newCatVisible && (
            <p className="text-sm text-zinc-400 py-12 text-center">
              Sem categorias ainda. Cria a primeira!
            </p>
          )}
        </div>

      {transModal && (
        <Modal
          open
          onClose={() => setTransModal(null)}
          title={`Traduções — ${transModal.name}`}
          footer={
            <>
              <Button variant="ghost" onClick={() => setTransModal(null)}>
                Cancelar
              </Button>
              <GuardButton
                onClick={saveTranslations}
                disabled={putCategory.isPending || putSubcategory.isPending}
              >
                Guardar
              </GuardButton>
            </>
          }
        >
          <TranslationInputs
            value={transModal.translations}
            onChange={(translations) =>
              setTransModal((m) => (m ? { ...m, translations } : null))
            }
            fields={["name"]}
            namePlaceholder="Nome traduzido"
          />
        </Modal>
      )}
    </>
  );
}
