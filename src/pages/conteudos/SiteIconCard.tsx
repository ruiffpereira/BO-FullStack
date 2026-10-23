import { useState, useEffect, useRef } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { getApiError } from "../../lib/apiError";
import { Card, Button, ImgPlaceholder } from "../../ui/ui.jsx";
import { GuardButton } from "../../components/GuardButton";
import { getCmsEntriesQueryKey } from "../../gen/backoffice/hooks/useGetCmsEntries.js";
import { putCmsEntries } from "../../gen/backoffice/hooks/usePutCmsEntries.js";
import { useDeleteCmsEntriesKey } from "../../gen/backoffice/hooks/useDeleteCmsEntriesKey.js";
import { uploadImage } from "../../gen/backoffice/hooks/useUploadImage.js";
import { ContentEntry, SITE_ICON_KEY } from "./model";

/**
 * Cartão fixo "Ícone do site", no topo do contexto "Website". Reutiliza os
 * MESMOS hooks de CMS que o resto da página (`putCmsEntries` / `useDeleteCmsEntriesKey`)
 * — não é um endpoint novo, é uma entrada CMS como outra qualquer, só com UI dedicada.
 *
 * Upload diferido (regra do CLAUDE.md): escolher ficheiro só gera preview local
 * (`blob:`); o upload para `/api/uploads` (module=branding, preset=icon → PNG
 * quadrado 512x512) só acontece ao carregar em "Guardar", que também grava a
 * entrada CMS. "Remover" sem ficheiro pendente apaga a entrada (fallback automático
 * para as iniciais do negócio); com ficheiro pendente só descarta a escolha local.
 */
export function SiteIconCard({
  entries,
  locale,
}: {
  entries: ContentEntry[];
  locale: string;
}) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const iconEntry =
    entries.find((e) => e.key === SITE_ICON_KEY && e.locale === locale) ??
    entries.find((e) => e.key === SITE_ICON_KEY);
  const currentUrl = iconEntry?.value ?? null;

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // O valor do servidor mudou (guardámos ou outra sessão alterou) — larga
  // qualquer preview local por guardar, senão fica presa a um blob: obsoleto.
  useEffect(() => {
    setPendingFile(null);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, [currentUrl]);

  const pickFile = (file: File) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPendingFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const cancelPending = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPendingFile(null);
    setPreviewUrl(null);
  };

  const saveMut = useMutation({
    mutationFn: async (file: File) => {
      // `preset: "icon"` → a API devolve UM PNG quadrado 512×512 em vez das 3
      // variantes WebP: é o iOS que obriga (ignora WebP no apple-touch-icon).
      const { fileUrl } = await uploadImage({
        image: file,
        module: "branding",
        preset: "icon",
      });
      await putCmsEntries({
        key: SITE_ICON_KEY,
        locale,
        value: fileUrl,
        type: "image",
        sectionId: null,
      });
    },
    onSuccess: () => {
      toast.success("Ícone guardado");
      qc.invalidateQueries({ queryKey: getCmsEntriesQueryKey() });
    },
    onError: (e: any) => toast.error(e?.message ?? getApiError(e)),
  });

  const removeMut = useDeleteCmsEntriesKey({
    mutation: {
      onSuccess: () => {
        toast.success("Ícone removido");
        qc.invalidateQueries({ queryKey: getCmsEntriesQueryKey() });
      },
      onError: (e: any) => toast.error(getApiError(e)),
    },
  });

  const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) pickFile(file);
  };

  const handleRemove = () => {
    if (pendingFile) {
      cancelPending();
      return;
    }
    if (!currentUrl) return;
    removeMut.mutate({ key: SITE_ICON_KEY });
  };

  const displayUrl = previewUrl ?? currentUrl;
  const isSaving = saveMut.isPending;
  const isRemoving = removeMut.isPending;

  return (
    <Card className="p-4 sm:p-5 mb-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="shrink-0">
          {displayUrl ? (
            <img
              src={displayUrl}
              alt=""
              className="w-20 h-20 rounded-xl object-cover border border-zinc-200 dark:border-zinc-700"
            />
          ) : (
            <ImgPlaceholder
              label="ícone"
              className="w-20 h-20"
              rounded="rounded-xl"
            />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            Ícone do site
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 max-w-md">
            Imagem quadrada, mínimo 512×512. Aparece na tab do browser e no atalho
            do telemóvel. Sem ícone próprio, usamos as iniciais do negócio.
          </p>
          {pendingFile && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5">
              Por guardar — carrega em "Guardar" para aplicar.
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handlePick}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            icon="image"
            onClick={() => fileInputRef.current?.click()}
          >
            Escolher ficheiro
          </Button>
          {/* Apagar a entrada CMS é uma ESCRITA — por isso `GuardButton`, como
              todas as outras desta página. Descartar um ficheiro só escolhido
              (ainda por enviar) não é, mas o botão é o mesmo e não vale a pena
              dois: o guard só actua quando o billing está read-only, e aí
              também não interessa deixar guardar a seguir. */}
          {(currentUrl || pendingFile) && (
            <GuardButton
              type="button"
              variant="ghost"
              size="sm"
              icon="trash"
              onClick={handleRemove}
              isLoading={isRemoving}
              disabled={isSaving}
            >
              Remover
            </GuardButton>
          )}
          <GuardButton
            type="button"
            size="sm"
            onClick={() => pendingFile && saveMut.mutate(pendingFile)}
            disabled={!pendingFile || isSaving}
            isLoading={isSaving}
          >
            Guardar
          </GuardButton>
        </div>
      </div>
    </Card>
  );
}
