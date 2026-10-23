import { useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { getApiError } from "../../lib/apiError";
import { pickImageFile, supportsFilePicker } from "../../lib/filePicker";
import { getCmsEntriesQueryKey } from "../../gen/backoffice/hooks/useGetCmsEntries.js";
import { putCmsEntries } from "../../gen/backoffice/hooks/usePutCmsEntries.js";
import { uploadImage } from "../../gen/backoffice/hooks/useUploadImage.js";
import { toSlug } from "../../utils/slug";
import { ConteudosView, EntryForm, GroupedEntry, emptyEntry } from "./model";
import type { PutCmsEntriesMutationRequestTypeEnum } from "../../gen/backoffice/types/PutCmsEntries.js";

/** Estado e acções do modal de entrada: abrir/fechar, traduções, imagens com upload diferido e gravação. */
export function useEntryEditor({ activeTab, LOCALES, selectedSectionId, allEntries }: {
  activeTab: ConteudosView;
  LOCALES: string[];
  selectedSectionId: string | null;
  allEntries: { key: string; sectionId?: string | null }[];
}) {
  const qc = useQueryClient();
  const [entryModal, setEntryModal] = useState(false);
  const [editEntryKey, setEditEntryKey] = useState<string | null>(null);
  const [entryForm, setEntryForm] = useState<EntryForm>(emptyEntry(null));
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  // Upload diferido: ficheiros escolhidos mas ainda não enviados (por índice de tradução).
  const [pendingFiles, setPendingFiles] = useState<Record<number, File>>({});

  const saveEntryMut = useMutation({
    mutationFn: async (f: EntryForm) => {
      const toSave = f.translations.filter((t) => t.value.trim());
      if (!toSave.length) throw new Error("Adiciona pelo menos um valor");
      for (const t of toSave) {
        await putCmsEntries({
          key: f.key.trim(),
          locale: t.locale || null,
          value: t.value,
          type: f.type as PutCmsEntriesMutationRequestTypeEnum,
          sectionId: f.sectionId,
        });
      }
    },
    onSuccess: () => {
      toast.success("Entrada guardada");
      qc.invalidateQueries({ queryKey: getCmsEntriesQueryKey() });
      closeEntryModal();
    },
    onError: (e: any) => toast.error(e.message ?? getApiError(e)),
  });

  const buildTranslationsForLocales = (existing: Record<string, string>) => {
    const locales = LOCALES.length
      ? LOCALES
      : Object.keys(existing).filter((k) => k !== "_");
    const rows = locales.map((locale) => ({
      locale,
      value: existing[locale] ?? "",
    }));
    // Locales not in LOCALES are kept in the DB but not shown in the UI
    return rows.length ? rows : [{ locale: "", value: "" }];
  };

  const closeEntryModal = () => {
    setEntryModal(false);
    setEditEntryKey(null);
    setPendingFiles({});
    setEntryForm({
      ...emptyEntry(selectedSectionId),
      translations: LOCALES.length
        ? LOCALES.map((l) => ({ locale: l, value: "" }))
        : [{ locale: "", value: "" }],
    });
  };

  const openCreateEntry = () => {
    setEditEntryKey(null);
    setPendingFiles({});
    setEntryForm({
      ...emptyEntry(selectedSectionId),
      translations: LOCALES.length
        ? LOCALES.map((l) => ({ locale: l, value: "" }))
        : [{ locale: "", value: "" }],
    });
    setEntryModal(true);
  };

  const openEditEntry = (grp: GroupedEntry) => {
    setEditEntryKey(grp.key);
    setPendingFiles({});
    const entry = allEntries.find((e) => e.key === grp.key);
    setEntryForm({
      key: grp.key,
      type: grp.type,
      sectionId: entry?.sectionId ?? null,
      translations: buildTranslationsForLocales(grp.translations),
    });
    setEntryModal(true);
  };

  const setTranslation = (i: number, field: "locale" | "value", val: string) =>
    setEntryForm((f) => {
      const t = [...f.translations];
      t[i] = { ...t[i], [field]: val };
      return { ...f, translations: t };
    });

  const handleImagePick = (file: File, idx: number) => {
    // Upload diferido: guarda o ficheiro localmente e mostra preview; só envia ao "Guardar".
    const url = URL.createObjectURL(file);
    setEntryForm((f) => {
      const t = [...f.translations];
      const old = t[idx]?.value;
      if (old && old.startsWith("blob:")) URL.revokeObjectURL(old);
      if (t[idx]) t[idx] = { ...t[idx], value: url };
      return { ...f, translations: t };
    });
    setPendingFiles((p) => ({ ...p, [idx]: file }));
  };

  const handleImagePickerClick = async (e: React.MouseEvent, idx: number) => {
    if (uploadingIdx === idx || !supportsFilePicker()) return;
    e.preventDefault();
    try {
      const file = await pickImageFile();
      if (file) handleImagePick(file, idx);
    } catch {
      toast.error("Erro ao escolher imagem");
    }
  };

  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    let form = entryForm;

    // Upload diferido: envia as imagens pendentes só agora, ao guardar.
    const pendingIdxs = Object.keys(pendingFiles).map(Number);
    if (pendingIdxs.length) {
      try {
        const translations = [...form.translations];
        for (const idx of pendingIdxs) {
          const file = pendingFiles[idx];
          if (!file) continue;
          setUploadingIdx(idx);
          const { fileUrl } = await uploadImage({ image: file, module: "cms" });
          const old = translations[idx]?.value;
          if (old && old.startsWith("blob:")) URL.revokeObjectURL(old);
          if (translations[idx])
            translations[idx] = { ...translations[idx], value: fileUrl };
        }
        form = { ...form, translations };
        setEntryForm(form);
        setPendingFiles({});
      } catch (err: any) {
        toast.error(err?.message ?? "Erro ao carregar imagem");
        return;
      } finally {
        setUploadingIdx(null);
      }
    }

    if (
      !form.key.trim() &&
      !editEntryKey &&
      (activeTab === "product" ||
        activeTab === "service" ||
        activeTab === "gym")
    ) {
      const firstValue =
        form.translations.find((t) => t.value.trim())?.value ?? "";
      const slug = firstValue ? toSlug(firstValue) : `${Date.now()}`;
      form = { ...form, key: `${activeTab}.${slug}`, type: "text" };
    }
    if (!form.key.trim()) {
      toast.error("A key é obrigatória");
      return;
    }
    saveEntryMut.mutate(form);
  };

  return {
    entryModal, editEntryKey, entryForm, setEntryForm, uploadingIdx, saveEntryMut, closeEntryModal,
    openCreateEntry, openEditEntry, setTranslation, handleImagePick, handleImagePickerClick, handleSaveEntry,
  };
}
