import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { ensureCmsName } from "../../lib/gymCms";
import { toast } from "sonner";
import { getApiError } from "../../lib/apiError";
import { useQueryClient } from "@tanstack/react-query";
import { getProductsQueryKey } from "../../gen/backoffice/hooks/useGetProducts.js";
import { usePostProducts } from "../../gen/backoffice/hooks/usePostProducts.js";
import { usePutProductsId } from "../../gen/backoffice/hooks/usePutProductsId.js";
import { useDeleteProductsId } from "../../gen/backoffice/hooks/useDeleteProductsId.js";
import type { Product } from "../../gen/backoffice/types/Product.js";
import { uploadImage } from "../../gen/backoffice/hooks/useUploadImage.js";
import { queryKeys } from "../../lib/queryKeys";
import { ProdForm } from "./ProdutoModal";

/** Criar/editar/eliminar produtos: estado do modal, gravação (CMS + foto diferida) e o deep-link `?openProduct=`. */
export function useProductEditor({ canEditCost, defaultLang, products }: { canEditCost: boolean; defaultLang: string; products: Product[] }) {
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);

  const invalidateProducts = () =>
    qc.invalidateQueries({ queryKey: getProductsQueryKey() });

  const createProduct = usePostProducts({
    mutation: {
      onSuccess: () => {
        toast.success("Produto criado");
        invalidateProducts();
        qc.invalidateQueries({ queryKey: queryKeys.cmsReferencesCounts.root });
        setModal(false);
      },
      onError: (e) => toast.error(getApiError(e, "Erro ao criar produto")),
    },
  });

  const updateProduct = usePutProductsId({
    mutation: {
      onSuccess: () => {
        toast.success("Produto actualizado");
        invalidateProducts();
        qc.invalidateQueries({ queryKey: queryKeys.cmsReferencesCounts.root });
        setModal(false);
      },
      onError: (e) => toast.error(getApiError(e, "Erro ao actualizar produto")),
    },
  });

  const deleteProduct = useDeleteProductsId({
    mutation: {
      onSuccess: () => {
        toast.success("Produto eliminado");
        invalidateProducts();
      },
      onError: (e) => toast.error(getApiError(e, "Erro ao eliminar produto")),
    },
  });

  const openEdit = useCallback((prod: Product) => {
    setEditing(prod);
    setModal(true);
  }, []);
  const openNew = () => {
    setEditing(null);
    setModal(true);
  };

  useEffect(() => {
    const id = searchParams.get("openProduct");
    if (!id || products.length === 0) return;
    const prod = products.find((p) => p.productId === id);
    if (prod) { openEdit(prod); setSearchParams({}, { replace: true }); }
  }, [searchParams, products, openEdit, setSearchParams]);
  const closeModal = () => {
    if (saving) return;
    setModal(false);
    setEditing(null);
  };

  const handleSave = async (form: ProdForm) => {
    if (!form.name.trim()) {
      toast.error("O nome do produto é obrigatório");
      return;
    }
    setSaving(true);
    try {
      // Cria/atualiza as entradas CMS (nome obrigatório, descrição opcional) ao guardar.
      const contentKey = await ensureCmsName(form.contentKey, "product", form.name, defaultLang);
      const descriptionKey = form.description.trim()
        ? await ensureCmsName(form.descriptionKey, "product", form.description, defaultLang)
        : null;
      // Upload diferido: envia a foto pendente só agora, ao guardar.
      let photoPayload = form.photo ? [form.photo] : undefined;
      if (form.photoFile) {
        try {
          const uploaded = await uploadImage({ image: form.photoFile, module: "products" });
          photoPayload = [uploaded];
        } catch (e: any) {
          toast.error(e?.message ?? "Erro ao carregar imagem");
          return;
        }
      }

      if (editing) {
        await updateProduct.mutateAsync({
          id: editing.productId,
          data: {
            reference: form.reference || undefined,
            price: form.price ? Number(form.price) : undefined,
            cost: canEditCost && form.cost !== "" ? Number(form.cost) : undefined,
            vatRate: form.vatRate !== "" ? Number(form.vatRate) : undefined,
            stock: form.stock !== "" ? Number(form.stock) : undefined,
            categoryId: form.categoryId || undefined,
            photos: photoPayload,
            contentKey,
            descriptionKey,
          },
        });
      } else {
        await createProduct.mutateAsync({
          data: {
            reference: form.reference || undefined,
            // A API valida o preço (obrigatório): vazio segue como `undefined` e recebe o 400, não um 0 €.
            price: (form.price ? Number(form.price) : undefined) as number,
            cost: canEditCost && form.cost !== "" ? Number(form.cost) : undefined,
            vatRate: form.vatRate !== "" ? Number(form.vatRate) : undefined,
            stock: form.stock !== "" ? Number(form.stock) : undefined,
            categoryId: form.categoryId || undefined,
            photos: photoPayload,
            contentKey,
            descriptionKey,
          },
        });
      }
    } catch (e) {
      // mutateAsync rejeita quando a API devolve erro — onError já mostra o toast,
      // mas capturamos aqui para evitar unhandled promise rejection
      if (!(e as any)?.name?.includes("Axios") && !(e as any)?.isAxiosError) {
        toast.error(e instanceof Error ? e.message : "Erro ao guardar produto");
      }
    } finally {
      setSaving(false);
    }
  };

  const isPending =
    saving || createProduct.isPending || updateProduct.isPending;

  return { modal, editing, openEdit, openNew, closeModal, handleSave, isPending, deleteProduct };
}
