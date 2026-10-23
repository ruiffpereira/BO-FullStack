import { Icon } from "../../ui/icons.jsx";
import { Modal, Button } from "../../ui/ui.jsx";
import { useNavigate } from "react-router-dom";
import { useCmsReferences } from "../../hooks/useCmsReferences";

// ─── References modal ─────────────────────────────────────────────────────────

export function CmsReferencesModal({
  cmsKey,
  onClose,
}: {
  cmsKey: string;
  onClose: () => void;
}) {
  const { data, isLoading } = useCmsReferences(cmsKey, true);
  const navigate = useNavigate();
  const total =
    (data?.products.length ?? 0) +
    (data?.services.length ?? 0) +
    (data?.gym?.length ?? 0);

  const GYM_TYPE_LABEL: Record<string, string> = {
    exercise: "Exercício",
    group: "Grupo muscular",
    treino: "Treino",
    plano: "Plano",
  };

  // Rota do Ginásio (T2.5, sidebar com submenus) por tipo de referência:
  // exercícios/grupos musculares vivem na tab Exercícios (raiz `/ginasio` —
  // os grupos musculares geram-se num modal dentro dela), treinos e planos
  // têm rota própria.
  const GYM_TYPE_ROUTE: Record<string, string> = {
    exercise: "/ginasio",
    group: "/ginasio",
    treino: "/ginasio/treinos",
    plano: "/ginasio/planos",
  };

  const goTo = (path: string) => {
    onClose();
    navigate(path);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Associações"
      width="max-w-md"
      footer={
        <Button variant="ghost" onClick={onClose}>
          Fechar
        </Button>
      }
    >
      <p className="text-xs font-mono text-zinc-400 mb-4">{cmsKey}</p>
      {isLoading && (
        <p className="text-sm text-zinc-400 py-4 text-center">A carregar…</p>
      )}
      {!isLoading && total === 0 && (
        <p className="text-sm text-zinc-400 text-center py-4">
          Sem associações
        </p>
      )}
      {!isLoading && (data?.products.length ?? 0) > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2">
            Produtos
          </p>
          <div className="space-y-1">
            {data!.products.map((p) => (
              <button
                key={p.productId}
                type="button"
                onClick={() => goTo(`/loja?openProduct=${p.productId}`)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 hover:bg-zinc-100 dark:hover:bg-zinc-700/60 transition-colors text-sm text-left"
              >
                <Icon
                  name="store"
                  className="w-3.5 h-3.5 text-zinc-400 shrink-0"
                />
                <span className="flex-1 text-zinc-800 dark:text-zinc-100 truncate">
                  {p.name}
                </span>
                {p.contentKey === cmsKey && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent font-medium">
                    nome
                  </span>
                )}
                {p.descriptionKey === cmsKey && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent font-medium">
                    descrição
                  </span>
                )}
                <Icon
                  name="chevronRight"
                  className="w-3.5 h-3.5 text-zinc-300 dark:text-zinc-600 shrink-0"
                />
              </button>
            ))}
          </div>
        </div>
      )}
      {!isLoading && (data?.services.length ?? 0) > 0 && (
        <div>
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2">
            Serviços
          </p>
          <div className="space-y-1">
            {data!.services.map((s) => (
              <button
                key={s.serviceId}
                type="button"
                onClick={() => goTo(`/agenda?openService=${s.serviceId}`)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 hover:bg-zinc-100 dark:hover:bg-zinc-700/60 transition-colors text-sm text-left"
              >
                <Icon
                  name="scissors"
                  className="w-3.5 h-3.5 text-zinc-400 shrink-0"
                />
                <span className="flex-1 text-zinc-800 dark:text-zinc-100 truncate">
                  {s.name}
                </span>
                {s.contentKey === cmsKey && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent font-medium">
                    nome
                  </span>
                )}
                {s.descriptionKey === cmsKey && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent font-medium">
                    descrição
                  </span>
                )}
                <Icon
                  name="chevronRight"
                  className="w-3.5 h-3.5 text-zinc-300 dark:text-zinc-600 shrink-0"
                />
              </button>
            ))}
          </div>
        </div>
      )}
      {!isLoading && (data?.gym?.length ?? 0) > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2">
            Ginásio
          </p>
          <div className="space-y-1">
            {data!.gym.map((g) => (
              <button
                key={`${g.type}-${g.id}`}
                type="button"
                onClick={() => goTo(GYM_TYPE_ROUTE[g.type] ?? "/ginasio")}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 hover:bg-zinc-100 dark:hover:bg-zinc-700/60 transition-colors text-sm text-left"
              >
                <Icon name="trend" className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <span className="flex-1 text-zinc-800 dark:text-zinc-100 truncate">
                  {g.name}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent font-medium">
                  {GYM_TYPE_LABEL[g.type] ?? g.type}
                </span>
                <Icon
                  name="chevronRight"
                  className="w-3.5 h-3.5 text-zinc-300 dark:text-zinc-600 shrink-0"
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
