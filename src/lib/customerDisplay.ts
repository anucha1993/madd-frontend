import { apiClient } from "./apiClient";
import { API_URL } from "./apiUrl";

/**
 * Customer Display — a 2nd screen facing the customer. Create Shipment builds a whitelisted
 * DisplayState (sell prices only — never cost, markup, formulas or raw carrier data) and sends it
 * on every change; the display page only renders what it receives.
 *
 * - Same computer: the two windows talk through a BroadcastChannel (no server).
 * - Another computer (a tablet / PC at the counter): Create Shipment also relays the state
 *   through the API under this counter's random key, and the display opened with
 *   /customer-display?k=<key> polls it (see CustomerDisplayController::live).
 */

// No transit time — estimated delivery days are never shown to the customer.
export type CustomerDisplaySection =
  | "sender"
  | "recipient"
  | "contact"
  | "packages"
  | "billed_weight"
  | "quotes"
  | "breakdown"
  | "addons"
  | "total"
  | "tracking";

export type CustomerDisplaySettings = {
  sections: Record<CustomerDisplaySection, boolean>;
  quotes_mode: "all" | "selected" | "cheapest_per_carrier";
  quotes_sort: "price";
  idle: { title: string | null; subtitle: string | null; logo_url: string | null; images: string[]; image_seconds: number };
  brand: { shop_name: string | null; primary_color: string; accent_color: string; font_size: "normal" | "large" };
  // One ad banner on the transaction screen (1600 × 300) — an uploaded image or a link; "" = none.
  banner: { image_url: string | null };
  thank_you: { message: string | null; return_seconds: number };
};

// Same as the backend's CustomerDisplaySettings::defaults() — used until the real ones load.
export const DEFAULT_CUSTOMER_DISPLAY_SETTINGS: CustomerDisplaySettings = {
  sections: {
    sender: true,
    recipient: true,
    contact: false,
    packages: true,
    billed_weight: true,
    quotes: true,
    breakdown: false,
    addons: true,
    total: true,
    tracking: true,
  },
  quotes_mode: "all",
  quotes_sort: "price",
  idle: { title: "Welcome", subtitle: "Worldwide express delivery · UPS · DHL", logo_url: "", images: [], image_seconds: 8 },
  brand: { shop_name: "MADD", primary_color: "#333B42", accent_color: "#F5A623", font_size: "normal" },
  banner: { image_url: "" },
  thank_you: { message: "Thank you for shipping with us", return_seconds: 30 },
};

export const SECTION_LABELS: Record<CustomerDisplaySection, { label: string; hint?: string }> = {
  sender: { label: "ข้อมูลผู้ส่ง (ลูกค้า)", hint: "ชื่อ บริษัท ที่อยู่ผู้ส่ง" },
  recipient: { label: "ที่อยู่ผู้รับ", hint: "ชื่อ บริษัท ที่อยู่ ประเทศ — ให้ลูกค้าตรวจความถูกต้อง" },
  contact: { label: "เบอร์โทร / อีเมล", hint: "ของผู้ส่งและผู้รับ — ข้อมูลส่วนตัว" },
  packages: { label: "รายการกล่อง", hint: "จำนวน ขนาด น้ำหนัก" },
  billed_weight: { label: "น้ำหนักที่คิดเงิน", hint: "ช่วยอธิบายว่าทำไมกล่องใหญ่คิดแพงขึ้น" },
  quotes: { label: "ตัวเลือกราคาจาก Check Rate" },
  breakdown: { label: "ราคาแยกบรรทัด", hint: "ปิด = เห็นแค่ยอดรวมของบริการ" },
  addons: { label: "Add-on / ประกัน / วัสดุ" },
  total: { label: "ยอดรวมสุดท้าย" },
  tracking: { label: "เลข Tracking หลังจองเสร็จ" },
};

export const getCustomerDisplaySettings = () => apiClient.get<CustomerDisplaySettings>("/customer-display/settings").then(withDefaults);

/** Settings over the defaults — a section added later is never missing from older saved settings. */
export function withDefaults(s: Partial<CustomerDisplaySettings>): CustomerDisplaySettings {
  const d = DEFAULT_CUSTOMER_DISPLAY_SETTINGS;
  return {
    ...d,
    ...s,
    sections: { ...d.sections, ...s.sections },
    idle: { ...d.idle, ...s.idle },
    brand: { ...d.brand, ...s.brand },
    banner: { ...d.banner, ...s.banner },
    thank_you: { ...d.thank_you, ...s.thank_you },
  };
}

// An uploaded image is saved as a host-free path ("/api/customer-display/media/1") — served by
// whichever API this frontend talks to (dev and production share the database).
export const mediaUrl = (url: string | null | undefined) =>
  !url ? "" : url.startsWith("/api/") ? `${API_URL.replace(/\/api\/?$/, "")}${url}` : url;

// Upload a banner image (max 3 MB) → its public URL, to put in banner.image_url.
export const uploadCustomerDisplayImage = (file: File) => {
  const form = new FormData();
  form.append("image", file);
  return apiClient.upload<{ url: string }>("/customer-display/media", form);
};

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
  selected: boolean;
};

export type DisplayState = {
  stage: "idle" | "shipping" | "quotes" | "selected" | "booked";
  settings: CustomerDisplaySettings;
  sender?: { name: string; company: string; lines: string[]; phone: string };
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

// ---- Display on another computer (relayed through the API) ----

const REMOTE_KEY_STORAGE = "madd-customer-display-remote-key";

/** This counter's remote key, or null when the remote display is off. */
export function getRemoteDisplayKey(): string | null {
  try {
    return localStorage.getItem(REMOTE_KEY_STORAGE);
  } catch {
    return null;
  }
}

/** Turns the remote display on with a new random 32-char key (an old link stops working). */
export function createRemoteDisplayKey(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const key = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
  try {
    localStorage.setItem(REMOTE_KEY_STORAGE, key);
  } catch {
    // storage blocked — the key still works until this page reloads
  }
  return key;
}

export function clearRemoteDisplayKey() {
  try {
    localStorage.removeItem(REMOTE_KEY_STORAGE);
  } catch {
    // ignore
  }
}

export const remoteDisplayUrl = (key: string) =>
  typeof window === "undefined" ? "" : `${window.location.origin}${CUSTOMER_DISPLAY_PATH}?k=${key}`;

export const pushRemoteDisplayState = (key: string, state: DisplayState) =>
  apiClient.put<{ v: number }>(`/customer-display/live/${key}`, { state });

/** The display's poll (no login) — null when there's nothing newer than `since`. */
export async function fetchRemoteDisplayState(key: string, since: number): Promise<{ v: number; state: DisplayState } | null> {
  const res = await fetch(`${API_URL}/customer-display/live/${encodeURIComponent(key)}?v=${since}`, { headers: { Accept: "application/json" } });
  if (res.status === 204 || !res.ok) return null;
  return res.json();
}
