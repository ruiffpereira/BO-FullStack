import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import type { ExpenseCategory } from "../gen/backoffice/types/ExpenseCategory.js";
import { getExpensesCategories } from "../gen/backoffice/hooks/useGetExpensesCategories.js";
import { postExpensesCategories } from "../gen/backoffice/hooks/usePostExpensesCategories.js";
import { patchExpensesCategoriesId } from "../gen/backoffice/hooks/usePatchExpensesCategoriesId.js";
import { deleteExpensesCategoriesId } from "../gen/backoffice/hooks/useDeleteExpensesCategoriesId.js";

// Migrado (B18) para os clients gerados pelo Kubb — `ExpenseCategory` já vinha
// do gen, e os tipos de resposta dos 4 endpoints batem certo 1:1, sem casts.

export type { ExpenseCategory };

const KEY = ["expense-categories"];

export function useExpenseCategories() {
  const { isAuthenticated } = useAuth();
  return useQuery<ExpenseCategory[]>({
    queryKey: KEY,
    enabled: isAuthenticated,
    queryFn: async () => getExpensesCategories(),
  });
}

export function useCreateExpenseCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; color?: string }) => postExpensesCategories(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateExpenseCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; color?: string }) =>
      patchExpensesCategoriesId(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteExpenseCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteExpensesCategoriesId(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
