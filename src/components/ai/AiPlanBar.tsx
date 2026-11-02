"use client";

import { useCallback, useEffect, useState } from "react";
import { CreditCard, Sparkles } from "lucide-react";
import { getAiPlan, type AiPlan } from "@/lib/ai";

const isTrial = (plan?: string | null) => /trial\s*$/i.test(plan ?? "");

/**
 * DataCorp AI plan: name, credits used, renewal and a pay / upgrade button.
 * `compact` (chat widget) shows only when there is something to act on: trial, renewal within 3 days or blocked.
 * Renders nothing when the AI does not go through DataCorp.
 */
export default function AiPlanBar({ compact = false, refreshKey = 0 }: { compact?: boolean; refreshKey?: number }) {
  const [plan, setPlan] = useState<AiPlan | null>(null);

  const load = useCallback((fresh: boolean) => {
    getAiPlan(fresh).then(setPlan).catch(() => setPlan(null));
  }, []);
  useEffect(() => { load(refreshKey > 0); }, [load, refreshKey]);

  if (!plan?.enabled || !plan.plan) return null;
  const trial = isTrial(plan.plan);
  const actionable = plan.blocked || trial || plan.renew_due;
  if (compact && !actionable) return null;

  const pct = plan.included ? Math.min(100, Math.round(((plan.used ?? 0) / plan.included) * 100)) : 0;
  // trial / renewal: direct Polar checkout link; if DataCorp gives none, the DataCorp portal plans page (login) instead
  const url = plan.blocked ? plan.pay_url ?? plan.plans_url : trial || plan.renew_due ? plan.upgrade_url ?? plan.plans_url : null;
  const tone = plan.blocked ? "border-red-200 bg-red-50" : plan.renew_due || pct >= 90 ? "border-amber-200 bg-amber-50" : "border-sky-200 bg-sky-50";
  const bar = plan.blocked || pct >= 100 ? "bg-red-500" : pct >= 90 ? "bg-amber-500" : "bg-sky-500";
  const when = plan.blocked
    ? plan.message || "ใช้งานไม่ได้ — ต้องชำระเงิน"
    : plan.renew_due
      ? `หมดอายุใน ${plan.days_left ?? 0} วัน${plan.auto_renew ? " (ตัดบัตรต่ออายุอัตโนมัติ)" : ""}`
      : plan.renews_at
        ? `${trial ? "ทดลองใช้ถึง" : "ต่ออายุรอบถัดไป"} ${String(plan.renews_at).slice(0, 10)}`
        : "";
  const label = plan.blocked
    ? "ชำระเงิน / ใช้งานต่อ"
    : plan.renew_due && !trial
      ? `ต่ออายุ ${plan.upgrade_plan ?? ""}`
      : plan.upgrade_plan
        ? `สมัคร ${plan.upgrade_plan}${plan.upgrade_price ? ` ฿${Number(plan.upgrade_price).toLocaleString()}/เดือน` : ""}`
        : "สมัครใช้งานจริง";

  return (
    <div className={`flex flex-wrap items-center gap-3 rounded-xl border px-3 py-2 ${tone} ${compact ? "mb-3" : ""}`}>
      <Sparkles className="h-4 w-4 shrink-0 text-slate-500" />
      <div className="min-w-[180px] flex-1">
        <div className="text-sm">
          <span className="font-semibold text-slate-700">แพ็กเกจ AI: {plan.plan}</span>
          {when && <span className="text-slate-500"> · {when}</span>}
        </div>
        {plan.included ? (
          <>
            <div className="mt-1 h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-white/80">
              <div className={`h-full ${bar}`} style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-0.5 text-xs text-slate-500">
              ใช้ไป {(plan.used ?? 0).toLocaleString()} / {plan.included.toLocaleString()} credits
            </div>
          </>
        ) : null}
      </div>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setTimeout(() => load(true), 60000)}
          className="flex items-center gap-1.5 rounded-lg bg-brand-navy-dark px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
        >
          <CreditCard className="h-3.5 w-3.5" /> {label}
        </a>
      ) : actionable && !plan.can_pay ? (
        <span className="text-xs text-slate-500">ติดต่อผู้ดูแลระบบเพื่อสมัคร/ชำระค่าบริการ AI</span>
      ) : null}
    </div>
  );
}
