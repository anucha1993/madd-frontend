// Services a carrier account can quote — shared by the branch service restrictions and the
// per-service Check Rate weight ranges.

// Mirrors UpsRateService::SERVICE_CODES (madd-backend) — UPS only ever quotes these 4 services.
export const UPS_SERVICE_OPTIONS: { code: string; label: string }[] = [
  { code: "65", label: "Worldwide Saver" },
  { code: "07", label: "Worldwide Express" },
  { code: "08", label: "Worldwide Expedited" },
  { code: "11", label: "UPS Standard" },
];

// DHL has no fixed product list per se, but these are the products actually seen returned by
// our DHL accounts (via DhlRateService::listAvailableProducts).
export const DHL_SERVICE_OPTIONS: { code: string; label: string }[] = [
  { code: "P", label: "EXPRESS WORLDWIDE" },
  { code: "D", label: "EXPRESS WORLDWIDE (DOC)" },
  { code: "M", label: "EXPRESS 10:30" },
  { code: "Y", label: "EXPRESS 12:00" },
  { code: "8", label: "EXPRESS EASY" },
  { code: "Q", label: "MEDICAL EXPRESS" },
];

export const serviceOptionsFor = (agentCode: string | null | undefined) =>
  agentCode === "UPS" ? UPS_SERVICE_OPTIONS : agentCode === "DHL" ? DHL_SERVICE_OPTIONS : [];
