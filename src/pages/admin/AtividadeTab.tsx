import { useState } from "react";
import { Card, Badge, Input, Modal, Tabs } from "../../ui/ui.jsx";
import { Combobox } from "../../components/Combobox";
import { Pagination } from "../../components/Pagination";
import { useGetAdminSecurityIdor } from "../../gen/backoffice/hooks/useGetAdminSecurityIdor.js";
import { formatDatePt } from "../../lib/supportLog";
import { useAuditLogs, useHealth, type AuditLog } from "../../hooks/useAuditLogs";
import { EmailStatusCard } from "../../components/AdminEmailModal";
import { EmptyRow, TableWrapper, fmtDateTime } from "./shared";

// ─── Atividade (audit log) tab ──────────────────────────────────────────────
const METHOD_TONE: Record<string, "green" | "amber" | "red" | "neutral"> = {
  POST: "green",
  PUT: "amber",
  PATCH: "amber",
  DELETE: "red",
};
const fmtUptime = (sec: number) => {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return [d ? `${d}d` : "", h ? `${h}h` : "", `${m}m`].filter(Boolean).join(" ");
};

export function AtividadeTab() {
  const [page, setPage] = useState(1);
  const [method, setMethod] = useState("");
  const [q, setQ] = useState("");
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [detail, setDetail] = useState<AuditLog | null>(null);
  const [bodyTab, setBodyTab] = useState<"enviado" | "recebido">("enviado");

  const { data, isLoading } = useAuditLogs({
    page,
    limit: 50,
    method: method || undefined,
    q: q || undefined,
    errors: onlyErrors ? "true" : undefined,
  });
  const rows = data?.rows ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.count / data.limit)) : 1;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex-1 min-w-[180px]">
          <Input
            icon="search"
            placeholder="Pesquisar (path, ator, recurso, mensagem)…"
            value={q}
            onChange={(e: any) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Combobox
          className="w-48"
          value={method}
          onChange={(v) => {
            setMethod(v);
            setPage(1);
          }}
          options={[
            { value: "", label: "Todos os métodos" },
            { value: "POST", label: "POST (criar)" },
            { value: "PUT", label: "PUT (editar)" },
            { value: "PATCH", label: "PATCH (editar)" },
            { value: "DELETE", label: "DELETE (eliminar)" },
          ]}
          placeholder="Todos os métodos"
          searchPlaceholder="Pesquisar…"
        />
        <button
          type="button"
          onClick={() => {
            setOnlyErrors((v) => !v);
            setPage(1);
          }}
          className={`px-3 py-2 rounded-lg text-sm font-medium border transition whitespace-nowrap ${
            onlyErrors
              ? "border-red-300 bg-red-50 text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400"
              : "border-zinc-200 text-zinc-500 hover:text-zinc-800 dark:border-zinc-800 dark:hover:text-zinc-200"
          }`}
        >
          Só erros
        </button>
      </div>

      <TableWrapper>
        <thead className="text-left text-xs uppercase tracking-wide text-zinc-400 border-b border-zinc-100 dark:border-zinc-800">
          <tr>
            <th className="px-4 py-3">Quando</th>
            <th className="px-4 py-3">Ator</th>
            <th className="px-4 py-3">Ação</th>
            <th className="px-4 py-3 hidden lg:table-cell">Recurso</th>
            <th className="px-4 py-3">Estado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {isLoading ? (
            <EmptyRow cols={5} />
          ) : rows.length === 0 ? (
            <EmptyRow cols={5} />
          ) : (
            rows.map((r) => (
              <tr
                key={r.auditLogId}
                onClick={() => { setDetail(r); setBodyTab("enviado"); }}
                className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
              >
                <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">{fmtDateTime(r.createdAt)}</td>
                <td className="px-4 py-3">{r.actor?.name ?? r.actorName ?? "—"}</td>
                <td className="px-4 py-3">
                  <Badge tone={METHOD_TONE[r.method] ?? "neutral"}>{r.method}</Badge>
                </td>
                <td className="px-4 py-3 text-zinc-500 hidden lg:table-cell">
                  {r.resourceType ?? "—"}
                  {r.resourceId ? <span className="text-zinc-400"> · {String(r.resourceId).slice(0, 8)}</span> : null}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={r.success ? "green" : "red"}>{r.statusCode}</Badge>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </TableWrapper>

      <div className="mt-4">
        <Pagination page={page} setPage={setPage} pageCount={totalPages} total={data?.count ?? 0} start={(page - 1) * 50} end={Math.min(page * 50, data?.count ?? 0)} />
      </div>

      <Modal open={!!detail} onClose={() => setDetail(null)} title="Detalhe da ação" width="max-w-2xl">
        {detail && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div><span className="text-zinc-400">Quando</span><p>{fmtDateTime(detail.createdAt)}</p></div>
              <div><span className="text-zinc-400">Ator</span><p>{detail.actor?.name ?? detail.actorName ?? "—"} {detail.actor?.email ? `(${detail.actor.email})` : ""}</p></div>
              <div><span className="text-zinc-400">Método</span><p>{detail.method}</p></div>
              <div><span className="text-zinc-400">Estado</span><p>{detail.statusCode} {detail.success ? "✓" : "✗"}</p></div>
              <div className="col-span-2"><span className="text-zinc-400">Path</span><p className="font-mono text-xs break-all">{detail.path}</p></div>
              <div><span className="text-zinc-400">Recurso</span><p>{detail.resourceType ?? "—"} {detail.resourceId ?? ""}</p></div>
              <div><span className="text-zinc-400">Duração</span><p>{detail.durationMs != null ? `${detail.durationMs} ms` : "—"}</p></div>
              <div className="col-span-2"><span className="text-zinc-400">IP / Cliente</span><p className="text-xs">{detail.ip ?? "—"} · {detail.userAgent ?? "—"}</p></div>
            </div>
            {(detail.message || detail.stack) && (
              <div className="rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50/60 dark:bg-red-950/30 p-3">
                <span className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide">Erro do sistema</span>
                {detail.message && <p className="mt-1 text-sm">{detail.message}</p>}
                {detail.stack && (
                  <pre className="mt-2 p-3 rounded-lg bg-white/70 dark:bg-zinc-900/60 text-xs overflow-x-auto whitespace-pre-wrap">{detail.stack}</pre>
                )}
              </div>
            )}
            <div>
              <Tabs
                size="sm"
                className="mb-2"
                tabs={[{ id: "enviado", label: "Enviado" }, { id: "recebido", label: "Recebido" }]}
                value={bodyTab}
                onChange={(id: string) => setBodyTab(id as "enviado" | "recebido")}
              />
              {(() => {
                const body = bodyTab === "enviado" ? detail.requestBody : detail.responseBody;
                return body ? (
                  <pre className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 text-xs overflow-x-auto whitespace-pre-wrap">{JSON.stringify(body, null, 2)}</pre>
                ) : (
                  <p className="text-xs text-zinc-400 px-1">{bodyTab === "enviado" ? "Sem corpo no pedido." : "Sem corpo na resposta."}</p>
                );
              })()}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─── Sistema (health) tab ────────────────────────────────────────────────────
// Os erros recentes deixaram de viver aqui — estão na aba Atividade (filtro "Só erros").
export function SistemaTab() {
  const { data: health } = useHealth();
  const dbUp = health?.db === "up";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-[13px] text-zinc-500">Estado</p>
          <p className="mt-1 flex items-center gap-2 text-lg font-semibold">
            <span className={`w-2.5 h-2.5 rounded-full ${dbUp ? "bg-emerald-500" : "bg-red-500"}`} />
            {health?.status ?? "—"}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-[13px] text-zinc-500">Base de dados</p>
          <p className="mt-1 text-lg font-semibold">{health?.db ?? "—"}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[13px] text-zinc-500">Uptime</p>
          <p className="mt-1 text-lg font-semibold">{health ? fmtUptime(health.uptimeSeconds) : "—"}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[13px] text-zinc-500">Versão</p>
          <p className="mt-1 text-lg font-semibold">{health?.version ?? "—"}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <IdorProbesCard />
        <EmailStatusCard />
      </div>

      <p className="text-sm text-zinc-500">
        Os erros do sistema (5xx) aparecem agora na aba <span className="font-medium text-zinc-700 dark:text-zinc-300">Atividade</span>, com o filtro <span className="font-medium text-red-600 dark:text-red-400">Só erros</span>.
      </p>
    </div>
  );
}

// ─── Tentativas de acesso por id (IDOR) ──────────────────────────────────────
// 403/404 em rotas autenticadas com um id: o sinal de alguém a experimentar ids (não prova que o id era de outro
// negócio). A API agrega por dia/actor/IP; "suspeito" = 50 ou mais num dia.
const ACTOR_LABEL: Record<string, string> = { user: "Dono", member: "Equipa", customer: "Cliente do site" };

function IdorProbesCard() {
  const { data, isLoading, isError } = useGetAdminSecurityIdor({ days: 7 });
  const suspects = data?.suspects ?? [];

  return (
    <Card className="p-4 space-y-4" data-testid="idor-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">Tentativas de acesso por id · 7 dias</h3>
          <p className="text-[13px] text-zinc-500">Pedidos recusados (403/404) a recursos por id. Suspeito: 50 ou mais num dia.</p>
        </div>
        <p className="text-2xl font-semibold tabular-nums" data-testid="idor-total">{isLoading ? "…" : (data?.total ?? 0)}</p>
      </div>

      {isError ? (
        <p className="text-sm text-red-600 dark:text-red-400">Não foi possível carregar.</p>
      ) : suspects.length === 0 ? (
        !isLoading && <p className="text-sm text-zinc-500">Nenhum actor suspeito nos últimos 7 dias.</p>
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800" aria-label="Actores suspeitos">
          {suspects.map((p) => (
            <li key={`${p.day}-${p.actorType}-${p.actorId}-${p.ip}`} className="py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <Badge tone="red" className="whitespace-nowrap">{p.count}×</Badge>
              <span className="font-medium min-w-0 truncate">{p.actorName ?? "—"}</span>
              <span className="text-zinc-500">{ACTOR_LABEL[p.actorType ?? ""] ?? p.actorType}{p.tenantName ? ` · ${p.tenantName}` : ""}</span>
              <span className="text-zinc-500 tabular-nums">{formatDatePt(p.day)} · {p.ip}</span>
              {p.lastRoute && <code className="basis-full text-xs text-zinc-400 break-all">{p.lastRoute}</code>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
