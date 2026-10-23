import { useState, useEffect, useRef } from "react";
import { CmsCombo } from "../../components/CmsCombo";
import { toast } from "sonner";
import { Icon } from "../../ui/icons.jsx";
import { Button, Input, Modal, ImgPlaceholder } from "../../ui/ui.jsx";
import { GuardButton } from "../../components/GuardButton";
import { useTeamAccess } from "../../hooks/useTeamAccess";
import { Combobox } from "../../components/Combobox";
import type { Product } from "../../gen/backoffice/types/Product.js";
import type { ProductImage } from "../../gen/backoffice/types/ProductImage.js";
import { pickImageFile } from "../../lib/filePicker";
import { photoUrl } from "./ProdutoCard";

// ─── Modal ────────────────────────────────────────────────────────────────────

export type ProdForm = {
  name: string;
  description: string;
  reference: string;
  price: string;
  cost: string;
  vatRate: string;
  stock: string;
  categoryId: string;
  photo: ProductImage | null;
  photoFile: File | null;
  photoPreview: string | null;
  photoName: string;
  contentKey: string | null;
  descriptionKey: string | null;
};

const emptyForm: ProdForm = {
  name: "",
  description: "",
  reference: "",
  price: "",
  cost: "",
  vatRate: "",
  stock: "",
  categoryId: "",
  photo: null,
  photoFile: null,
  photoPreview: null,
  photoName: "",
  contentKey: null,
  descriptionKey: null,
};

export function ProdutoModal({
  open,
  produto,
  categories,
  onClose,
  onSave,
  isPending,
}: {
  open: boolean;
  produto: Product | null;
  categories: { categoryId: string; name: string }[];
  onClose: () => void;
  onSave: (form: ProdForm) => void;
  isPending: boolean;
  defaultLang: string;
}) {
  const [form, setForm] = useState<ProdForm>(emptyForm);
  // Equipa (B41 2b): o custo de compra é a folha `loja.produtos.custo`. Sem ver, o campo some (a API nem o envia);
  // só a ver, fica em leitura.
  const { can } = useTeamAccess();
  const showCost = can("loja.produtos.custo", "view");
  const editCost = can("loja.produtos.custo", "edit");
  const fileRef = useRef<HTMLInputElement>(null);

  // Reset form whenever the modal opens or the product changes
  useEffect(() => {
    if (!open) return;
    setForm(
      produto
        ? {
            name: produto.name ?? "",
            description: produto.description ?? "",
            reference: produto.reference ?? "",
            price: String(produto.price ?? ""),
            cost: produto.cost != null ? String(produto.cost) : "",
            vatRate: produto.vatRate != null ? String(produto.vatRate) : "",
            stock: String(produto.stock ?? 0),
            categoryId: produto.categoryId ?? "",
            photo: null,
            photoFile: null,
            photoPreview: null,
            photoName: "",
            contentKey: produto.contentKey ?? null,
            descriptionKey: produto.descriptionKey ?? null,
          }
        : emptyForm,
    );
  }, [open, produto]);

  const set =
    (k: keyof ProdForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));


  const previewSrc =
    form.photoPreview ?? photoUrl(form.photo) ?? photoUrl(produto?.photos?.[0]) ?? null;
  const isBusy = isPending;

  const handlePhotoChange = (file: File) => {
    // Upload diferido: guarda o ficheiro localmente; só envia ao "Guardar".
    setForm((f) => {
      if (f.photoPreview) URL.revokeObjectURL(f.photoPreview);
      return {
        ...f,
        photoFile: file,
        photoName: file.name,
        photoPreview: URL.createObjectURL(file),
        photo: null,
      };
    });
  };

  const openPhotoPicker = async () => {
    if (isBusy) return;
    try {
      const file = await pickImageFile();
      if (file === undefined) {
        fileRef.current?.click();
        return;
      }
      if (file) handlePhotoChange(file);
    } catch (e: any) {
      if (e?.name !== "AbortError") toast.error("Erro ao escolher imagem");
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={produto ? "Editar produto" : "Novo produto"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isBusy}>
            Cancelar
          </Button>
          <GuardButton onClick={() => onSave(form)} disabled={isBusy || !form.name.trim()}>
            {isPending ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2 align-middle" />
                A guardar…
              </>
            ) : produto ? (
              "Guardar"
            ) : (
              "Adicionar"
            )}
          </GuardButton>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-4">
          <div className="w-28 shrink-0">
            <div className="relative h-28 w-28 overflow-hidden rounded-lg">
              {previewSrc ? (
                <img
                  src={previewSrc}
                  alt="preview"
                  className="h-28 w-28 object-cover"
                />
              ) : (
                <ImgPlaceholder label="foto" tint="#2A6FDB" className="h-28" />
              )}
              {isBusy && (
                <div className="absolute inset-0 bg-black/55 flex items-center justify-center">
                  <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                </div>
              )}
            </div>
            <button
              type="button"
              disabled={isBusy}
              className="mt-2 w-full text-xs text-accent font-medium flex items-center justify-center gap-1 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={openPhotoPicker}
            >
              <Icon name="image" className="w-3.5 h-3.5" />
              {isBusy
                ? "A guardar..."
                : form.photoName
                  ? `${form.photoName.slice(0, 12)}...`
                  : "Carregar foto"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              disabled={isBusy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handlePhotoChange(file);
                e.target.value = "";
              }}
            />
          </div>
          <div className="flex-1 space-y-3">
            <CmsCombo
              label="Nome"
              context="product"
              value={form.contentKey}
              name={form.name}
              onChange={(key, nm) => setForm((f) => ({ ...f, contentKey: key, name: nm }))}
            />
            <Input
              label="Referência"
              placeholder="PM-001"
              value={form.reference}
              onChange={set("reference")}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Combobox
            label="Categoria"
            value={form.categoryId}
            onChange={(v) => setForm((f) => ({ ...f, categoryId: v }))}
            options={[
              { value: "", label: "Sem categoria" },
              ...categories.map((c) => ({ value: c.categoryId, label: c.name })),
            ]}
            placeholder="Sem categoria"
            searchPlaceholder="Pesquisar categoria…"
          />
          <Input
            label="Preço (€)"
            type="number"
            placeholder="14.90"
            value={form.price}
            onChange={set("price")}
          />
          <Input
            label="Stock"
            type="number"
            placeholder="0"
            value={form.stock}
            onChange={set("stock")}
          />
          {showCost && (
            <Input
              label="Custo (€)"
              type="number"
              placeholder="0.00"
              value={form.cost}
              onChange={set("cost")}
              disabled={!editCost}
              title={!editCost ? "Só tens permissão para ver" : undefined}
            />
          )}
          <Input
            label="IVA (%)"
            type="number"
            placeholder="23"
            value={form.vatRate}
            onChange={set("vatRate")}
          />
        </div>
        <CmsCombo
          label="Descrição (opcional)"
          context="product"
          value={form.descriptionKey}
          name={form.description}
          onChange={(key, nm) => setForm((f) => ({ ...f, descriptionKey: key, description: nm }))}
        />
      </div>
    </Modal>
  );
}
