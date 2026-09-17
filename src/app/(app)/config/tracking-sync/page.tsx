"use client";

import { Fragment, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Loader2, PlayCircle, RefreshCw, Save } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import PageLoading from "@/components/ui/PageLoading";
import {
  getTrackingSyncSettings,
  updateTrackingSyncSettings,
  listTrackingSyncLogs,
  runTrackingSyncNow,
  type TrackingSyncSettings,
  type TrackingSyncLog,
} from "@/lib/trackingSync";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm text-slate-800 outline-none transition focus:border-brand-navy focus:bg-white focus:ring-2 focus:ring-brand-navy/15";

const STATUS_LABEL: Record<string, string> = {
  not_picked_up: "Not Picked Up",
  in_transit: "In Transit",
  delivered: "Delivered",
};

const statusLabel = (status: string | null) => (status ? STATUS_LABEL[status] ?? status : "(none)");

export default function TrackingSyncPage() {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<TrackingSyncSettings | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [intervalMinutes, setIntervalMinutes] = useState(15);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [running, setRunning] = useState(false);

  const [logs, setLogs] = useState<TrackingSyncLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);

  async function loadSettings() {
    const res = await getTrackingSyncSettings();
    setSettings(res);
    setEnabled(res.enabled);
    setIntervalMinutes(res.interval_minutes);
  }

  async function loadLogs() {
    setLogsLoading(true);
    try {
      const res = await listTrackingSyncLogs();
      setLogs(res.data);
    } finally {
      setLogsLoading(false);
    }
  }

  useEffect(() => {
    Promise.all([loadSettings(), loadLogs()])
      .catch(() => {})
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaveMessage("");
    try {
      const res = await updateTrackingSyncSettings({ enabled, interval_minutes: intervalMinutes });
      setSettings(res);
      setSaveMessage("Saved successfully");
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleRunNow() {
    setRunning(true);
    try {
      await runTrackingSyncNow();
      await Promise.all([loadSettings(), loadLogs()]);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setRunning(false);
    }
  }

  if (loading) return <PageLoading label="Loading Tracking Sync Settings..." />;

  return (
    <div>
      <PageHeader
        title="Tracking Sync"
        description="Configure and review the automatic UPS/DHL tracking status sync (Not Picked Up / In Transit / Delivered)"
      />

      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">Settings</h2>
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-navy-dark"
            />
            <span className="text-sm font-medium text-slate-600">Enable Auto Sync</span>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-600">Interval (minutes)</span>
            <input
              type="number"
              min={1}
              max={1440}
              value={intervalMinutes}
              onChange={(e) => setIntervalMinutes(Number(e.target.value))}
              className={`${inputClass} w-32`}
            />
          </label>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-brand-navy-dark px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navy-dark/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </button>
          <button
            type="button"
            onClick={handleRunNow}
            disabled={running}
            className="flex items-center gap-2 rounded-lg border border-brand-navy-dark px-4 py-2 text-sm font-semibold text-brand-navy-dark hover:bg-brand-navy-dark/5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
            Run Now
          </button>
        </div>
        {saveMessage && <p className="mt-3 text-sm text-slate-500">{saveMessage}</p>}
        {settings?.last_run_at && (
          <p className="mt-3 text-xs text-slate-400">Last run: {new Date(settings.last_run_at).toLocaleString()}</p>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-700">Sync History</h2>
          <button
            type="button"
            onClick={loadLogs}
            className="flex items-center gap-1.5 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
            aria-label="Refresh Logs"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
        {logsLoading ? (
          <PageLoading label="Loading Logs..." />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="w-8 px-5 py-2.5"></th>
                <th className="px-5 py-2.5 font-medium">Started</th>
                <th className="px-5 py-2.5 font-medium">Finished</th>
                <th className="px-5 py-2.5 font-medium">Checked</th>
                <th className="px-5 py-2.5 font-medium">Updated</th>
                <th className="px-5 py-2.5 font-medium">Errors</th>
                <th className="px-5 py-2.5 font-medium">Type</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                    No sync history yet
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const expanded = expandedLogId === log.id;
                  const hasDetail = (log.updates?.length ?? 0) > 0 || (log.errors?.length ?? 0) > 0;
                  return (
                    <Fragment key={log.id}>
                      <tr
                        className={`border-b border-slate-100 last:border-0 hover:bg-slate-50 ${hasDetail ? "cursor-pointer" : ""}`}
                        onClick={() => hasDetail && setExpandedLogId(expanded ? null : log.id)}
                      >
                        <td className="px-5 py-3 text-slate-400">
                          {hasDetail && (expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />)}
                        </td>
                        <td className="px-5 py-3 text-slate-700">{new Date(log.started_at).toLocaleString()}</td>
                        <td className="px-5 py-3 text-slate-500">{log.finished_at ? new Date(log.finished_at).toLocaleString() : "-"}</td>
                        <td className="px-5 py-3 text-slate-500">{log.checked_count}</td>
                        <td className="px-5 py-3 text-slate-500">
                          {log.updated_count > 0 ? (
                            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-600">{log.updated_count}</span>
                          ) : (
                            <span className="text-slate-300">0</span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          {log.error_count > 0 ? (
                            <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-600">{log.error_count}</span>
                          ) : (
                            <span className="text-slate-300">0</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-slate-500">
                          {log.forced ? (
                            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-600">Manual (Run Now)</span>
                          ) : (
                            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">Auto</span>
                          )}
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="border-b border-slate-100 bg-slate-50/60 last:border-0">
                          <td colSpan={7} className="px-5 py-4">
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                              {log.updates && log.updates.length > 0 && (
                                <div>
                                  <p className="mb-1.5 text-xs font-semibold text-slate-500">Updated Tracking ({log.updates.length})</p>
                                  <ul className="flex flex-col gap-1">
                                    {log.updates.map((u, i) => (
                                      <li key={i} className="rounded-lg bg-white px-3 py-1.5 text-xs text-slate-700 shadow-sm">
                                        <span className="font-mono font-medium">{u.tracking_number}</span>{" "}
                                        <span className="text-slate-400">
                                          ({u.carrier}, Shipment #{u.shipment_id})
                                        </span>
                                        <br />
                                        {statusLabel(u.from)} <span className="text-slate-400">→</span>{" "}
                                        <span className="font-medium text-emerald-600">{statusLabel(u.to)}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {log.errors && log.errors.length > 0 && (
                                <div>
                                  <p className="mb-1.5 text-xs font-semibold text-slate-500">Errors ({log.errors.length})</p>
                                  <ul className="flex flex-col gap-1">
                                    {log.errors.map((e, i) => (
                                      <li key={i} className="rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-600">
                                        <span className="font-mono font-medium">{e.tracking_number}</span>{" "}
                                        <span className="text-red-400">(Shipment #{e.shipment_id})</span>
                                        <br />
                                        {e.message}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
