import type { Dispatch, SetStateAction } from "react";
import { Modal, Input, Button } from "../../ui/ui.jsx";
import { GuardButton } from "../../components/GuardButton";
import { Combobox } from "../../components/Combobox";
import { CMS_TABS, ConteudosView, Section, SectionForm } from "./model";

/** Modal de criar/editar uma secção. */
export function SectionModal({ editSection, sections, sectionForm, setSectionForm, activeTab, isSaving, onClose, onSubmit }: {
  editSection: Section | null;
  sections: Section[];
  sectionForm: SectionForm;
  setSectionForm: Dispatch<SetStateAction<SectionForm>>;
  activeTab: ConteudosView;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
        <Modal
          open
          onClose={onClose}
          title={
            editSection
              ? "Editar secção"
              : `Nova secção — ${CMS_TABS.find((t) => t.id === activeTab)?.label}`
          }
          width="max-w-sm"
          footer={
            <>
              <Button variant="ghost" onClick={onClose}>
                Cancelar
              </Button>
              <GuardButton
                type="submit"
                form="cms-section-form"
                isLoading={isSaving}
              >
                Guardar
              </GuardButton>
            </>
          }
        >
          <form
            id="cms-section-form"
            onSubmit={onSubmit}
            className="space-y-3"
          >
            <Input
              label="Nome"
              value={sectionForm.name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setSectionForm((f) => ({ ...f, name: e.target.value }))
              }
              placeholder="Homepage, Hero, Serviços…"
            />
            {sections.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Secção pai (opcional)
                </label>
                <Combobox
                  value={sectionForm.parentId ?? ""}
                  onChange={(v) =>
                    setSectionForm((f) => ({ ...f, parentId: v || null }))
                  }
                  options={[
                    { value: "", label: "Raiz (sem pai)" },
                    ...sections
                      .filter((s) => s.sectionId !== editSection?.sectionId)
                      .map((s) => ({ value: s.sectionId, label: s.name })),
                  ]}
                  placeholder="Raiz (sem pai)"
                  searchPlaceholder="Pesquisar secção…"
                />
              </div>
            )}
          </form>
        </Modal>
  );
}
