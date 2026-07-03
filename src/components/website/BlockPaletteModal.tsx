import { Modal, Card } from "../../ui/ui.jsx";
import { BLOCK_SCHEMAS, BLOCK_GROUPS } from "../../lib/blockCatalog";

/**
 * Grelha de tipos de bloco a acrescentar a uma página (mirror do padrão de
 * cartões da tab Template, sem miniatura — só label + descrição), agrupada em
 * "Conteúdo / marketing" e "Funcionais".
 */
export function BlockPaletteModal({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (type: string) => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Adicionar bloco"
      subtitle="Escolhe o tipo de bloco a acrescentar a esta página."
      width="max-w-2xl"
    >
      <div className="space-y-6">
        {BLOCK_GROUPS.map((group) => {
          const schemas = BLOCK_SCHEMAS.filter((s) => s.group === group.id);
          if (schemas.length === 0) return null;
          return (
            <div key={group.id}>
              <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">
                {group.label}
              </h4>
              <div className="grid gap-2 sm:grid-cols-2">
                {schemas.map((s) => (
                  <button
                    key={s.type}
                    type="button"
                    onClick={() => onPick(s.type)}
                    className="text-left rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 group"
                  >
                    <Card className="p-3 h-full transition-colors group-hover:border-accent/40">
                      <p className="font-semibold text-sm text-zinc-900 dark:text-white">{s.label}</p>
                      <p className="text-xs text-zinc-500 mt-1 leading-snug">{s.description}</p>
                    </Card>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
