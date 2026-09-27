import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { getAuditLogs as getAuditLogsGen } from "../gen/backoffice/hooks/useGetAuditLogs.js";
import { getHealth } from "../gen/backoffice/hooks/useGetHealth.js";
import type { AuditLog as GenAuditLog } from "../gen/backoffice/types/AuditLog.js";
import type { AuditLogActor } from "../gen/backoffice/types/AuditLogActor.js";
import type { GetAuditLogs200 } from "../gen/backoffice/types/GetAuditLogs.js";

/**
 * Tipos DERIVADOS do gerado, nunca uma `interface` à mão ao lado: dois tipos a
 * descrever a mesma resposta foi o que segurou o cast do `/analytics/site`
 * (B20) — o gerado corrigia-se e o local continuava a mentir.
 */
export type Actor = AuditLogActor;

/**
 * Registo unificado de atividade: uma ação de backoffice, um evento de
 * autenticação ou um erro de servidor (5xx). Nos erros, `message`/`stack`
 * vêm preenchidos (a antiga tabela ErrorLogs foi fundida nesta).
 */
export type AuditLog = GenAuditLog;

export type Paginated<T> = Omit<GetAuditLogs200, "rows"> & { rows: T[] };

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
      // Cast caiu (B20): o schema de cada linha (`AuditLog`) passou a
      // declarar `required` em todos os campos no `@swagger` da API — a par
      // do envelope (`count`/`page`/`limit`/`rows`, já corrigido em
      // API-FullStack@68f8036) — `getAuditLogsGen` devolve `GetAuditLogs200`,
      // já compatível com `Paginated<AuditLog>` sem cast.
      return await getAuditLogsGen(params);
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
