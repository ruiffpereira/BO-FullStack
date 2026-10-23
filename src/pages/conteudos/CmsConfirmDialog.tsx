import { ConfirmDialog } from "../../components/ConfirmDialog";
import { ConfirmAction } from "./model";

/** Confirmação de apagar entrada / secção / entradas visíveis. */
export function CmsConfirmDialog({ confirmAction, isPending, onClose, onConfirm }: {
  confirmAction: ConfirmAction | null;
  isPending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
      <ConfirmDialog
        open={!!confirmAction}
        onClose={onClose}
        onConfirm={onConfirm}
        isPending={isPending}
        title={
          confirmAction?.type === "deleteEntry"
            ? `Eliminar entrada?`
            : confirmAction?.type === "deleteSection"
              ? `Eliminar secção?`
              : `Eliminar ${confirmAction?.count ?? 0} ${(confirmAction?.count ?? 0) === 1 ? "entrada" : "entradas"}?`
        }
        description={
          confirmAction?.type === "deleteEntry" ? (
            <>
              A entrada{" "}
              <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded">
                {confirmAction.key}
              </code>{" "}
              e todas as suas traduções serão eliminadas permanentemente.
            </>
          ) : confirmAction?.type === "deleteSection" ? (
            <>
              A secção <strong>"{confirmAction.section.name}"</strong> será
              eliminada. As entradas dentro desta secção ficam sem secção
              atribuída.
            </>
          ) : (
            <>
              As {confirmAction?.count} entradas visíveis serão eliminadas
              permanentemente. As que estiverem em uso por produtos ou serviços
              serão ignoradas automaticamente.
            </>
          )
        }
        confirmLabel="Eliminar"
        pendingLabel="A eliminar…"
      />
  );
}
