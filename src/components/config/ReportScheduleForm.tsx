"use client";

import { useState, type FormEvent } from "react";
import type { Branch } from "@/lib/branches";
import { branchLabel } from "@/lib/branches";
import type { AgentAccount } from "@/lib/agentAccounts";
import type { ReportSchedule, ReportScheduleInput } from "@/lib/reportSchedules";

type Props = {
  initial?: ReportSchedule | null;
  branches: Branch[];
  agentAccounts: AgentAccount[];
  onSubmit: (data: ReportScheduleInput) => Promise<void>;
  onCancel: () => void;
};

const FREQUENCY_OPTIONS: { value: ReportScheduleInput["frequency"]; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

const RANGE_OPTIONS: { value: ReportScheduleInput["report_range"]; label: string }[] = [
  { value: "daily", label: "Today" },
  { value: "weekly", label: "This Week" },
  { value: "monthly", label: "This Month" },
  { value: "yearly", label: "This Year" },
];

const DAY_OF_WEEK_OPTIONS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

export default function ReportScheduleForm({ initial, branches, agentAccounts, onSubmit, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [frequency, setFrequency] = useState<ReportScheduleInput["frequency"]>(initial?.frequency ?? "daily");
  const [sendTime, setSendTime] = useState(initial?.send_time ?? "08:00");
  const [dayOfWeek, setDayOfWeek] = useState<number>(initial?.day_of_week ?? 1);
  const [dayOfMonth, setDayOfMonth] = useState<number>(initial?.day_of_month ?? 1);
  const [reportRange, setReportRange] = useState<ReportScheduleInput["report_range"]>(initial?.report_range ?? "daily");
  const [branchId, setBranchId] = useState<string>(initial?.branch_id ? String(initial.branch_id) : "");
  const [carrier, setCarrier] = useState<string>(initial?.carrier ?? "");
  const [agentAccountId, setAgentAccountId] = useState<string>(initial?.agent_account_id ? String(initial.agent_account_id) : "");
  const [recipientsText, setRecipientsText] = useState((initial?.recipients ?? []).join(", "));
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Please enter a schedule name");
      return;
    }
    const recipients = recipientsText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (recipients.length === 0) {
      setError("Please enter at least one recipient email (comma-separated)");
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        frequency,
        send_time: sendTime,
        day_of_week: frequency === "weekly" ? dayOfWeek : null,
        day_of_month: frequency === "monthly" ? dayOfMonth : null,
        report_range: reportRange,
        branch_id: branchId ? Number(branchId) : null,
        carrier: (carrier as "UPS" | "DHL") || null,
        agent_account_id: agentAccountId ? Number(agentAccountId) : null,
        recipients,
        is_active: isActive,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-brand-navy focus:bg-white focus:ring-2 focus:ring-brand-navy/15";
  const labelClass = "text-sm font-medium text-slate-600";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className={labelClass}>Schedule Name</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Daily Manifest to Accounting"
          className={inputClass}
        />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Frequency</span>
          <select value={frequency} onChange={(e) => setFrequency(e.target.value as ReportScheduleInput["frequency"])} className={inputClass}>
            {FREQUENCY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Send Time</span>
          <input type="time" value={sendTime} onChange={(e) => setSendTime(e.target.value)} className={inputClass} />
        </label>
      </div>

      {frequency === "weekly" && (
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Day of Week</span>
          <select value={dayOfWeek} onChange={(e) => setDayOfWeek(Number(e.target.value))} className={inputClass}>
            {DAY_OF_WEEK_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      )}

      {frequency === "monthly" && (
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Day of Month (1-31)</span>
          <input
            type="number"
            min={1}
            max={31}
            value={dayOfMonth}
            onChange={(e) => setDayOfMonth(Number(e.target.value))}
            className={`${inputClass} w-32`}
          />
          <span className="text-xs text-slate-400">If a month doesn&apos;t have this day (e.g. 31 in February), no email is sent that month</span>
        </label>
      )}

      <label className="flex flex-col gap-1.5">
        <span className={labelClass}>Report Data Range (Manifest)</span>
        <select value={reportRange} onChange={(e) => setReportRange(e.target.value as ReportScheduleInput["report_range"])} className={inputClass}>
          {RANGE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Branch (leave unselected = all branches)</span>
          <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className={inputClass}>
            <option value="">All Branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {branchLabel(b)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Carrier (leave unselected = all)</span>
          <select value={carrier} onChange={(e) => setCarrier(e.target.value)} className={inputClass}>
            <option value="">All</option>
            <option value="UPS">UPS</option>
            <option value="DHL">DHL</option>
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className={labelClass}>Agent Account (leave unselected = all accounts)</span>
        <select value={agentAccountId} onChange={(e) => setAgentAccountId(e.target.value)} className={inputClass}>
          <option value="">All Accounts</option>
          {agentAccounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.username_acc} ({a.agent?.agent_code})
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={labelClass}>Recipient Emails (comma-separated)</span>
        <textarea
          value={recipientsText}
          onChange={(e) => setRecipientsText(e.target.value)}
          rows={2}
          placeholder="a@example.com, b@example.com"
          className={`${inputClass} resize-y`}
        />
      </label>

      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 accent-brand-amber"
        />
        Enable this schedule
      </label>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-brand-navy-dark px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-navy-dark/90 disabled:opacity-60"
        >
          {submitting ? "Saving..." : "Save"}
        </button>
      </div>
    </form>
  );
}
