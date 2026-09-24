"use client";

import { useEffect, useState } from "react";
import { CalendarClock, Loader2, Pencil, Plus, Send, Trash2 } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import Modal from "@/components/ui/Modal";
import PageLoading from "@/components/ui/PageLoading";
import ReportScheduleForm from "@/components/config/ReportScheduleForm";
import {
  createReportSchedule,
  deleteReportSchedule,
  listReportSchedules,
  sendReportScheduleNow,
  updateReportSchedule,
  type ReportSchedule,
  type ReportScheduleInput,
} from "@/lib/reportSchedules";
import { listBranches, type Branch } from "@/lib/branches";
import { listAgentAccounts, type AgentAccount } from "@/lib/agentAccounts";

const FREQUENCY_LABEL: Record<string, string> = { daily: "Daily", weekly: "Weekly", monthly: "Monthly" };
const RANGE_LABEL: Record<string, string> = { daily: "Today", weekly: "This Week", monthly: "This Month", yearly: "This Year" };
const DAY_OF_WEEK_LABEL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function scheduleSummary(s: ReportSchedule): string {
  if (s.frequency === "daily") return `Every day at ${s.send_time}`;
  if (s.frequency === "weekly") return `Every ${DAY_OF_WEEK_LABEL[s.day_of_week ?? 0]} at ${s.send_time}`;
  return `Day ${s.day_of_month} of every month at ${s.send_time}`;
}

export default function ReportSchedulesPage() {
  const [schedules, setSchedules] = useState<ReportSchedule[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [agentAccounts, setAgentAccounts] = useState<AgentAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalSchedule, setModalSchedule] = useState<ReportSchedule | "new" | null>(null);
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [sendMessage, setSendMessage] = useState("");

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      const [scheduleList, branchList, accounts] = await Promise.all([
        listReportSchedules(),
        listBranches(),
        listAgentAccounts(),
      ]);
      setSchedules(scheduleList);
      setBranches(branchList);
      setAgentAccounts(accounts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function handleSubmit(data: ReportScheduleInput) {
    if (modalSchedule && modalSchedule !== "new") {
      await updateReportSchedule(modalSchedule.id, data);
    } else {
      await createReportSchedule(data);
    }
    setModalSchedule(null);
    await loadAll();
  }

  async function handleDelete(schedule: ReportSchedule) {
    if (!confirm(`Are you sure you want to delete the schedule "${schedule.name}"?`)) return;
    await deleteReportSchedule(schedule.id);
    await loadAll();
  }

  async function handleToggleActive(schedule: ReportSchedule) {
    setSchedules((prev) => prev.map((s) => (s.id === schedule.id ? { ...s, is_active: !s.is_active } : s)));
    try {
      await updateReportSchedule(schedule.id, { is_active: !schedule.is_active });
    } catch {
      setSchedules((prev) => prev.map((s) => (s.id === schedule.id ? { ...s, is_active: schedule.is_active } : s)));
    }
  }

  async function handleSendNow(schedule: ReportSchedule) {
    setSendingId(schedule.id);
    setSendMessage("");
    try {
      await sendReportScheduleNow(schedule.id);
      setSendMessage(`Report "${schedule.name}" sent successfully`);
      await loadAll();
    } catch (err) {
      setSendMessage(err instanceof Error ? err.message : "Failed to send report");
    } finally {
      setSendingId(null);
    }
  }

  return (
    <div className="relative min-h-[360px]">
      <div className="mb-6 flex items-start justify-between">
        <PageHeader
          title="Report Schedules"
          description="Schedule automatic Manifest Report emails (used together with SMTP Settings)"
        />
        <button
          type="button"
          onClick={() => setModalSchedule("new")}
          className="flex items-center gap-2 rounded-lg bg-brand-navy-dark px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navy-dark/90"
        >
          <Plus className="h-4 w-4" />
          Add Schedule
        </button>
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      {sendMessage && <p className="mb-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">{sendMessage}</p>}

      {loading ? (
        <PageLoading label="Loading Report Schedules..." />
      ) : schedules.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white py-20 text-center">
          <CalendarClock className="h-10 w-10 text-brand-amber" />
          <p className="font-medium text-slate-600">No report schedules yet</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gradient-to-r from-brand-navy-dark to-brand-navy text-xs uppercase text-white/90">
              <tr>
                <th className="px-5 py-2.5 font-medium">Name</th>
                <th className="px-5 py-2.5 font-medium">Schedule</th>
                <th className="px-5 py-2.5 font-medium">Data Range</th>
                <th className="px-5 py-2.5 font-medium">Recipients</th>
                <th className="px-5 py-2.5 font-medium">Last Sent</th>
                <th className="px-5 py-2.5 font-medium">Status</th>
                <th className="px-5 py-2.5 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((schedule) => (
                <tr key={schedule.id} className="border-b border-slate-200 last:border-0">
                  <td className="px-5 py-3 font-medium text-slate-700">{schedule.name}</td>
                  <td className="px-5 py-3 text-slate-500">{scheduleSummary(schedule)}</td>
                  <td className="px-5 py-3 text-slate-500">{RANGE_LABEL[schedule.report_range]}</td>
                  <td className="px-5 py-3 max-w-[220px] truncate text-slate-500" title={schedule.recipients.join(", ")}>
                    {schedule.recipients.length} recipient(s)
                  </td>
                  <td className="px-5 py-3 text-slate-500">
                    {schedule.last_sent_at ? (
                      <span className={schedule.last_sent_status === "failed" ? "text-red-600" : "text-emerald-600"}>
                        {new Date(schedule.last_sent_at).toLocaleString()} ({schedule.last_sent_status})
                      </span>
                    ) : (
                      "Never sent"
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(schedule)}
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        schedule.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {schedule.is_active ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => handleSendNow(schedule)}
                        disabled={sendingId === schedule.id}
                        title="Send now"
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-60"
                      >
                        {sendingId === schedule.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => setModalSchedule(schedule)}
                        title="Edit"
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(schedule)}
                        title="Delete"
                        className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalSchedule && (
        <Modal title={modalSchedule === "new" ? "Add Report Schedule" : "Edit Report Schedule"} onClose={() => setModalSchedule(null)}>
          <ReportScheduleForm
            initial={modalSchedule === "new" ? null : modalSchedule}
            branches={branches}
            agentAccounts={agentAccounts}
            onSubmit={handleSubmit}
            onCancel={() => setModalSchedule(null)}
          />
        </Modal>
      )}
    </div>
  );
}
