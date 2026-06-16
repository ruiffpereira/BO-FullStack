import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { axiosInstance } from "@kubb/plugin-client/clients/axios";
import { useAuth } from "../context/AuthContext";
import type { ExpenseCategory } from "../gen/backoffice/types/ExpenseCategory.js";

export type { ExpenseCategory };

const KEY = ["expense-categories"];

export function useExpenseCategories() {
  const { authHeader, isAuthenticated } = useAuth();
  return useQuery<ExpenseCategory[]>({
    queryKey: KEY,
    enabled: isAuthenticated,
    queryFn: async () => {
      const res = await axiosInstance.get<ExpenseCategory[]>("/expenses/categories", {
        headers: authHeader(),
        withCredentials: true,
      });
      return res.data;
    },
  });
}

export function useCreateExpenseCategory() {
  const { authHeader } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; color?: string }) => {
      const res = await axiosInstance.post("/expenses/categories", data, {
        headers: authHeader(),
        withCredentials: true,
      });
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateExpenseCategory() {
  const { authHeader } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; color?: string }) => {
      const res = await axiosInstance.patch(`/expenses/categories/${id}`, data, {
        headers: authHeader(),
        withCredentials: true,
      });
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteExpenseCategory() {
  const { authHeader } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await axiosInstance.delete(`/expenses/categories/${id}`, {
        headers: authHeader(),
        withCredentials: true,
      });
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
