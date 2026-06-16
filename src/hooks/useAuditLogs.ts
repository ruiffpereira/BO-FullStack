import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "@kubb/plugin-client/clients/axios";
import { useAuth } from "../context/AuthContext";

export interface Actor {
  userId: string;
  name: string;
  email: string;
}

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
  durationMs: number | null;
  createdAt: string;
  actor?: Actor | null;
}

export interface ErrorLog {
  errorLogId: string;
  userId: string | null;
  method: string;
  path: string;
  statusCode: number;
  message: string | null;
  stack: string | null;
  requestBody: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
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
  const { authHeader, isAuthenticated } = useAuth();
  return useQuery<Paginated<AuditLog>>({
    queryKey: ["audit-logs", filters],
    enabled: isAuthenticated,
    queryFn: async () => {
      const res = await axiosInstance.get<Paginated<AuditLog>>("/audit-logs", {
        params: clean({ ...filters }),
        headers: authHeader(),
        withCredentials: true,
      });
      return res.data;
    },
  });
}

export function useErrorLogs(filters: AuditFilters = {}) {
  const { authHeader, isAuthenticated } = useAuth();
  return useQuery<Paginated<ErrorLog>>({
    queryKey: ["error-logs", filters],
    enabled: isAuthenticated,
    queryFn: async () => {
      const res = await axiosInstance.get<Paginated<ErrorLog>>("/error-logs", {
        params: clean({ ...filters }),
        headers: authHeader(),
        withCredentials: true,
      });
      return res.data;
    },
  });
}

export function useHealth() {
  const { isAuthenticated } = useAuth();
  return useQuery<Health>({
    queryKey: ["health"],
    enabled: isAuthenticated,
    refetchInterval: 30_000,
    queryFn: async () => {
      const res = await axiosInstance.get<Health>("/health", { withCredentials: true });
      return res.data;
    },
  });
}
