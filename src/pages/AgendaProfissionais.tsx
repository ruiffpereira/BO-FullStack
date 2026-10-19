import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { pt } from "date-fns/locale";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Card, Badge, Button, Input, Modal, EmptyState, IconButton, Avatar, Tabs, Toggle, SectionTitle } from "../ui/ui.jsx";
import { Icon } from "../ui/icons.jsx";
import { GuardButton, GuardIconButton } from "../components/GuardButton";
import { Combobox } from "../components/Combobox";
import { DatePicker } from "../components/DatePicker";
import { TimeField } from "../components/TimeField";
import { FileUpload } from "../components/FileUpload";
import { StaffServicesEditor } from "../components/StaffServicesEditor";
import { confirmDialog } from "../components/confirm";
import { useWriteGuard } from "../hooks/useWriteGuard";
import { useTeamAccess } from "../hooks/useTeamAccess";
import { getApiError } from "../lib/apiError";
import {
  DAY_LABEL,
  STAFF_COLORS,
  validateTimeOff,
  validateWeek,
  weekFromHours,
} from "../lib/staffForm";
import {
  useGetScheduleStaff,
  getScheduleStaffQueryKey,
} from "../gen/backoffice/hooks/useGetScheduleStaff.js";
import {
  useGetScheduleStaffId,
  getScheduleStaffIdQueryKey,
} from "../gen/backoffice/hooks/useGetScheduleStaffId.js";
import { getScheduleStaffOptionsQueryKey } from "../gen/backoffice/hooks/useGetScheduleStaffOptions.js";
import { usePostScheduleStaff } from "../gen/backoffice/hooks/usePostScheduleStaff.js";
import { usePutScheduleStaffId } from "../gen/backoffice/hooks/usePutScheduleStaffId.js";
import { useDeleteScheduleStaffId } from "../gen/backoffice/hooks/useDeleteScheduleStaffId.js";
import { usePutScheduleStaffIdServices } from "../gen/backoffice/hooks/usePutScheduleStaffIdServices.js";
import { usePutScheduleStaffIdWorkingHours } from "../gen/backoffice/hooks/usePutScheduleStaffIdWorkingHours.js";
import { usePostScheduleStaffIdTimeOff } from "../gen/backoffice/hooks/usePostScheduleStaffIdTimeOff.js";
import { useDeleteScheduleStaffIdTimeOffTimeoffid } from "../gen/backoffice/hooks/useDeleteScheduleStaffIdTimeOffTimeoffid.js";
import { useGetScheduleServices } from "../gen/backoffice/hooks/useGetScheduleServices.js";
import { useGetTeam } from "../gen/backoffice/hooks/useGetTeam.js";
import { uploadImage } from "../gen/backoffice/hooks/useUploadImage.js";
import type { Staff } from "../gen/backoffice/types/Staff.js";
import type { StaffDetail } from "../gen/backoffice/types/StaffDetail.js";
import type { StaffWorkingHoursDay } from "../gen/backoffice/types/StaffWorkingHoursDay.js";

/** Revalida a lista, a ficha e os selectores (marcação, venda, filtros) depois de qualquer alteração. */
function useInvalidateStaff() {
  const qc = useQueryClient();
  return (staffId?: string | null) => {
    qc.invalidateQueries({ queryKey: getScheduleStaffQueryKey() });
    qc.invalidateQueries({ queryKey: getScheduleStaffOptionsQueryKey() });
    if (staffId) qc.invalidateQueries({ queryKey: getScheduleStaffIdQueryKey(staffId) });
  };
}

const fmtDay = (iso: string) => format(parseISO(iso), "d MMM yyyy", { locale: pt });

/**
 * Agenda → Profissionais (`agenda.profissionais`): quem atende. Não é um login — um membro da equipa pode estar
 * ligado a um profissional (e então, com o âmbito «Só os meus», só vê o que é dele). Um negócio sem profissionais
 * funciona como sempre.
 */
export function AgendaProfissionais() {
  const { readOnly: writeLocked, message: writeMessage } = useWriteGuard();
  const invalidate = useInvalidateStaff();
  const { data: staff = [], isLoading, isError } = useGetScheduleStaff();
  const [modal, setModal] = useState<{ id: string | null } | null>(null);

  const setActive = usePutScheduleStaffId({
    mutation: {
      onSuccess: (_d, vars) => {
        invalidate(vars.id);
        toast.success("Profissional actualizado");
      },
      onError: (error) => toast.error(getApiError(error)),
    },
  });
  const remove = useDeleteScheduleStaffId({
    mutation: {
      onSuccess: (_d, vars) => {
        invalidate(vars.id);
        toast.success("Profissional apagado");
      },
      // 409 STAFF_HAS_HISTORY → «Tem histórico — desactiva-o em vez de apagar.»
      onError: (error) => toast.error(getApiError(error)),
    },
  });

  if (isError) {
    return (
      <Card className="p-2">
        <EmptyState icon="lock" title="Sem acesso" desc="Não foi possível carregar os profissionais." />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-zinc-500">
          {staff.length === 0
            ? "Quem atende os clientes. Sem profissionais, a agenda funciona como sempre."
            : `${staff.length} ${staff.length === 1 ? "profissional" : "profissionais"}`}
        </p>
        <GuardButton icon="plus" size="sm" onClick={() => setModal({ id: null })}>
          Novo profissional
        </GuardButton>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
          ))}
        </div>
      ) : staff.length === 0 ? (
        <Card>
          <EmptyState
            icon="users"
            title="Ainda não tens profissionais"
            desc="Cria o primeiro para atribuir marcações, vendas e despesas a quem as faz."
            action={
              <GuardButton icon="plus" onClick={() => setModal({ id: null })}>
                Novo profissional
              </GuardButton>
            }
          />
        </Card>
      ) : (
        <ul aria-label="Profissionais" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {staff.map((s: Staff) => (
            <li key={s.staffId} data-staff={s.staffId}>
              <Card className={`p-4 flex items-start gap-3 ${s.active ? "" : "opacity-60"}`}>
                {s.photo ? (
                  <img src={s.photo} alt="" className="w-12 h-12 rounded-full object-cover shrink-0 border border-zinc-200 dark:border-zinc-700" />
                ) : (
                  <Avatar name={s.name} color={s.color ?? "#2A6FDB"} size={48} />
                )}
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-medium text-zinc-900 dark:text-white text-sm">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color ?? "#2A6FDB" }} />
                    <span className="truncate">{s.name}</span>
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {!s.active && <Badge tone="neutral">Inactivo</Badge>}
                    <Badge tone={s.showOnSite ? "green" : "neutral"}>{s.showOnSite ? "No site" : "Só no Backoffice"}</Badge>
                    {s.memberName && <Badge tone="blue">Ligado a {s.memberName}</Badge>}
                  </div>
                  <div className="mt-2 flex items-center gap-1 -ml-2">
                    <IconButton icon="edit" label={`Editar ${s.name}`} onClick={() => setModal({ id: s.staffId })} />
                    <button
                      type="button"
                      disabled={writeLocked || setActive.isPending}
                      title={writeLocked ? writeMessage : undefined}
                      onClick={() => setActive.mutate({ id: s.staffId, data: { active: !s.active } })}
                      className="px-2 py-1.5 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {s.active ? "Desactivar" : "Activar"}
                    </button>
                    <GuardIconButton
                      icon="trash"
                      label={`Apagar ${s.name}`}
                      className="hover:text-red-500"
                      onClick={async () => {
                        if (
                          await confirmDialog({
                            title: `Apagar "${s.name}"?`,
                            message: "Se já tem marcações, vendas ou despesas, não dá para apagar — desactiva-o.",
                            danger: true,
                          })
                        )
                          remove.mutate({ id: s.staffId });
                      }}
                    />
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {modal && <StaffModal staffId={modal.id} onClose={() => setModal(null)} />}
    </div>
  );
}

type StaffTab = "dados" | "servicos" | "horario" | "ferias";

function StaffModal({ staffId, onClose }: { staffId: string | null; onClose: () => void }) {
  // Depois de criar, a modal continua aberta já em modo «editar» para definir serviços, horário e férias.
  const [id, setId] = useState<string | null>(staffId);
  const [tab, setTab] = useState<StaffTab>("dados");
  const { data: detail, isLoading } = useGetScheduleStaffId(id ?? "", { query: { enabled: !!id } });
  const locked = !id;
  const lockedTitle = locked ? "Guarda primeiro os dados do profissional" : undefined;

  return (
    <Modal
      open
      onClose={onClose}
      title={id ? "Editar profissional" : "Novo profissional"}
      subtitle={id ? detail?.name : "Nome, foto e cor; depois serviços, horário e férias."}
      width="max-w-2xl"
      footer={
        <Button variant="ghost" onClick={onClose}>
          Fechar
        </Button>
      }
    >
      <div className="space-y-5">
        <Tabs
          tabs={[
            { id: "dados", label: "Dados" },
            { id: "servicos", label: "Serviços", disabled: locked, title: lockedTitle },
            { id: "horario", label: "Horário", disabled: locked, title: lockedTitle },
            { id: "ferias", label: "Férias e folgas", disabled: locked, title: lockedTitle },
          ]}
          value={tab}
          onChange={(t: string) => setTab(t as StaffTab)}
        />
        {id && isLoading ? (
          <div className="space-y-3" aria-busy="true">
            <div className="h-10 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
            <div className="h-10 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
          </div>
        ) : (
          <>
            {tab === "dados" && (
              <DadosTab
                key={id ?? "novo"}
                detail={id ? detail : undefined}
                onCreated={(created) => {
                  setId(created.staffId);
                  toast.success("Profissional criado — define agora os serviços, o horário e as férias.");
                }}
              />
            )}
            {tab === "servicos" && id && detail && <ServicosTab key={id} detail={detail} />}
            {tab === "horario" && id && detail && <HorarioTab key={id} detail={detail} />}
            {tab === "ferias" && id && detail && <FeriasTab key={id} detail={detail} />}
          </>
        )}
      </div>
    </Modal>
  );
}

/* ───────────────────────── Dados ───────────────────────── */

function DadosTab({ detail, onCreated }: { detail?: StaffDetail; onCreated: (s: Staff) => void }) {
  const invalidate = useInvalidateStaff();
  const { isMember, can } = useTeamAccess();
  const [name, setName] = useState(detail?.name ?? "");
  const [color, setColor] = useState(detail?.color ?? STAFF_COLORS[0]);
  const [showOnSite, setShowOnSite] = useState(detail?.showOnSite ?? true);
  const [active, setActive] = useState(detail?.active ?? true);
  const [memberId, setMemberId] = useState(detail?.memberId ?? "");
  const [photo, setPhoto] = useState<string | null>(detail?.photo ?? null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  // Ligar a um membro: a lista vem de `/team` (dono, ou membro com a folha `equipa`).
  const canListTeam = !isMember || can("equipa");
  const { data: team } = useGetTeam({ query: { enabled: canListTeam, retry: false } });
  const memberOptions = useMemo(() => {
    const opts = [{ value: "", label: "Sem ligação" }];
    for (const m of (team ?? []) as { memberId?: string; name?: string; email?: string }[]) {
      if (m.memberId) opts.push({ value: m.memberId, label: m.name || m.email || "Membro" });
    }
    if (detail?.memberId && !opts.some((o) => o.value === detail.memberId)) {
      opts.push({ value: detail.memberId, label: detail.memberName || "Membro" });
    }
    return opts;
  }, [team, detail?.memberId, detail?.memberName]);

  const create = usePostScheduleStaff();
  const update = usePutScheduleStaffId();

  const save = async () => {
    if (!name.trim()) return toast.error("Indica o nome.");
    setSaving(true);
    try {
      let photoUrl = photo;
      // Upload diferido: a foto só segue ao Guardar (sem órfãos se o formulário for cancelado).
      if (photoFile) {
        const up = await uploadImage({ image: photoFile, module: "staff" });
        photoUrl = up.fileUrl ?? photoUrl;
      }
      const base = { name: name.trim(), photo: photoUrl, color, showOnSite, active };
      if (detail) {
        // `memberId` só vai se mudou (quem tem o âmbito «Só os meus» não pode ligar membros).
        const linkChanged = memberId !== (detail.memberId ?? "");
        await update.mutateAsync({ id: detail.staffId, data: linkChanged ? { ...base, memberId: memberId || null } : base });
        invalidate(detail.staffId);
        setPhotoFile(null);
        toast.success("Profissional guardado");
      } else {
        const created = await create.mutateAsync({ data: memberId ? { ...base, memberId } : base });
        invalidate(created.staffId);
        onCreated(created);
      }
    } catch (e: any) {
      toast.error(getApiError(e, e?.message ?? "Não foi possível guardar."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Input label="Nome" value={name} onChange={(e: any) => setName(e.target.value)} autoComplete="off" />
      <div>
        <p className="block text-[13px] font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Foto</p>
        <FileUpload
          module="staff"
          deferred
          currentUrl={photo}
          onFileSelected={setPhotoFile}
          onDeleted={() => setPhoto(null)}
          label="Carregar foto"
        />
      </div>
      <div>
        <p className="block text-[13px] font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Cor na agenda</p>
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="color"
            aria-label="Cor na agenda"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-10 h-10 rounded-lg border border-zinc-200 dark:border-zinc-700 cursor-pointer p-0.5 bg-white dark:bg-zinc-900 shrink-0"
          />
          <div className="flex flex-wrap gap-2">
            {STAFF_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Cor ${c}`}
                onClick={() => setColor(c)}
                className={`w-7 h-7 rounded-full transition-transform ${color === c ? "scale-125 ring-2 ring-offset-2 ring-zinc-400 dark:ring-offset-zinc-800" : "hover:scale-110"}`}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Aparece no site de marcações</p>
          <p className="text-xs text-zinc-400">Desligado = só recebe marcações feitas no Backoffice.</p>
        </div>
        <Toggle label="Aparece no site de marcações" checked={showOnSite} onChange={setShowOnSite} />
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Activo</p>
          <p className="text-xs text-zinc-400">Inactivo = deixa de aparecer nos selectores e no site; o histórico fica.</p>
        </div>
        <Toggle label="Activo" checked={active} onChange={setActive} />
      </div>
      <div>
        {canListTeam ? (
          <Combobox
            label="Ligar a um membro da equipa (opcional)"
            value={memberId}
            onChange={setMemberId}
            options={memberOptions}
            placeholder="Sem ligação"
            searchPlaceholder="Pesquisar membro…"
          />
        ) : (
          <p className="text-xs text-zinc-500">
            Ligado a: {detail?.memberName ?? "ninguém"}. Só quem gere a equipa pode alterar a ligação.
          </p>
        )}
        <p className="text-xs text-zinc-400 mt-1">
          Com a ligação, o membro pode ver só o que é dele (âmbito «Só os meus»). Um profissional também pode existir sem conta.
        </p>
      </div>
      <div className="flex justify-end">
        <GuardButton onClick={save} isLoading={saving} disabled={!name.trim()}>
          {detail ? "Guardar" : "Criar profissional"}
        </GuardButton>
      </div>
    </div>
  );
}

/* ───────────────────────── Serviços ───────────────────────── */

function ServicosTab({ detail }: { detail: StaffDetail }) {
  const invalidate = useInvalidateStaff();
  const { can } = useTeamAccess();
  // A lista de serviços é da folha agenda.servicos: sem ela nem se pede (evita um 403 com toast).
  const canSeeServices = can("agenda.servicos", "view");
  const { data: services = [] } = useGetScheduleServices({ query: { enabled: canSeeServices } });
  const save = usePutScheduleStaffIdServices({
    mutation: {
      onSuccess: () => {
        invalidate(detail.staffId);
        toast.success("Serviços guardados");
      },
      onError: (error) => toast.error(getApiError(error)),
    },
  });
  // A API diz se este pedido pode gravar preços; sem ela o preço aparece só-leitura.
  const canEditPrices = detail.canEditPrices ?? can("agenda.profissionais.precos", "edit");
  if (!canSeeServices) {
    return <p className="text-sm text-zinc-500">Precisas da permissão «Serviços» da Agenda para escolher os serviços deste profissional.</p>;
  }
  return (
    <StaffServicesEditor
      services={services.map((s) => ({ serviceId: s.serviceId, name: s.name ?? "—", price: s.price, active: s.active }))}
      rules={detail.services}
      canEditPrices={canEditPrices}
      saving={save.isPending}
      onSave={(rules) => save.mutate({ id: detail.staffId, data: { services: rules } })}
    />
  );
}

/* ───────────────────────── Horário ───────────────────────── */

function HorarioTab({ detail }: { detail: StaffDetail }) {
  const invalidate = useInvalidateStaff();
  const [inherit, setInherit] = useState(detail.inheritsWorkingHours);
  const [week, setWeek] = useState<StaffWorkingHoursDay[]>(() => weekFromHours(detail.workingHours));
  const save = usePutScheduleStaffIdWorkingHours({
    mutation: {
      onSuccess: () => {
        invalidate(detail.staffId);
        toast.success("Horário guardado");
      },
      onError: (error) => toast.error(getApiError(error)),
    },
  });

  const patch = (day: number, p: Partial<StaffWorkingHoursDay>) =>
    setWeek((w) => w.map((d) => (d.dayOfWeek === day ? { ...d, ...p } : d)));

  const submit = () => {
    if (inherit) return save.mutate({ id: detail.staffId, data: { inherit: true } });
    const err = validateWeek(week);
    if (err) return toast.error(err);
    save.mutate({ id: detail.staffId, data: { inherit: false, hours: week } });
  };

  return (
    <div className="space-y-4">
      <Tabs
        tabs={[
          { id: "inherit", label: "Igual ao do negócio" },
          { id: "own", label: "Horário próprio" },
        ]}
        value={inherit ? "inherit" : "own"}
        onChange={(t: string) => setInherit(t === "inherit")}
      />
      {inherit ? (
        <p className="text-sm text-zinc-500">Segue o horário do negócio (Agenda → Configurações).</p>
      ) : (
        <ul aria-label="Horário do profissional" className="divide-y divide-zinc-100 dark:divide-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-800">
          {week.map((d) => (
            <li key={d.dayOfWeek} className="px-3.5 py-2.5 flex items-center gap-3 flex-wrap" data-day={d.dayOfWeek}>
              <span className="w-20 text-sm font-medium text-zinc-800 dark:text-zinc-100">{DAY_LABEL[d.dayOfWeek]}</span>
              <Toggle size="sm" label={`${DAY_LABEL[d.dayOfWeek]} aberto`} checked={d.isActive} onChange={(v: boolean) => patch(d.dayOfWeek, { isActive: v })} />
              {d.isActive ? (
                <div className="flex items-center gap-2">
                  <div className="w-24">
                    <TimeField value={d.startTime} onChange={(v) => patch(d.dayOfWeek, { startTime: v })} />
                  </div>
                  <span className="text-zinc-400">–</span>
                  <div className="w-24">
                    <TimeField value={d.endTime} after={d.startTime} onChange={(v) => patch(d.dayOfWeek, { endTime: v })} />
                  </div>
                </div>
              ) : (
                <span className="text-xs text-zinc-400">Fechado</span>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="flex justify-end">
        <GuardButton onClick={submit} isLoading={save.isPending}>
          Guardar horário
        </GuardButton>
      </div>
    </div>
  );
}

/* ───────────────────────── Férias e folgas ───────────────────────── */

function FeriasTab({ detail }: { detail: StaffDetail }) {
  const invalidate = useInvalidateStaff();
  const today = format(new Date(), "yyyy-MM-dd");
  const [f, setF] = useState({ startDate: today, endDate: today, startTime: "", endTime: "", reason: "" });
  const [hours, setHours] = useState(false);

  const add = usePostScheduleStaffIdTimeOff({
    mutation: {
      onSuccess: () => {
        invalidate(detail.staffId);
        toast.success("Folga adicionada");
        setF((x) => ({ ...x, reason: "" }));
      },
      onError: (error) => toast.error(getApiError(error)),
    },
  });
  const del = useDeleteScheduleStaffIdTimeOffTimeoffid({
    mutation: {
      onSuccess: () => {
        invalidate(detail.staffId);
        toast.success("Folga apagada");
      },
      onError: (error) => toast.error(getApiError(error)),
    },
  });

  const list = [...(detail.timeOff ?? [])].sort((a, b) => a.startDate.localeCompare(b.startDate));

  const submit = () => {
    const body = { ...f, startTime: hours ? f.startTime : "", endTime: hours ? f.endTime : "" };
    const err = validateTimeOff(body);
    if (err) return toast.error(err);
    add.mutate({
      id: detail.staffId,
      data: {
        startDate: body.startDate,
        endDate: body.endDate,
        ...(hours ? { startTime: body.startTime, endTime: body.endTime } : {}),
        ...(body.reason.trim() ? { reason: body.reason.trim() } : {}),
      },
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <SectionTitle>Marcadas</SectionTitle>
        {list.length === 0 ? (
          <p className="text-sm text-zinc-500">Sem férias nem folgas marcadas.</p>
        ) : (
          <ul aria-label="Férias e folgas" className="divide-y divide-zinc-100 dark:divide-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-800">
            {list.map((t) => (
              <li key={t.timeOffId} className="px-3.5 py-2.5 flex items-center gap-3" data-timeoff={t.timeOffId}>
                <Icon name="calendar" className="w-4 h-4 text-zinc-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                    {t.startDate === t.endDate ? fmtDay(t.startDate) : `${fmtDay(t.startDate)} – ${fmtDay(t.endDate)}`}
                    {t.startTime && t.endTime ? ` · ${t.startTime}–${t.endTime}` : ""}
                  </p>
                  {t.reason && <p className="text-xs text-zinc-500 truncate">{t.reason}</p>}
                </div>
                <GuardIconButton
                  icon="trash"
                  label={`Apagar folga de ${fmtDay(t.startDate)}`}
                  className="hover:text-red-500"
                  onClick={async () => {
                    if (await confirmDialog({ title: "Apagar esta folga?", danger: true }))
                      del.mutate({ id: detail.staffId, timeOffId: t.timeOffId });
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <SectionTitle>Adicionar férias ou folga</SectionTitle>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="block text-[13px] font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Início</span>
              <DatePicker value={f.startDate} onChange={(v) => setF((x) => ({ ...x, startDate: v, endDate: hours || x.endDate < v ? v : x.endDate }))} />
            </div>
            <div>
              <span className="block text-[13px] font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Fim</span>
              <DatePicker value={f.endDate} min={f.startDate} onChange={(v) => setF((x) => ({ ...x, endDate: v }))} />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-zinc-700 dark:text-zinc-300">Só algumas horas (num dia)</p>
            <Toggle
              size="sm"
              label="Só algumas horas"
              checked={hours}
              onChange={(v: boolean) => {
                setHours(v);
                // Uma janela de horas vale num só dia: o fim passa a ser o início.
                if (v) setF((x) => ({ ...x, startTime: x.startTime || "09:00", endTime: x.endTime || "13:00", endDate: x.startDate }));
              }}
            />
          </div>
          {hours && (
            <div className="flex items-center gap-2">
              <div className="w-24">
                <TimeField value={f.startTime} onChange={(v) => setF((x) => ({ ...x, startTime: v }))} />
              </div>
              <span className="text-zinc-400">–</span>
              <div className="w-24">
                <TimeField value={f.endTime} after={f.startTime} onChange={(v) => setF((x) => ({ ...x, endTime: v }))} />
              </div>
            </div>
          )}
          <Input label="Motivo (opcional)" value={f.reason} onChange={(e: any) => setF((x) => ({ ...x, reason: e.target.value }))} placeholder="Ex.: férias" />
          <div className="flex justify-end">
            <GuardButton icon="plus" onClick={submit} isLoading={add.isPending}>
              Adicionar
            </GuardButton>
          </div>
        </div>
      </div>
    </div>
  );
}
