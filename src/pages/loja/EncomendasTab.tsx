import { useState, useEffect } from "react";
import { Pagination, serverPagination } from "../../components/Pagination";
import { toast } from "sonner";
import { getApiError } from "../../lib/apiError";
import { useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { Icon } from "../../ui/icons.jsx";
import { Card, BADGE_TONES } from "../../ui/ui.jsx";
import { GuardSelect } from "../../components/GuardButton";
import { fmtEur } from "../../lib/money";
import { invalidateMoney } from "../../lib/invalidateMoney";
import { StaffFilterSelect } from "../../components/StaffSelect";
import { useStaffOptions } from "../../hooks/useStaff";
import { STAFF_ALL, staffParam, staffPickOptions } from "../../lib/staffFilter";
import { usePutOrdersId } from "../../gen/backoffice/hooks/usePutOrdersId.js";
import { useGetOrders } from "../../gen/backoffice/hooks/useGetOrders.js";

export const ORDERS_PAGE_SIZE = 20;

/** Separador «Encomendas» da Loja: lista paginada no servidor, total faturado e «Vendido por». */
export function EncomendasTab() {
  const qc = useQueryClient();
  // Profissionais: filtro da lista de encomendas (`?staff=`) e «Vendido por» por encomenda.
  const [staffSel, setStaffSel] = useState<string>(STAFF_ALL);
  const staffFilter = staffParam(staffSel);
  const { staff: staffList, hasStaff } = useStaffOptions();
  // Encomendas paginadas NO SERVIDOR (a API devolve count + totais); antes só se viam as 20 mais recentes.
  const [ordersPage, setOrdersPage] = useState(1);
  useEffect(() => { setOrdersPage(1); }, [staffFilter]);
  const { data: ordersData, isLoading: loadingOrders } = useGetOrders(
    { page: ordersPage, limit: ORDERS_PAGE_SIZE, ...(staffFilter ? { staff: staffFilter } : {}) },
    { query: { placeholderData: keepPreviousData } },
  );
  const setSoldBy = usePutOrdersId({
    mutation: {
      onSuccess: () => {
        toast.success("Vendedor actualizado");
        invalidateMoney(qc);
      },
      onError: (error) => toast.error(getApiError(error)),
    },
  });

  const orders = ordersData?.rows ?? [];
  const totalRevenue = ordersData?.stats?.billed ?? 0;
  const pgOrders = serverPagination(ordersPage, setOrdersPage, ordersData?.count ?? 0, ORDERS_PAGE_SIZE, orders.length);

  return (
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-4">
          <Card className="p-4 flex items-center gap-3 w-fit">
            <span
              className={`w-10 h-10 rounded-lg flex items-center justify-center ${BADGE_TONES.green}`}
            >
              <Icon name="euro" className="w-5 h-5" />
            </span>
            <div>
              <p className="text-xl font-semibold text-zinc-900 dark:text-white tabular-nums">
                {fmtEur(totalRevenue)}
              </p>
              <p className="text-[13px] text-zinc-500">Total faturado</p>
            </div>
          </Card>
          <StaffFilterSelect value={staffSel} onChange={setStaffSel} />
          </div>
          <Card className="overflow-hidden">
            {loadingOrders ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-12 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800"
                  />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 dark:border-zinc-800 text-left text-zinc-500">
                      <th className="font-medium px-4 sm:px-5 py-3">ID</th>
                      <th className="font-medium px-4 py-3">Total</th>
                      {hasStaff && <th className="font-medium px-4 py-3">Vendido por</th>}
                      <th className="font-medium px-4 py-3 hidden md:table-cell">
                        Data
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.length === 0 && (
                      <tr>
                        <td
                          colSpan={hasStaff ? 4 : 3}
                          className="px-4 py-8 text-center text-zinc-400"
                        >
                          Nenhuma encomenda encontrada.
                        </td>
                      </tr>
                    )}
                    {orders.map((o) => (
                      <tr
                        key={o.orderId}
                        className="border-b border-zinc-50 dark:border-zinc-800/50 last:border-0 hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 transition"
                      >
                        <td className="px-4 sm:px-5 py-3.5 font-mono text-xs text-zinc-500">
                          {o.orderId.slice(0, 8)}…
                        </td>
                        <td className="px-4 py-3.5 font-semibold text-zinc-900 dark:text-white tabular-nums">
                          {fmtEur(Number(o.price))}
                        </td>
                        {hasStaff && (
                          <td className="px-4 py-3.5">
                            <GuardSelect
                              aria-label={`Vendido por (encomenda ${o.orderId.slice(0, 8)})`}
                              value={o.soldByStaffId ?? ""}
                              disabled={setSoldBy.isPending}
                              onChange={(e) =>
                                setSoldBy.mutate({ id: o.orderId, data: { soldByStaffId: e.target.value || null } })
                              }
                              className="max-w-[10rem] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm px-2 py-1 disabled:opacity-50"
                            >
                              {staffPickOptions(staffList, o.soldByStaffId, "—").map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </GuardSelect>
                          </td>
                        )}
                        <td className="px-4 py-3.5 text-zinc-400 hidden md:table-cell">
                          {o.createdAt
                            ? new Date(o.createdAt).toLocaleDateString("pt-PT")
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {!loadingOrders && <div className="px-4 sm:px-5 pb-2"><Pagination {...pgOrders} /></div>}
          </Card>
        </div>
  );
}
