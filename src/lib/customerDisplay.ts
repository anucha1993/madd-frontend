import { apiClient } from "./apiClient";

/**
 * Customer Display — a 2nd screen facing the customer, on the same computer as Create Shipment.
 * The two windows talk through a BroadcastChannel (browser only, no server). Create Shipment builds
 * a whitelisted DisplayState (sell prices only — never cost, markup, formulas or raw carrier data)
 * and posts it on every change; the display page only renders what it receives.
 */

export type CustomerDisplaySection =
  | "recipient"
  | "contact"
  | "packages"
  | "billed_weight"
  | "quotes"
  | "transit"
  | "breakdown"
  | "addons"
  | "total"
  | "tracking";

export type CustomerDisplaySettings = {
  sections: Record<CustomerDisplaySection, boolean>;
  quotes_mode: "all" | "selected" | "cheapest_per_carrier";
  quotes_sort: "price" | "transit";
  idle: { title: string | null; subtitle: string | null; logo_url: string | null; images: string[]; image_seconds: number };
  brand: { shop_name: string | null; primary_color: string; accent_color: string; font_size: "normal" | "large" };
  thank_you: { message: string | null; return_seconds: number };
};

// Same as the backend's CustomerDisplaySettings::defaults() — used until the real ones load.
export const DEFAULT_CUSTOMER_DISPLAY_SETTINGS: CustomerDisplaySettings = {
  sections: {
    recipient: true,
    contact: false,
    packages: true,
    billed_weight: true,
    quotes: true,
    transit: true,
    breakdown: false,
    addons: true,
    total: true,
    tracking: true,
  },
  quotes_mode: "all",
  quotes_sort: "price",
  idle: { title: "ยินดีต้อนรับ", subtitle: "บริการส่งพัสดุด่วนทั่วโลก UPS · DHL", logo_url: "", images: [], image_seconds: 8 },
  brand: { shop_name: "MADD", primary_color: "#333B42", accent_color: "#F5A623", font_size: "normal" },
  thank_you: { message: "ขอบคุณที่ใช้บริการ", return_seconds: 30 },
};

export const SECTION_LABELS: Record<CustomerDisplaySection, { label: string; hint?: string }> = {
  recipient: { label: "ที่อยู่ผู้รับ", hint: "ชื่อ บริษัท ที่อยู่ ประเทศ — ให้ลูกค้าตรวจความถูกต้อง" },
  contact: { label: "เบอร์โทร / อีเมลผู้รับ", hint: "ข้อมูลส่วนตัว" },
  packages: { label: "รายการกล่อง", hint: "จำนวน ขนาด น้ำหนัก" },
  billed_weight: { label: "น้ำหนักที่คิดเงิน", hint: "ช่วยอธิบายว่าทำไมกล่องใหญ่คิดแพงขึ้น" },
  quotes: { label: "ตัวเลือกราคาจาก Check Rate" },
  transit: { label: "ระยะเวลาจัดส่ง" },
  breakdown: { label: "ราคาแยกบรรทัด", hint: "ปิด = เห็นแค่ยอดรวมของบริการ" },
  addons: { label: "Add-on / ประกัน / วัสดุ" },
  total: { label: "ยอดรวมสุดท้าย" },
  tracking: { label: "เลข Tracking หลังจองเสร็จ" },
};

export const getCustomerDisplaySettings = () => apiClient.get<CustomerDisplaySettings>("/customer-display/settings");

export const saveCustomerDisplaySettings = (settings: CustomerDisplaySettings) =>
  apiClient.put<CustomerDisplaySettings>("/customer-display/settings", settings);

// ---- What travels to the display (whitelisted, sell side only) ----

// Shown when no logo link is set — the same MADD logo as the app's.
export const DEFAULT_DISPLAY_LOGO = "/logo-250.png";

export type DisplayQuote = {
  carrier: string;
  carrierLogo: string | null;
  service: string;
  price: number;
  currency: string;
  transitDays: number | null;
  selected: boolean;
};

export type DisplayState = {
  stage: "idle" | "shipping" | "quotes" | "selected" | "booked";
  settings: CustomerDisplaySettings;
  recipient?: { name: string; company: string; lines: string[]; country: string; countryCode: string };
  contact?: { phone: string; email: string };
  packages?: { kind: "box" | "document"; dims: string | null; weight: number; quantity: number }[];
  weight?: { pieces: number; total: number; billed: number | null; unit: string };
  quotes?: DisplayQuote[];
  selected?: DisplayQuote & { lines?: { name: string; amount: number }[] };
  addons?: { name: string; quantity: number; amount: number }[];
  total?: { amount: number; currency: string };
  booked?: { carrier: string; tracking: string | null };
};

export const CUSTOMER_DISPLAY_CHANNEL = "madd-customer-display";
export const CUSTOMER_DISPLAY_PATH = "/customer-display";

export type DisplayMessage = { type: "state"; state: DisplayState } | { type: "hello" };

export const openDisplayChannel = (): BroadcastChannel | null =>
  typeof window !== "undefined" && "BroadcastChannel" in window ? new BroadcastChannel(CUSTOMER_DISPLAY_CHANNEL) : null;
