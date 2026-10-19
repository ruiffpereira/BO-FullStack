import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Badge, Button, Card, Input, Select, Tabs } from "../../ui/ui.jsx";
import { GuardButton } from "../GuardButton";
import { confirmDialog } from "../confirm";
import { useAuth } from "../../context/AuthContext";
import { useGetSettingsLanguages } from "../../hooks/useSettingsLanguages";
import { useInvalidateMail } from "../../hooks/useMail";
import { usePostMailCampaigns } from "../../gen/backoffice/hooks/usePostMailCampaigns.js";
import { usePatchMailCampaignsCampaignid } from "../../gen/backoffice/hooks/usePatchMailCampaignsCampaignid.js";
import { usePostMailCampaignsPreviewAudience } from "../../gen/backoffice/hooks/usePostMailCampaignsPreviewAudience.js";
import { usePostMailCampaignsCampaignidTest } from "../../gen/backoffice/hooks/usePostMailCampaignsCampaignidTest.js";
import { usePostMailCampaignsCampaignidSend } from "../../gen/backoffice/hooks/usePostMailCampaignsCampaignidSend.js";
import { usePostMailCampaignsCampaignidSchedule } from "../../gen/backoffice/hooks/usePostMailCampaignsCampaignidSchedule.js";
import { useDeleteMailCampaignsCampaignid } from "../../gen/backoffice/hooks/useDeleteMailCampaignsCampaignid.js";
import type { Campaign } from "../../gen/backoffice/types/Campaign";
import type { CampaignBlock } from "../../gen/backoffice/types/CampaignBlock";
import type { CampaignSegment } from "../../gen/backoffice/types/CampaignSegment";
import type { CampaignsStatus } from "../../gen/backoffice/types/CampaignsStatus";
import {
  CAMPAIGNS_PATH,
  CAMPAIGN_STEPS,
  DEFAULT_SEGMENT,
  SEGMENT_OPTIONS,
  blocksError,
  campaignErrorMessage,
  campaignHref,
  cleanBlocks,
  cleanSegment,
  cleanTexts,
  fmtDateTime,
  isCampaignsLocked,
  languagesWithContent,
  localInputToIso,
  minScheduleInput,
  readinessByStep,
  segmentLabel,
  segmentReady,
  type CampaignContent,
} from "../../lib/campaigns";
import { CampaignBlocksEditor, CampaignPreview } from "./CampaignBlocksEditor";

const PAUSED_MSG = "Os envios deste negócio estão pausados. Não se envia nem se testa até serem retomados.";

/** Passo 1-4 no URL (`?passo=`): deep-link e sobrevive ao remount depois de criar o rascunho. */
function useStep(hasId: boolean): [number, (n: number) => void] {
  const [params, setParams] = useSearchParams();
  const raw = Number(params.get("passo"));
  const step = Number.isInteger(raw) && raw >= 1 && raw <= 4 ? (hasId ? raw - 1 : 0) : 0;
  const setStep = (n: number) => {
    const next = new URLSearchParams(params);
    if (n <= 0) next.delete("passo");
    else next.set("passo", String(n + 1));
    setParams(next, { replace: true });
  };
  return [step, setStep];
}

/** Stepper: círculos numerados; as etiquetas só a partir de `sm` (a 390 mostra-se «Passo N de 4» por baixo). */
function Stepper({ step, reach, onGo }: { step: number; reach: number; onGo: (n: number) => void }) {
  return (
    <div className="shrink-0" data-testid="campaign-stepper">
      <ol className="flex items-center gap-1 sm:gap-2" aria-label="Passos da campanha">
        {CAMPAIGN_STEPS.map((s, i) => {
          const active = i === step;
          const done = i < step;
          const enabled = i <= reach;
          return (
            <li key={s.id} className="flex items-center gap-1 sm:gap-2 flex-1 min-w-0 last:flex-none">
              <button
                type="button"
                aria-current={active ? "step" : undefined}
                aria-label={`Passo ${i + 1}: ${s.label}`}
                data-testid={`campaign-step-${s.id}`}
                disabled={!enabled}
                onClick={() => onGo(i)}
                className={`inline-flex items-center gap-2 rounded-full px-1 py-1 sm:pr-3 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-not-allowed ${
                  active ? "text-accent" : done ? "text-zinc-700 dark:text-zinc-200" : "text-zinc-400"
                }`}
              >
                <span
                  className={`inline-flex w-7 h-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    active ? "bg-accent text-white" : done ? "bg-emerald-500 text-white" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                  }`}
                >
                  {done ? "✓" : i + 1}
                </span>
                <span className="hidden sm:inline whitespace-nowrap">{s.label}</span>
              </button>
              {i < CAMPAIGN_STEPS.length - 1 && <span className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800 min-w-2" aria-hidden />}
            </li>
          );
        })}
      </ol>
      <p className="sm:hidden mt-1 text-xs text-zinc-500" data-testid="campaign-step-caption">
        Passo {step + 1} de {CAMPAIGN_STEPS.length} · {CAMPAIGN_STEPS[step].label}
      </p>
    </div>
  );
}

function ErrorList({ errors, testId }: { errors: string[]; testId: string }) {
  if (errors.length === 0) return null;
  return (
    <ul role="alert" data-testid={testId} className="rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-200 text-sm px-3 py-2 space-y-0.5 list-disc list-inside">
      {errors.map((e) => (
        <li key={e}>{e}</li>
      ))}
    </ul>
  );
}

type Props = { campaign: Campaign | null; status: CampaignsStatus | undefined };

/**
 * Nova campanha / editar rascunho, em 4 passos (B42 · fase 9): Destinatários → Conteúdo → Teste → Enviar.
 * O rascunho cria-se (POST) ao sair do passo 1 e guarda-se (PATCH) a cada «Seguinte»; o passo vive no URL (`?passo=`).
 * Quem decide é a API: público (contagem), `readiness` (o que falta), estado. Enviar/Agendar só com a folha
 * `correio.campanhas.enviar` (quem só edita nem vê esses botões).
 */
export function CampaignWizard({ campaign, status }: Props) {
  const navigate = useNavigate();
  const invalidate = useInvalidateMail();
  const { can } = useAuth();
  const canSend = can("correio.campanhas.enviar", "edit");
  const paused = !!status?.paused;

  const langsQ = useGetSettingsLanguages();
  const defaultLang = campaign?.defaultLanguage || langsQ.data?.default || "pt";
  const langs = useMemo(() => {
    const available = langsQ.data?.available ?? [];
    const selected = langsQ.data?.selected?.length ? langsQ.data.selected : [defaultLang];
    const list = selected.map((code) => ({ code, name: available.find((a) => a.code === code)?.name ?? code.toUpperCase() }));
    // A língua por omissão primeiro.
    return [...list.filter((l) => l.code === defaultLang), ...list.filter((l) => l.code !== defaultLang)];
  }, [langsQ.data, defaultLang]);

  const [id, setId] = useState<string | null>(campaign?.campaignId ?? null);
  const [step, setStep] = useStep(!!id);
  const [name, setName] = useState(campaign?.name ?? "");
  const [segment, setSegment] = useState<CampaignSegment>(campaign?.segment ?? DEFAULT_SEGMENT);
  const [content, setContent] = useState<CampaignContent>(campaign?.content ?? {});
  const [subjects, setSubjects] = useState<Record<string, string>>(campaign?.subjects ?? {});
  const [preheaders, setPreheaders] = useState<Record<string, string>>(campaign?.preheaders ?? {});
  const [lang, setLang] = useState(defaultLang);
  const [readiness, setReadiness] = useState<string[]>(campaign?.readiness?.errors ?? []);
  const [serverError, setServerError] = useState<string | null>(null);
  const [scheduleAt, setScheduleAt] = useState("");
  const [testLang, setTestLang] = useState("");
  const [testsSent, setTestsSent] = useState(0);

  // ── Contagem ao vivo (passo 1) ───────────────────────────────────────────────
  const [count, setCount] = useState<number | null>(null);
  const [countError, setCountError] = useState<string | null>(null);
  const [counting, setCounting] = useState(false);
  const previewM = usePostMailCampaignsPreviewAudience();
  const seq = useRef(0);
  const segKey = JSON.stringify(cleanSegment(segment, defaultLang));
  const ready = segmentReady(segment);
  useEffect(() => {
    if (!ready) {
      setCount(null);
      setCountError(null);
      return;
    }
    setCounting(true);
    const mine = ++seq.current;
    const t = setTimeout(() => {
      previewM
        .mutateAsync({ data: { segment: JSON.parse(segKey) } })
        .then((r: any) => {
          if (mine !== seq.current) return;
          setCount(r?.count ?? 0);
          setCountError(null);
        })
        .catch((e: unknown) => {
          if (mine !== seq.current) return;
          setCount(null);
          setCountError(campaignErrorMessage(e, "Não foi possível contar os destinatários."));
        })
        .finally(() => mine === seq.current && setCounting(false));
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segKey, ready]);

  // ── Guardar ──────────────────────────────────────────────────────────────────
  const createM = usePostMailCampaigns();
  const patchM = usePatchMailCampaignsCampaignid();
  const saving = createM.isPending || patchM.isPending;

  const body = () => {
    const cleaned: CampaignContent = {};
    for (const [l, blocks] of Object.entries(content)) {
      const c = cleanBlocks(blocks);
      if (c.length > 0) cleaned[l] = c;
    }
    const used = languagesWithContent(cleaned);
    // Assunto e pré-cabeçalho também das línguas sem blocos mas com texto (a API decide o que falta).
    const textLangs = Array.from(new Set([...used, ...Object.keys(subjects), ...Object.keys(preheaders)]));
    return {
      name: name.trim(),
      segment: cleanSegment(segment, defaultLang),
      content: cleaned,
      subjects: cleanTexts(subjects, textLangs),
      preheaders: cleanTexts(preheaders, textLangs),
    };
  };

  /** Guarda o rascunho; devolve o id ou `null` se falhou (o erro fica visível). */
  const save = async (): Promise<string | null> => {
    setServerError(null);
    try {
      let saved: Campaign;
      if (id) saved = (await patchM.mutateAsync({ campaignId: id, data: body() })) as Campaign;
      else saved = (await createM.mutateAsync({ data: body() })) as Campaign;
      setReadiness(saved.readiness?.errors ?? []);
      invalidate();
      if (!id && saved.campaignId) setId(saved.campaignId);
      return saved.campaignId ?? id;
    } catch (e) {
      setServerError(campaignErrorMessage(e, "Não foi possível guardar a campanha."));
      if (isCampaignsLocked(e)) invalidate();
      return null;
    }
  };

  // ── Validação por passo ─────────────────────────────────────────────────────
  const contentError = useMemo(() => {
    for (const [l, blocks] of Object.entries(content)) {
      const e = blocksError(blocks);
      if (e) return `${langs.find((x) => x.code === l)?.name ?? l}: ${e}`;
    }
    return null;
  }, [content, langs]);

  const stepBlock: string | null =
    step === 0 ? (!name.trim() ? "Dá um nome à campanha (só tu o vês)." : !ready ? "Completa o segmento." : null) : step === 1 ? contentError : null;

  const next = async () => {
    if (stepBlock) return;
    const savedId = await save();
    if (!savedId) return;
    if (!id) {
      // Primeira gravação: o URL passa a ter o id e o passo (a página volta a montar-se com a campanha).
      navigate(`${campaignHref(savedId)}?passo=${step + 2}`, { replace: true });
      return;
    }
    setStep(step + 1);
  };

  const goTo = (n: number) => {
    if (n !== step) setStep(n);
  };

  // ── Teste ────────────────────────────────────────────────────────────────────
  const testM = usePostMailCampaignsCampaignidTest();
  const contentLangs = langs.filter((l) => (content[l.code] ?? []).some((b: CampaignBlock) => cleanBlocks([b]).length > 0));
  const sendTest = async () => {
    if (!id) return;
    setServerError(null);
    try {
      const r = (await testM.mutateAsync({ campaignId: id, data: testLang ? { language: testLang } : {} })) as any;
      setTestsSent((n) => n + 1);
      toast.success(r?.to ? `Teste enviado para ${r.to}.` : "Teste enviado.");
    } catch (e) {
      setServerError(campaignErrorMessage(e, "Não foi possível enviar o teste."));
    }
  };

  // ── Enviar / Agendar ─────────────────────────────────────────────────────────
  const sendM = usePostMailCampaignsCampaignidSend();
  const scheduleM = usePostMailCampaignsCampaignidSchedule();
  const deleteM = useDeleteMailCampaignsCampaignid();
  const byStep = readinessByStep(readiness);
  const incomplete = readiness.length > 0;
  const blockedSend = incomplete || paused || count === 0;

  const sendNow = async () => {
    if (!id) return;
    const ok = await confirmDialog({
      title: "Enviar agora?",
      message: `«${name.trim()}» sai já para ${count != null ? `${count} subscritos` : "os subscritos do segmento"}. Não dá para desfazer o que já saiu.`,
      confirmLabel: "Enviar agora",
    });
    if (!ok) return;
    setServerError(null);
    try {
      await sendM.mutateAsync({ campaignId: id });
      toast.success("A campanha está a ser enviada.");
      invalidate();
      navigate(campaignHref(id), { replace: true });
    } catch (e) {
      setServerError(campaignErrorMessage(e, "Não foi possível enviar."));
    }
  };

  const schedule = async () => {
    const at = localInputToIso(scheduleAt);
    if (!id || !at) return;
    setServerError(null);
    try {
      await scheduleM.mutateAsync({ campaignId: id, data: { at } });
      toast.success(`Campanha agendada para ${fmtDateTime(at)}.`);
      invalidate();
      navigate(campaignHref(id), { replace: true });
    } catch (e) {
      setServerError(campaignErrorMessage(e, "Não foi possível agendar."));
    }
  };

  const remove = async () => {
    if (!id) return;
    const ok = await confirmDialog({
      title: "Apagar o rascunho?",
      message: `«${name.trim() || "Sem nome"}» desaparece. Isto não se desfaz.`,
      confirmLabel: "Apagar",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteM.mutateAsync({ campaignId: id });
      toast.success("Rascunho apagado.");
      invalidate();
      navigate(CAMPAIGNS_PATH, { replace: true });
    } catch (e) {
      toast.error(campaignErrorMessage(e));
    }
  };

  const setSeg = (patch: Partial<CampaignSegment>) => setSegment((s) => ({ ...s, ...patch }));
  const reach = step; // para a frente só por «Seguinte» (grava antes)
  const lastStep = CAMPAIGN_STEPS.length - 1;

  return (
    <div className="flex flex-col h-full min-h-0 gap-3" data-testid="campaign-wizard">
      <Stepper step={step} reach={reach} onGo={goTo} />

      {paused && (
        <p role="status" data-testid="campaigns-paused" className="shrink-0 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-200 text-sm px-3 py-2">
          {PAUSED_MSG}
          {status?.pausedReason ? ` (${status.pausedReason})` : ""}
        </p>
      )}

      <Card className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        {/* ── Passo 1 · Destinatários ─────────────────────────────────────────── */}
        {step === 0 && (
          <section className="space-y-4" data-testid="campaign-step-body-destinatarios">
            <Input
              label="Nome da campanha (só tu o vês)"
              value={name}
              maxLength={150}
              onChange={(e: any) => setName(e.target.value)}
              placeholder="Ex.: Promoção de outubro"
            />
            <Select
              label="Quem recebe"
              value={segment.type}
              onChange={(e: any) => setSegment({ type: e.target.value })}
            >
              {SEGMENT_OPTIONS.map((o) => (
                <option key={o.type} value={o.type}>
                  {o.label}
                </option>
              ))}
            </Select>
            <p className="text-xs text-zinc-500 -mt-2">{SEGMENT_OPTIONS.find((o) => o.type === segment.type)?.hint}</p>
            {(segment.type === "agenda_recent" || segment.type === "buyers") && (
              <Input
                label={segment.type === "buyers" ? "Últimos N dias (opcional)" : "Últimos N dias"}
                type="number"
                min={1}
                max={3650}
                inputMode="numeric"
                value={segment.days ?? ""}
                onChange={(e: any) => setSeg({ days: e.target.value === "" ? undefined : Number(e.target.value) })}
              />
            )}
            {segment.type === "tag" && (
              <Input label="Etiqueta" value={segment.tag ?? ""} onChange={(e: any) => setSeg({ tag: e.target.value })} placeholder="Ex.: vip" />
            )}
            {segment.type === "language" && (
              <Select label="Língua" value={segment.language ?? defaultLang} onChange={(e: any) => setSeg({ language: e.target.value })}>
                {langs.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.name}
                  </option>
                ))}
              </Select>
            )}

            <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/50 px-4 py-3" data-testid="campaign-audience" aria-live="polite">
              {countError ? (
                <p className="text-sm text-red-600 dark:text-red-400">{countError}</p>
              ) : !ready ? (
                <p className="text-sm text-zinc-500">Completa o segmento para ver quantos subscritos apanha.</p>
              ) : counting && count == null ? (
                <p className="text-sm text-zinc-500">A contar…</p>
              ) : (
                <>
                  <p className="text-2xl font-semibold tabular-nums" data-testid="campaign-audience-count">
                    {count ?? "—"}
                  </p>
                  <p className="text-sm text-zinc-500">
                    {count === 1 ? "subscrito apanhado" : "subscritos apanhados"} · só recebe quem aceitou novidades
                  </p>
                  {count === 0 && <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">Com 0 destinatários não se consegue enviar.</p>}
                </>
              )}
            </div>
            <ErrorList errors={byStep[0]} testId="campaign-readiness-0" />
          </section>
        )}

        {/* ── Passo 2 · Conteúdo ──────────────────────────────────────────────── */}
        {step === 1 && (
          <section className="space-y-4" data-testid="campaign-step-body-conteudo">
            {langs.length > 1 && (
              <Tabs
                size="sm"
                value={lang}
                onChange={setLang}
                tabs={langs.map((l) => ({
                  id: l.code,
                  label: l.code === defaultLang ? `${l.name} (por omissão)` : l.name,
                  ariaLabel: `Língua ${l.name}`,
                }))}
              />
            )}
            <div className="grid grid-cols-1 gap-3">
              <Input
                label={`Assunto (${lang.toUpperCase()})`}
                value={subjects[lang] ?? ""}
                maxLength={200}
                onChange={(e: any) => setSubjects((s) => ({ ...s, [lang]: e.target.value }))}
              />
              <Input
                label={`Pré-cabeçalho (${lang.toUpperCase()}, opcional)`}
                hint="A linha de texto que aparece a seguir ao assunto na caixa de entrada."
                value={preheaders[lang] ?? ""}
                maxLength={200}
                onChange={(e: any) => setPreheaders((s) => ({ ...s, [lang]: e.target.value }))}
              />
            </div>
            <CampaignBlocksEditor blocks={content[lang] ?? []} onChange={(b) => setContent((c) => ({ ...c, [lang]: b }))} />
            {contentError && (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400" data-testid="campaign-content-error">
                {contentError}
              </p>
            )}
            <ErrorList errors={byStep[1]} testId="campaign-readiness-1" />
            <CampaignPreview subject={subjects[lang] ?? ""} preheader={preheaders[lang] ?? ""} blocks={content[lang] ?? []} />
          </section>
        )}

        {/* ── Passo 3 · Teste ─────────────────────────────────────────────────── */}
        {step === 2 && (
          <section className="space-y-4" data-testid="campaign-step-body-teste">
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              Manda a campanha só para o teu email, para a veres na caixa de entrada antes de a enviar a toda a gente. O assunto leva «[Teste]».
            </p>
            <ErrorList errors={[...byStep[0], ...byStep[1]]} testId="campaign-readiness-2" />
            {contentLangs.length > 1 && (
              <Select label="Língua do teste" value={testLang} onChange={(e: any) => setTestLang(e.target.value)}>
                <option value="">Por omissão ({defaultLang.toUpperCase()})</option>
                {contentLangs.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.name}
                  </option>
                ))}
              </Select>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <GuardButton leaf="correio.campanhas" icon="send" isLoading={testM.isPending} disabled={testM.isPending || paused || !id} onClick={sendTest}>
                Enviar para mim
              </GuardButton>
              <span className="text-xs text-zinc-500" data-testid="campaign-test-limit">
                Limite: {status?.testDailyLimit ?? 10} testes por dia.
                {testsSent > 0 ? ` Enviaste ${testsSent} agora.` : ""}
              </span>
            </div>
          </section>
        )}

        {/* ── Passo 4 · Enviar ────────────────────────────────────────────────── */}
        {step === 3 && (
          <section className="space-y-4" data-testid="campaign-step-body-enviar">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div>
                <dt className="text-xs text-zinc-500">Campanha</dt>
                <dd className="font-medium break-words">{name.trim() || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Destinatários</dt>
                <dd className="font-medium" data-testid="campaign-summary-audience">
                  {segmentLabel(segment)} · {count != null ? `${count} subscritos` : "—"}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-zinc-500">Assunto ({defaultLang.toUpperCase()})</dt>
                <dd className="font-medium break-words">{subjects[defaultLang]?.trim() || "—"}</dd>
              </div>
              {status?.fromDomain && (
                <div className="sm:col-span-2">
                  <dt className="text-xs text-zinc-500">Sai de</dt>
                  <dd className="font-mono text-xs break-all">novidades@{status.fromDomain}</dd>
                </div>
              )}
            </dl>

            {incomplete && (
              <div className="space-y-2">
                <ErrorList errors={readiness} testId="campaign-readiness-3" />
                <Button size="sm" variant="outline" onClick={() => goTo(1)}>
                  Ir ao conteúdo
                </Button>
              </div>
            )}
            {count === 0 && <p className="text-sm text-amber-700 dark:text-amber-300">O segmento não apanha ninguém. Volta ao passo 1.</p>}

            {canSend ? (
              <div className="space-y-4">
                <GuardButton
                  leaf="correio.campanhas.enviar"
                  icon="send"
                  isLoading={sendM.isPending}
                  disabled={blockedSend || sendM.isPending || scheduleM.isPending}
                  onClick={sendNow}
                >
                  Enviar agora
                </GuardButton>
                <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 p-3 space-y-2">
                  <Input
                    label="Ou agendar para"
                    type="datetime-local"
                    {...({ min: minScheduleInput() } as Record<string, unknown>)}
                    value={scheduleAt}
                    onChange={(e: any) => setScheduleAt(e.target.value)}
                  />
                  <p className="text-xs text-zinc-500">Entre daqui a alguns minutos e 1 ano. Os destinatários contam-se à hora do envio.</p>
                  <GuardButton
                    leaf="correio.campanhas.enviar"
                    icon="clock"
                    variant="outline"
                    isLoading={scheduleM.isPending}
                    disabled={blockedSend || !localInputToIso(scheduleAt) || scheduleM.isPending || sendM.isPending}
                    onClick={schedule}
                  >
                    Agendar
                  </GuardButton>
                </div>
              </div>
            ) : (
              <p className="text-sm text-zinc-500" data-testid="campaign-no-send">
                Podes preparar e testar a campanha. Quem tem a permissão «Enviar campanhas» é que a envia ou agenda.
              </p>
            )}
          </section>
        )}

        {serverError && (
          <p role="alert" data-testid="campaign-error" className="text-sm text-red-600 dark:text-red-400">
            {serverError}
          </p>
        )}
      </Card>

      <div className="shrink-0 flex flex-wrap items-center gap-2">
        {step > 0 ? (
          <Button variant="outline" onClick={() => goTo(step - 1)} disabled={saving}>
            Voltar
          </Button>
        ) : (
          <Button variant="outline" onClick={() => navigate(CAMPAIGNS_PATH)}>
            Cancelar
          </Button>
        )}
        {id && (
          <GuardButton leaf="correio.campanhas" variant="ghost" icon="trash" onClick={remove} disabled={deleteM.isPending}>
            Apagar rascunho
          </GuardButton>
        )}
        <span className="flex-1" />
        {stepBlock && step < lastStep && (
          <span className="text-xs text-zinc-500 basis-full sm:basis-auto sm:order-none order-last" data-testid="campaign-step-block">
            {stepBlock}
          </span>
        )}
        {step < lastStep && (
          <GuardButton
            leaf="correio.campanhas"
            isLoading={saving}
            disabled={saving || !!stepBlock}
            onClick={next}
            data-testid="campaign-next"
          >
            {step === 0 && !id ? "Guardar e continuar" : "Seguinte"}
          </GuardButton>
        )}
        {step === lastStep && (
          <Badge tone={incomplete ? "amber" : "green"} dot>
            {incomplete ? "Falta completar" : "Pronta a enviar"}
          </Badge>
        )}
      </div>
    </div>
  );
}

