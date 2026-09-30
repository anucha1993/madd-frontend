import { apiClient } from "./apiClient";
import { API_URL } from "./apiUrl";
import { getToken } from "./auth";

// Packing Supplies stock per branch — see madd-backend SupplyStockService. Bookings deduct
// automatically (never blocked, balance may go negative); Void returns the units.
export type StockLevel = "low" | "over" | "ok";

export type StockBranch = { id: number; name: string; code: string | null };

export type StockCell = {
  branch_id: number;
  quantity: number;
  min_qty: number | null;
  max_qty: number | null;
  level: StockLevel;
};

export type StockSupplyRow = {
  id: number;
  name: string;
  type: string | null;
  status: boolean;
  stocks: StockCell[];
};

export type StockMovementType =
  "receive" | "adjust" | "shipment" | "shipment_return";

export type StockMovement = {
  id: number;
  type: StockMovementType;
  quantity: number;
  balance_after: number;
  reference: string | null;
  note: string | null;
  created_at: string;
  supply: { id: number; name: string } | null;
  branch: StockBranch | null;
  user: { id: number; name: string } | null;
  shipment: { id: number; tracking_number: string | null } | null;
};

export type StockReportRow = {
  supply_id: number;
  supply_name: string;
  branch_id: number;
  branch_name: string;
  opening: number;
  received: number;
  used: number;
  returned: number;
  adjusted: number;
  closing: number;
  min_qty: number | null;
  max_qty: number | null;
  level: StockLevel;
};

export const MOVEMENT_LABEL: Record<StockMovementType, string> = {
  receive: "รับเข้า",
  adjust: "ปรับยอด",
  shipment: "ใช้กับ Shipment",
  shipment_return: "คืนจาก Void",
};

const query = (params: Record<string, string | number | undefined>) => {
  const q = new URLSearchParams();
  Object.entries(params).forEach(
    ([k, v]) => v !== undefined && v !== "" && q.set(k, String(v)),
  );
  const s = q.toString();
  return s ? `?${s}` : "";
};

export const getSupplyStock = () =>
  apiClient.get<{ branches: StockBranch[]; supplies: StockSupplyRow[] }>(
    "/supply-stock",
  );

export type MovementFilters = {
  supply_id?: number;
  branch_id?: number;
  type?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
};

export const listStockMovements = (filters: MovementFilters) =>
  apiClient.get<{
    data: StockMovement[];
    current_page: number;
    last_page: number;
    total: number;
  }>(`/supply-stock/movements${query(filters)}`);

export const receiveStock = (data: {
  supply_id: number;
  branch_id: number;
  quantity: number;
  reference?: string;
  note?: string;
}) => apiClient.post<StockMovement>("/supply-stock/receive", data);

export const adjustStock = (data: {
  supply_id: number;
  branch_id: number;
  counted: number;
  note: string;
}) =>
  apiClient.post<{ movement: StockMovement | null }>(
    "/supply-stock/adjust",
    data,
  );

export const setStockLimits = (data: {
  supply_id: number;
  branch_id: number;
  min_qty: number | null;
  max_qty: number | null;
}) => apiClient.put<StockCell>("/supply-stock/limits", data);

export type ReportFilters = {
  date_from?: string;
  date_to?: string;
  branch_id?: number;
};

export const getStockReport = (filters: ReportFilters) =>
  apiClient.get<{ date_from: string; date_to: string; rows: StockReportRow[] }>(
    `/supply-stock/report${query(filters)}`,
  );

export async function downloadStockReport(filters: ReportFilters) {
  const token = getToken();
  const res = await fetch(
    `${API_URL}/supply-stock/report/export${query(filters)}`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
  );
  if (!res.ok) throw new Error("ไม่สามารถ Export รายงาน Stock ได้");
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = `supply-stock-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
