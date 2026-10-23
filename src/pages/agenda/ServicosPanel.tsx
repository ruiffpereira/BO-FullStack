import { fmtEur } from "../../lib/money";
import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { getApiError } from "../../lib/apiError";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Icon } from "../../ui/icons.jsx";
import { Card, Button, IconButton, Badge, Modal, Input, Toggle } from "../../ui/ui.jsx";
import { GuardButton, GuardIconButton } from "../../components/GuardButton";
import { useWriteGuard } from "../../hooks/useWriteGuard";
import { useTeamAccess } from "../../hooks/useTeamAccess";
import { confirmDialog } from "../../components/confirm";
import { useGetScheduleServices, getScheduleServicesQueryKey } from "../../gen/backoffice/hooks/useGetScheduleServices.js";
import { useGetScheduleServicesId } from "../../gen/backoffice/hooks/useGetScheduleServicesId.js";
import { usePostScheduleServices } from "../../gen/backoffice/hooks/usePostScheduleServices.js";
import { usePutScheduleServicesId } from "../../gen/backoffice/hooks/usePutScheduleServicesId.js";
import { useDeleteScheduleServicesId } from "../../gen/backoffice/hooks/useDeleteScheduleServicesId.js";
import { patchScheduleServicesReorder } from "../../gen/backoffice/hooks/usePatchScheduleServicesReorder.js";
import { useGetSettingsLanguages } from "../../hooks/useSettingsLanguages";
import { CmsCombo } from "../../components/CmsCombo";
import { ensureCmsName } from "../../lib/gymCms";
import type { Service } from "../../gen/backoffice/types/Service.js";
import { queryKeys } from "../../lib/queryKeys";
import { SERVICE_COLORS, stableColorForId } from "./geometry";

// ─── Services panel ───────────────────────────────────────────────────────────
type SvcForm = {
  name: string;
  description: string;
  duration: string;
  price: string;
  active: boolean;
  color: string;
  contentKey: string | null;
  descriptionKey: string | null;
  /** «Disponível no site» (false = só se marca no Backoffice). */
  availableOnSite: boolean;
};
const emptySvcForm: SvcForm = {
  name: "",
  description: "",
  duration: "30",
  price: "",
  active: true,
  color: "#2A6FDB",
  contentKey: null,
  descriptionKey: null,
  availableOnSite: true,
};

export function ServicosPanel() {
  const { readOnly: writeLocked, message: writeMessage } = useWriteGuard();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState<SvcForm>(emptySvcForm);
  const { data: langData } = useGetSettingsLanguages();
  const defaultLang = langData?.default ?? "pt";
  const [localOrder, setLocalOrder] = useState<string[]>([]);
  const dragIndexRef = useRef<number | null>(null);
  // Distingue "o arrasto acabou com drop" de "o arrasto foi cancelado" — o
  // `handleDragEnd` dispara nos dois casos. Ver o comentário lá em baixo.
  const droppedRef = useRef(false);
  // Verdadeiro desde que um arrasto começa até o PATCH de reordenação
  // confirmar (ou falhar) — mesmo padrão do `touched` do `ContaCard`
  // (`Perfil.tsx`, commit `d1d1b11`). Sem isto, um refetch em fundo dos
  // serviços (`staleTime: 0`; o toggle activo/inactivo de outro serviço
  // desta MESMA lista, ou uma resposta lenta do PATCH anterior ainda a
  // caminho) apanhado a meio de um arrasto — ou entre o "largar" e a
  // confirmação — repunha a ordem do servidor por cima e "puxava o tapete"
  // ao arrasto em curso, ou ao próximo arrasto iniciado antes do primeiro
  // confirmar.
  const [touched, setTouched] = useState(false);

  const { data: services = [], isLoading } = useGetScheduleServices();
  // Profissionais: quem faz o serviço (só no GET por id) — a ficha mostra a lista; editar é em Profissionais.
  const { can: canTeamSvc } = useTeamAccess();
  const { data: svcDetail } = useGetScheduleServicesId(editing?.serviceId ?? "", {
    query: { enabled: modal && !!editing?.serviceId, retry: false },
  });
  const svcStaff = svcDetail?.staff ?? [];
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: getScheduleServicesQueryKey() });

  useEffect(() => {
    if (services.length && !touched) setLocalOrder(services.map((s) => s.serviceId));
  }, [services, touched]);

  const orderedServices = localOrder
    .map((id) => services.find((s) => s.serviceId === id))
    .filter((s): s is Service => !!s);

  const reorder = useMutation({
    mutationFn: (order: string[]) =>
      patchScheduleServicesReorder({ order }),
    onSuccess: () => {
      setTouched(false);
      invalidate();
    },
    onError: () => {
      toast.error("Erro ao reordenar");
      setTouched(false);
      setLocalOrder(services.map((s) => s.serviceId));
    },
  });

  const create = usePostScheduleServices({
    mutation: {
      onSuccess: () => {
        toast.success("Serviço criado");
        invalidate();
        qc.invalidateQueries({ queryKey: queryKeys.cmsReferencesCounts.root });
        setModal(false);
      },
      onError: (error) => toast.error(getApiError(error)),
    },
  });
  const update = usePutScheduleServicesId({
    mutation: {
      onSuccess: () => {
        toast.success("Serviço actualizado");
        invalidate();
        qc.invalidateQueries({ queryKey: queryKeys.cmsReferencesCounts.root });
        setModal(false);
      },
      onError: (error) => toast.error(getApiError(error)),
    },
  });
  const remove = useDeleteScheduleServicesId({
    mutation: {
      onSuccess: () => {
        toast.success("Serviço eliminado");
        invalidate();
      },
      onError: (error) => toast.error(getApiError(error)),
    },
  });

  const openEdit = useCallback((s: Service) => {
    setEditing(s);
    setForm({
      name: s.name ?? "",
      description: s.description ?? "",
      duration: String(s.duration),
      price: String(s.price),
      active: s.active ?? true,
      color: s.color ?? "#2A6FDB",
      contentKey: s.contentKey ?? null,
      descriptionKey: s.descriptionKey ?? null,
      availableOnSite: s.availableOnSite ?? true,
    });
    setModal(true);
  }, []);

  useEffect(() => {
    const id = searchParams.get("openService");
    if (!id || services.length === 0) return;
    const svc = services.find((s) => s.serviceId === id);
    if (svc) {
      openEdit(svc);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, services, openEdit, setSearchParams]);

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("O nome do serviço é obrigatório");
      return;
    }
    // Cria/atualiza as entradas CMS (nome obrigatório, descrição opcional) ao guardar.
    // Fora de uma mutation: sem este catch um erro do CMS (ex. 403 sem VIEW_CMS) ficava em silêncio.
    let contentKey: string;
    let descriptionKey: string | null;
    try {
      contentKey = await ensureCmsName(form.contentKey, "service", form.name, defaultLang);
      descriptionKey = form.description.trim()
        ? await ensureCmsName(form.descriptionKey, "service", form.description, defaultLang)
        : null;
    } catch (e: any) {
      toast.error(
        e?.response?.status === 403
          ? "Sem permissão para editar Conteúdos — o nome do serviço é guardado lá. Pede ao administrador o acesso a Conteúdos."
          : getApiError(e, "Não foi possível guardar o serviço."),
      );
      return;
    }
    const data = {
      duration: parseInt(form.duration),
      price: parseFloat(form.price),
      active: form.active,
      color: form.color,
      contentKey,
      descriptionKey,
      availableOnSite: form.availableOnSite,
    };
    if (editing) update.mutate({ id: editing.serviceId, data: data });
    else create.mutate({ data: data });
  };

  const handleDragStart = (index: number) => {
    dragIndexRef.current = index;
    setTouched(true);
  };
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    const from = dragIndexRef.current;
    if (from === null || from === index) return;
    const next = [...localOrder];
    const [moved] = next.splice(from, 1);
    next.splice(index, 0, moved);
    setLocalOrder(next);
    dragIndexRef.current = index;
  };
  const handleDrop = () => {
    droppedRef.current = true;
    reorder.mutate(localOrder);
    dragIndexRef.current = null;
  };
  // Dispara SEMPRE no fim de um arrasto, incluindo quando não houve drop
  // válido (largado fora de um alvo, ou ESC) — e, no caso de ter havido drop,
  // dispara DEPOIS do `handleDrop`. Sem distinguir os dois casos, um arrasto
  // cancelado deixava o `touched` preso a `true` para o resto da sessão (a
  // lista nunca mais sincronizava com o servidor, porque só o `onSuccess`/
  // `onError` do PATCH o desliga, e nesse caminho não há PATCH nenhum) — e
  // deixava por reverter a ordem que o `handleDragOver` já tinha mexido.
  const handleDragEnd = () => {
    dragIndexRef.current = null;
    if (droppedRef.current) {
      // Houve drop: o PATCH está a caminho e é ele que desliga o `touched`.
      droppedRef.current = false;
      return;
    }
    setLocalOrder(services.map((s) => s.serviceId));
    setTouched(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">
          {services.length} serviços · arrasta para reordenar
        </p>
        <GuardButton
          icon="plus"
          size="sm"
          onClick={() => {
            setEditing(null);
            setForm(emptySvcForm);
            setModal(true);
          }}
        >
          Novo serviço
        </GuardButton>
      </div>
      {isLoading ? (
        Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-16 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800"
          />
        ))
      ) : services.length === 0 ? (
        <Card className="p-8 text-center text-sm text-zinc-400">
          Ainda não há serviços.
        </Card>
      ) : (
        <div className="space-y-2">
          {orderedServices.map((s, i) => (
            <Card
              key={s.serviceId}
              draggable
              onDragStart={() => handleDragStart(i)}
              onDragOver={(e: React.DragEvent) => handleDragOver(e, i)}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
              className={`p-4 flex items-center gap-3 select-none ${!s.active ? "opacity-50" : ""}`}
            >
              <Icon
                name="grip"
                className="w-4 h-4 text-zinc-300 dark:text-zinc-600 shrink-0 cursor-grab active:cursor-grabbing"
              />
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ background: s.color ?? stableColorForId(s.serviceId) }}
              />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-zinc-900 dark:text-white text-sm">
                  {s.name}
                </p>
                <p className="text-xs text-zinc-400">
                  {s.duration} min · {fmtEur(Number(s.price))}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() =>
                    update.mutate(
                      { id: s.serviceId, data: { active: !s.active } },
                      { onSuccess: invalidate },
                    )
                  }
                  disabled={writeLocked}
                  title={writeLocked ? writeMessage : undefined}
                  className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 p-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Icon name={s.active ? "check" : "ban"} className="w-4 h-4" />
                </button>
                <IconButton
                  icon="edit"
                  label="Editar"
                  onClick={() => openEdit(s)}
                />
                <GuardIconButton
                  icon="trash"
                  label="Eliminar"
                  onClick={async () => {
                    if (await confirmDialog({ title: `Eliminar "${s.name}"?`, danger: true }))
                      remove.mutate({ id: s.serviceId });
                  }}
                  className="hover:text-red-500"
                />
              </div>
            </Card>
          ))}
        </div>
      )}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editing ? "Editar serviço" : "Novo serviço"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(false)}>
              Cancelar
            </Button>
            <GuardButton
              onClick={handleSave}
              disabled={create.isPending || update.isPending || !form.name.trim()}
            >
              {create.isPending || update.isPending ? "A guardar…" : "Guardar"}
            </GuardButton>
          </>
        }
      >
        <div className="space-y-4">
          <CmsCombo
            label="Nome"
            context="service"
            value={form.contentKey}
            name={form.name}
            onChange={(key, nm) => setForm((f) => ({ ...f, contentKey: key, name: nm }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Duração (min)"
              type="number"
              min={5}
              value={form.duration}
              onChange={(e: any) =>
                setForm((f) => ({ ...f, duration: e.target.value }))
              }
            />
            <Input
              label="Preço (€)"
              type="number"
              min={0}
              step={0.5}
              value={form.price}
              onChange={(e: any) =>
                setForm((f) => ({ ...f, price: e.target.value }))
              }
            />
          </div>
          <CmsCombo
            label="Descrição (opcional)"
            context="service"
            value={form.descriptionKey}
            name={form.description}
            onChange={(key, nm) => setForm((f) => ({ ...f, descriptionKey: key, description: nm }))}
          />
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Disponível no site</p>
              <p className="text-xs text-zinc-400">Desligado = só se marca no Backoffice.</p>
            </div>
            <Toggle
              label="Disponível no site"
              checked={form.availableOnSite}
              onChange={(v: boolean) => setForm((f) => ({ ...f, availableOnSite: v }))}
              disabled={writeLocked}
            />
          </div>
          {editing && svcStaff.length > 0 && (
            <div data-testid="service-staff">
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Quem faz este serviço</p>
              <ul className="flex flex-wrap gap-1.5" aria-label="Profissionais deste serviço">
                {svcStaff.map((st) => (
                  <li key={st.staffId}>
                    <Badge tone={st.doesIt ? "green" : "neutral"} className={st.doesIt ? "" : "line-through"}>
                      {st.name}
                      {st.active === false ? " (inactivo)" : ""}
                    </Badge>
                  </li>
                ))}
              </ul>
              {canTeamSvc("agenda.profissionais", "view") && (
                <Link to="/agenda/profissionais" className="mt-1.5 inline-block text-xs text-accent hover:underline">
                  Gerir em Profissionais
                </Link>
              )}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Cor do serviço
            </label>
            <div className="flex items-center gap-3 flex-wrap">
              <input
                type="color"
                value={form.color}
                onChange={(e) =>
                  setForm((f) => ({ ...f, color: e.target.value }))
                }
                className="w-10 h-10 rounded-lg border border-zinc-200 dark:border-zinc-700 cursor-pointer p-0.5 bg-white dark:bg-zinc-900 shrink-0"
              />
              <div className="flex flex-wrap gap-2">
                {SERVICE_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, color: c }))}
                    className={`w-7 h-7 rounded-full transition-transform ${form.color === c ? "scale-125 ring-2 ring-offset-2 ring-zinc-400 dark:ring-offset-zinc-800" : "hover:scale-110"}`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
