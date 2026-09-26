import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { getAuditLogs as getAuditLogsGen } from "../gen/backoffice/hooks/useGetAuditLogs.js";
import { getHealth } from "../gen/backoffice/hooks/useGetHealth.js";

export interface Actor {
  userId: string;
  name: string;
  email: string;
}

/**
 * Registo unificado de atividade: uma ação de backoffice, um evento de
 * autenticação ou um erro de servidor (5xx). Nos erros, `message`/`stack`
 * vêm preenchidos (a antiga tabela ErrorLogs foi fundida nesta).
 */
export interface AuditLog {
  auditLogId: string;
  userId: string | null;
  actorName: string | null;
  method: string;
  path: string;
  resourceType: string | null;
  resourceId: string | null;
  statusCode: number;
  success: boolean;
  ip: string | null;
  userAgent: string | null;
  requestBody: Record<string, unknown> | null;
  responseBody: Record<string, unknown> | null;
  durationMs: number | null;
  message: string | null;
  stack: string | null;
  createdAt: string;
  actor?: Actor | null;
}

export interface Paginated<T> {
  count: number;
  page: number;
  limit: number;
  rows: T[];
}

export interface AuditFilters {
  page?: number;
  limit?: number;
  method?: string;
  resourceType?: string;
  success?: string;
  /** "true" → só erros de sistema (statusCode >= 500). */
  errors?: string;
  from?: string;
  to?: string;
  q?: string;
}

export interface Health {
  status: string;
  db: "up" | "down";
  uptimeSeconds: number;
  version: string;
  timestamp: string;
}

const clean = (o: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== "" && v !== null));

export function useAuditLogs(filters: AuditFilters = {}) {
  const { isAuthenticated } = useAuth();
  return useQuery<Paginated<AuditLog>>({
    queryKey: ["audit-logs", filters],
    enabled: isAuthenticated,
    queryFn: async () => {
      // B19: `success`/`errors` passaram de boolean a string no QueryParams
      // gerado — já não precisa de ponte de tipos (o `clean()` abaixo já
      // devolve algo compatível, sem cast).
      const params = clean({ ...filters });
      const data = await getAuditLogsGen(params);
      // Cast ainda necessário (medido a 2026-09-26, B20): o ENVELOPE já está
      // certo (`count`/`page`/`limit`/`rows` em `required`, API@68f8036), mas o
      // schema de cada linha (`AuditLog`) continua sem `required` — `userId`,
      // `method`, … saem todos opcionais no gerado. Falta o `required` nesse
      // schema, no `@swagger` da API.
      return data as Paginated<AuditLog>;
    },
  });
}

export function useHealth() {
  const { isAuthenticated } = useAuth();
  return useQuery<Health>({
    queryKey: ["health"],
    enabled: isAuthenticated,
    refetchInterval: 30_000,
    queryFn: async () => (await getHealth()) as Health,
  });
}
