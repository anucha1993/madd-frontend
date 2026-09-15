import { apiClient } from "./apiClient";
import { API_URL } from "./apiUrl";
import { getToken } from "./auth";

export type BookShipmentPackageInput = {
  weight: number;
  length?: number;
  width?: number;
  height?: number;
  quantity?: number;
  description?: string;
  is_document?: boolean;
  declared_value?: number;
  // Which Insurance Add-on (if any) was sold for this package — lets the backend decide whether
  // to declare this value to the carrier as ITS OWN insurance service (never for UPSC).
  insurance_addon_item_id?: number | null;
};

export type BookShipmentAddonLine = {
  name: string;
  category?: string;
  quantity: number;
  unit_price: number;
};

export type BookShipmentInput = {
  agent_account_id: number;
  carrier: "UPS" | "DHL";
  service_code: string;
  service_label?: string;
  origin: {
    contact_name?: string;
    company?: string;
    postcode: string;
    city: string;
    address: string;
    address2?: string;
    address3?: string;
    phone?: string;
  };
  destination: {
    contact_name?: string;
    company?: string;
    country: string;
    city: string;
    postcode?: string;
    address?: string;
    address2?: string;
    address3?: string;
    phone?: string;
    email?: string;
  };
  packages: BookShipmentPackageInput[];
  declared_value_currency?: string;
  addon_lines?: BookShipmentAddonLine[];
  freight_amount: number;
  addon_total: number;
  order_total: number;
  currency?: string;
};

export type Shipment = {
  id: number;
  agent_account_id: number;
  carrier: "UPS" | "DHL";
  service_code: string;
  service_label: string | null;
  tracking_number: string | null;
  status: "pending" | "booked" | "failed";
  origin?: { contact_name?: string; city?: string } | null;
  destination?: { contact_name?: string; city?: string; country?: string } | null;
  freight_amount: number;
  addon_total: number;
  order_total: number;
  currency: string;
  label_storage_key: string | null;
  error_message: string | null;
  created_at: string;
};

export type PaginatedShipments = {
  data: Shipment[];
  current_page: number;
  last_page: number;
  total: number;
};

export const listShipments = (params?: { search?: string; carrier?: "UPS" | "DHL"; status?: string; page?: number }) => {
  const query = new URLSearchParams();
  if (params?.search) query.set("search", params.search);
  if (params?.carrier) query.set("carrier", params.carrier);
  if (params?.status) query.set("status", params.status);
  if (params?.page) query.set("page", String(params.page));
  const qs = query.toString();
  return apiClient.get<PaginatedShipments>(`/shipments${qs ? `?${qs}` : ""}`);
};

export const bookShipment = (data: BookShipmentInput) => apiClient.post<Shipment>("/shipments", data);

// The label route returns a raw binary file (not JSON) and needs the Bearer token — apiClient
// can't be reused as-is, so this fetches the blob and opens a dedicated print-preview window
// (UPS GIF labels come back rotated 90° — rotated back here for a normal upright read/print;
// PDF labels from DHL are already upright, just shown full-page and print() is triggered too).
export async function openShipmentLabel(shipmentId: number) {
  // Must open synchronously within the click handler, before the async fetch, or popup blockers
  // will silently swallow it.
  const printWindow = window.open("", "_blank");

  const token = getToken();
  const res = await fetch(`${API_URL}/shipments/${shipmentId}/label`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    printWindow?.close();
    throw new Error("เปิด Label ไม่สำเร็จ");
  }

  const contentType = res.headers.get("Content-Type") || "application/octet-stream";
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);

  if (!printWindow) {
    // Popup blocked — fall back to a plain new tab (no auto-rotate/auto-print).
    window.open(url, "_blank");
    return;
  }

  if (contentType.startsWith("image/")) {
    printWindow.document.write(
      `<!DOCTYPE html><html><head><title>Shipping Label</title><style>
        html,body{margin:0;height:100%;background:#525659;display:flex;align-items:center;justify-content:center;}
        img{transform:rotate(90deg);max-width:90vh;max-height:90vw;}
        @media print{html,body{background:#fff;}}
      </style></head><body><img id="label-img" src="${url}" /></body></html>`,
    );
    printWindow.document.close();
    const img = printWindow.document.getElementById("label-img") as HTMLImageElement | null;
    if (img) img.onload = () => printWindow.print();
  } else {
    printWindow.document.write(
      `<!DOCTYPE html><html><head><title>Shipping Label</title><style>
        html,body,iframe{margin:0;padding:0;width:100%;height:100%;border:0;}
      </style></head><body><iframe id="label-frame" src="${url}"></iframe></body></html>`,
    );
    printWindow.document.close();
    const frame = printWindow.document.getElementById("label-frame") as HTMLIFrameElement | null;
    if (frame) {
      frame.onload = () => {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
      };
    }
  }
}
