"use client";

import { useMemo } from "react";
import type { AgentAccount } from "@/lib/agentAccounts";
import type { BranchCarrierAccountInput } from "@/lib/branchCarrierAccounts";

type Props = {
  agentAccounts: AgentAccount[];
  value: BranchCarrierAccountInput[];
  onChange: (value: BranchCarrierAccountInput[]) => void;
};

// Mirrors UpsRateService::SERVICE_CODES (madd-backend) — UPS only ever quotes these 4 services.
const UPS_SERVICE_OPTIONS: { code: string; label: string }[] = [
  { code: "65", label: "Worldwide Saver" },
  { code: "07", label: "Worldwide Express" },
  { code: "08", label: "Worldwide Expedited" },
  { code: "11", label: "UPS Standard" },
];

// DHL has no fixed product list per se, but these are the products actually seen returned by
// our DHL accounts (via DhlRateService::listAvailableProducts) — kept as a static list here
// (same simple checkbox UX as UPS) instead of fetching live every time.
const DHL_SERVICE_OPTIONS: { code: string; label: string }[] = [
  { code: "P", label: "EXPRESS WORLDWIDE" },
  { code: "M", label: "EXPRESS 10:30" },
  { code: "Y", label: "EXPRESS 12:00" },
  { code: "8", label: "EXPRESS EASY" },
  { code: "Q", label: "MEDICAL EXPRESS" },
];

/** Controlled checkbox fields for assigning carrier accounts to a branch, grouped by agent. */
export default function BranchCarrierAccountsForm({ agentAccounts, value, onChange }: Props) {
  const grouped = useMemo(() => {
    const groups: Record<string, AgentAccount[]> = {};
    for (const account of agentAccounts) {
      const key = account.agent?.agent_name ?? account.agent?.agent_code ?? "อื่นๆ";
      (groups[key] ??= []).push(account);
    }
    return groups;
  }, [agentAccounts]);

  const selectedIds = useMemo(() => new Set(value.map((row) => row.agent_account_id)), [value]);

  function toggleSelected(id: number) {
    if (selectedIds.has(id)) {
      onChange(value.filter((row) => row.agent_account_id !== id));
    } else {
      onChange([...value, { agent_account_id: id }]);
    }
  }

  function toggleService(id: number, code: string) {
    const row = value.find((r) => r.agent_account_id === id);
    const current = row?.allowed_service_codes ?? [];
    const next = current.includes(code) ? current.filter((c) => c !== code) : [...current, code];
    onChange(value.map((r) => (r.agent_account_id === id ? { ...r, allowed_service_codes: next.length > 0 ? next : null } : r)));
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-slate-500">
        เลือกบัญชี Agent (UPS/DHL) ที่สาขานี้สามารถใช้งานได้ — หากไม่เลือกบัญชีใดเลยของ Agent หนึ่ง สาขานี้จะใช้ได้ทุกบัญชีของ Agent
        นั้น (ค่าเริ่มต้น เช่น สำนักงานใหญ่) — เลือกบัญชีแล้วยังจำกัด Service ที่ใช้ได้ต่อได้อีกชั้นหนึ่ง (ว่าง = ใช้ได้ทุก Service)
      </p>

      <div className="flex max-h-[420px] flex-col gap-3 overflow-y-auto pr-1">
        {Object.entries(grouped).map(([agentName, accounts]) => (
          <div key={agentName} className="rounded-lg border border-slate-200 p-3">
            <div className="mb-2 text-sm font-semibold text-slate-700">{agentName}</div>
            <div className="flex flex-col gap-2">
              {accounts.map((account) => {
                const row = value.find((r) => r.agent_account_id === account.id);
                const isSelected = selectedIds.has(account.id);
                const serviceOptions = account.agent?.agent_code === "UPS" ? UPS_SERVICE_OPTIONS : DHL_SERVICE_OPTIONS;
                return (
                  <div key={account.id} className="rounded-md bg-slate-50 px-2 py-1.5">
                    <label className="flex items-center gap-2 text-sm text-slate-600">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelected(account.id)}
                        className="h-4 w-4 rounded border-slate-300 accent-brand-amber"
                      />
                      {account.username_acc}
                    </label>
                    {isSelected && (
                      <div className="mt-1.5 flex flex-wrap gap-3 pl-6">
                        {serviceOptions.map((opt) => (
                          <label key={opt.code} className="flex items-center gap-1 text-xs text-slate-500">
                            <input
                              type="checkbox"
                              checked={(row?.allowed_service_codes ?? []).includes(opt.code)}
                              onChange={() => toggleService(account.id, opt.code)}
                              className="h-3.5 w-3.5 rounded border-slate-300 accent-brand-amber"
                            />
                            {opt.label}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {agentAccounts.length === 0 && <p className="text-sm text-slate-400">ยังไม่มีบัญชี Agent ในระบบ</p>}
      </div>
    </div>
  );
}

