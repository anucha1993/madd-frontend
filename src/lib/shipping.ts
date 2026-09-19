import { apiClient } from "./apiClient";

export type ShipmentPackageInput = {
  weight: number;
  length?: number;
  width?: number;
  height?: number;
  quantity?: number;
  description?: string;
  is_document?: boolean;
  // Declared value must be set PER PACKAGE (UPS insurance is a package-level field) —
  // not a single shipment-wide total.
  declared_value?: number;
};

export type CheckRateInput = {
  origin_contact_name?: string;
  origin_company?: string;
  origin_postcode: string;
  origin_city: string;
  origin_address?: string;
  origin_address2?: string;
  origin_address3?: string;
  origin_phone?: string;
  destination_contact_name?: string;
  destination_company?: string;
  destination_country: string;
  destination_city: string;
  destination_postcode?: string;
  destination_address?: string;
  destination_address2?: string;
  destination_address3?: string;
  destination_phone?: string;
  destination_email?: string;
  packages: ShipmentPackageInput[];
  // Sum of packages[].declared_value — UPS/DHL quote back their own actual insurance charge
  // in chargeBreakdown instead of it being estimated client-side.
  declared_value_currency?: string;
  agent_account_ids?: number[];
  // Which carrier(s) to check — omit/empty to check both UPS and DHL (default).
  carriers?: ("UPS" | "DHL")[];
};

export type RateChargeLine = {
  code: string | null;
  description: string;
  amount: number;
  currency: string;
  // Injected by ChargeMarkupService for a MarkupRule whose charge code the carrier never
  // returned (e.g. a self-defined "VAT" line) — not part of the carrier's own quote.
  isCustomCharge?: boolean;
  // Present whenever a MarkupRule affected this line — lets the UI show exactly what amount
  // the markup was computed from, e.g. "7% × 1,200.00" instead of just the final total.
  markupUnit?: "PERCENTAGE" | "BAHT" | "FORMULA" | null;
  markupValue?: number | null;
  // The base the markupUnit/markupValue was applied to — for an existing carrier line this is
  // that line's own (possibly fixed-override) amount; for a custom line with PERCENTAGE unit
  // this is the quote's whole sell subtotal; null for a custom BAHT (flat) line or FORMULA.
  markupBase?: number | null;
  // Only set when markupUnit === "FORMULA" — the raw "({BASE} + {FF}) * 7%" expression, shown
  // as-is since there's no single "base" to summarize like PERCENTAGE/BAHT have.
  markupFormula?: string | null;
};

export type RateQuote = {
  carrier: "UPS" | "DHL";
  accountId: number;
  username: string;
  serviceCode: string | null;
  serviceLabel: string;
  currency?: string;
  billedWeight?: string | number | null;
  billedWeightUnit?: string | null;
  // DHL only — dimensional/volumetric weight it calculated from the package dims, shown
  // alongside billedWeight since DHL bills whichever of the two is greater.
  volumetricWeight?: number | null;
  zone?: string | null;
  published?: number | null;
  negotiated?: number | null;
  isCustomerAgreement?: boolean;
  transitDays?: number | null;
  estimatedDelivery?: string | null;
  chargeBreakdown?: RateChargeLine[];
  // Sum of MarkupRule adjustments already baked into published/negotiated/chargeBreakdown above
  // (see ChargeMarkupService) — only present when a markup rule actually applied to this quote.
  markupTotal?: number | null;
  error?: string | null;
  // Raw carrier API response for this specific quote — only for staff-facing debugging (see
  // "Raw" button on each Rate Quotes candidate card), never shown to customers.
  raw?: unknown;
};

export type CheckRateResult = {
  accountCount: number;
  results: RateQuote[];
};

export const checkRate = (data: CheckRateInput) => apiClient.post<CheckRateResult>("/shipping/check-rate", data);
