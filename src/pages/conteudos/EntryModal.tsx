import type { Dispatch, SetStateAction } from "react";
import { Icon } from "../../ui/icons.jsx";
import { Modal, Button } from "../../ui/ui.jsx";
import { GuardButton } from "../../components/GuardButton";
import { RichTextEditor } from "../../components/RichTextEditor";
import { Combobox } from "../../components/Combobox";
import { ConteudosView, EntryForm, Section, inputCls, localeLabel } from "./model";

/** Modal de criar/editar uma entrada (traduções por língua; imagens com upload diferido). */
export function EntryModal({
  entryForm, setEntryForm, editEntryKey, activeTab, sections, defaultLang, uploadingIdx, isSaving,
  onClose, onSubmit, setTranslation, onPickImage, onPickerClick,
}: {
  entryForm: EntryForm;
  setEntryForm: Dispatch<SetStateAction<EntryForm>>;
  editEntryKey: string | null;
  activeTab: ConteudosView;
  sections: Section[];
  defaultLang: string;
  uploadingIdx: number | null;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  setTranslation: (i: number, field: "locale" | "value", val: string) => void;
  onPickImage: (file: File, idx: number) => void;
  onPickerClick: (e: React.MouseEvent, idx: number) => void;
}) {
  return (
        <Modal
          open
          onClose={onClose}
          title={editEntryKey ? "Editar entrada" : "Nova entrada"}
          width={entryForm.type === "richtext" ? "max-w-3xl" : "max-w-lg"}
          footer={
            <>
              <Button variant="ghost" onClick={onClose}>
                Cancelar
              </Button>
              <GuardButton
                type="submit"
                form="cms-entry-form"
                isLoading={isSaving}
              >
                Guardar
              </GuardButton>
            </>
          }
        >
          <form
            id="cms-entry-form"
            onSubmit={onSubmit}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-3">
              {activeTab === "website" && (
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Key
                  </label>
                  <input
                    value={entryForm.key}
                    onChange={(e) =>
                      !editEntryKey &&
                      setEntryForm((f) => ({ ...f, key: e.target.value }))
                    }
                    readOnly={!!editEntryKey}
                    placeholder="hero.title"
                    className={`${inputCls} ${editEntryKey ? "opacity-60 cursor-default" : ""}`}
                  />
                </div>
              )}
              {activeTab === "website" && (
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Tipo
                  </label>
                  <Combobox
                    value={entryForm.type}
                    onChange={(v) => setEntryForm((f) => ({ ...f, type: v }))}
                    options={[
                      { value: "text", label: "Texto" },
                      // "Texto rico" foi RETIRADO da escolha (2026-08-24). O tipo
                      // `richtext` nunca funcionou: a API remove TODO o HTML de
                      // qualquer corpo de pedido (`applySanitization`, DOMPurify
                      // com `ALLOWED_TAGS: []`), incluindo na importação de CSV —
                      // qualquer <em>/<strong>/<h2> era destruído em silêncio, com
                      // 200 OK. Oferecer a opção prometia uma coisa que a
                      // plataforma não faz. As entradas `richtext` que já existem
                      // continuam a ser LIDAS e editadas normalmente (os ramos de
                      // render abaixo mantêm-se) — só não se criam novas.
                      { value: "image", label: "Imagem" },
                    ]}
                  />
                </div>
              )}
              {sections.length > 0 && (
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Secção
                  </label>
                  <Combobox
                    value={entryForm.sectionId ?? ""}
                    onChange={(v) =>
                      setEntryForm((f) => ({ ...f, sectionId: v || null }))
                    }
                    options={[
                      { value: "", label: "Sem secção" },
                      ...sections.map((s) => ({
                        value: s.sectionId,
                        label: s.name,
                      })),
                    ]}
                    placeholder="Sem secção"
                    searchPlaceholder="Pesquisar secção…"
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Traduções
              </p>

              {entryForm.translations.map((t, i) => (
                <div
                  key={i}
                  className={`flex gap-2 ${entryForm.type === "image" || entryForm.type === "richtext" ? "items-start" : "items-center"}`}
                >
                  <span
                    className={`shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg text-xs font-bold ${
                      t.locale === defaultLang
                        ? "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
                    }`}
                  >
                    {t.locale ? localeLabel(t.locale) : "—"}
                  </span>

                  {entryForm.type === "text" ? (
                    <textarea
                      value={t.value}
                      onChange={(e) => {
                        setTranslation(i, "value", e.target.value);
                        e.target.style.height = "auto";
                        e.target.style.height = `${Math.min(e.target.scrollHeight, 320)}px`;
                      }}
                      onFocus={(e) => {
                        e.target.style.height = "auto";
                        e.target.style.height = `${Math.min(e.target.scrollHeight, 320)}px`;
                      }}
                      placeholder="Valor…"
                      rows={3}
                      className={`${inputCls} flex-1 resize-none overflow-y-auto min-h-[80px] max-h-[320px]`}
                    />
                  ) : entryForm.type === "richtext" ? (
                    <div className="flex-1">
                      <RichTextEditor
                        value={t.value}
                        onChange={(html) => setTranslation(i, "value", html)}
                      />
                    </div>
                  ) : entryForm.type === "image" ? (
                    <div className="flex-1 space-y-1.5">
                      <label
                        className={`block group ${uploadingIdx === i ? "cursor-not-allowed" : "cursor-pointer"}`}
                        onClick={(e) => onPickerClick(e, i)}
                      >
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          disabled={uploadingIdx === i}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) onPickImage(f, i);
                            e.target.value = "";
                          }}
                        />
                        {t.value ? (
                          <div className="relative h-28 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700">
                            <img
                              src={t.value}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                            <div
                              className={`absolute inset-0 transition-colors flex items-center justify-center ${uploadingIdx === i ? "bg-black/55" : "bg-black/0 group-hover:bg-black/50"}`}
                            >
                              <span
                                className={`text-white text-xs font-medium transition-opacity flex items-center gap-1.5 ${uploadingIdx === i ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                              >
                                {uploadingIdx === i ? (
                                  <>
                                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />{" "}
                                    A carregar...
                                  </>
                                ) : (
                                  <>
                                    <Icon name="image" className="w-4 h-4" />{" "}
                                    Trocar imagem
                                  </>
                                )}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="h-28 rounded-lg border-2 border-dashed border-zinc-200 dark:border-zinc-700 group-hover:border-accent transition-colors flex flex-col items-center justify-center gap-2">
                            {uploadingIdx === i ? (
                              <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                            ) : (
                              <>
                                <Icon
                                  name="image"
                                  className="w-6 h-6 text-zinc-300 dark:text-zinc-600 group-hover:text-accent transition-colors"
                                />
                                <span className="text-xs text-zinc-400 group-hover:text-accent transition-colors">
                                  Clica para carregar imagem
                                </span>
                              </>
                            )}
                          </div>
                        )}
                      </label>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </form>
        </Modal>
  );
}
