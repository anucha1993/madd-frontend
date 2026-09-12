"use client";

import { useMemo } from "react";
import type { AgentAccount } from "@/lib/agentAccounts";
import type { BranchCarrierAccountInput } from "@/lib/branchCarrierAccounts";

type Props = {
  agentAccounts: AgentAccount[];
  value: BranchCarrierAccountInput[];
  onChange: (value: BranchCarrierAccountInput[]) => void;
};

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

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-slate-500">
        เลือกบัญชี Agent (UPS/DHL) ที่สาขานี้สามารถใช้งานได้ — หากไม่เลือกบัญชีใดเลยของ Agent หนึ่ง สาขานี้จะใช้ได้ทุกบัญชีของ Agent
        นั้น (ค่าเริ่มต้น เช่น สำนักงานใหญ่)
      </p>

      <div className="flex max-h-[320px] flex-col gap-3 overflow-y-auto pr-1">
        {Object.entries(grouped).map(([agentName, accounts]) => (
          <div key={agentName} className="rounded-lg border border-slate-200 p-3">
            <div className="mb-2 text-sm font-semibold text-slate-700">{agentName}</div>
            <div className="flex flex-col gap-2">
              {accounts.map((account) => (
                <label
                  key={account.id}
                  className="flex items-center gap-2 rounded-md bg-slate-50 px-2 py-1.5 text-sm text-slate-600"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(account.id)}
                    onChange={() => toggleSelected(account.id)}
                    className="h-4 w-4 rounded border-slate-300 accent-brand-amber"
                  />
                  {account.username_acc}
                </label>
              ))}
            </div>
          </div>
        ))}
        {agentAccounts.length === 0 && <p className="text-sm text-slate-400">ยังไม่มีบัญชี Agent ในระบบ</p>}
      </div>
    </div>
  );
}

