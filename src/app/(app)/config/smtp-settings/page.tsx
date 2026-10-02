"use client";

import { useEffect, useState } from "react";
import { Loader2, Mail, Save, Send } from "lucide-react";
import { useAccess } from "@/components/auth/AccessProvider";
import PageHeader from "@/components/layout/PageHeader";
import PageLoading from "@/components/ui/PageLoading";
import { getSmtpSettings, updateSmtpSettings, testSmtpSettings, type SmtpSettings } from "@/lib/smtpSettings";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-brand-navy focus:bg-white focus:ring-2 focus:ring-brand-navy/15";
const labelClass = "text-sm font-medium text-slate-600";

export default function SmtpSettingsPage() {
  const { can } = useAccess();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<SmtpSettings | null>(null);

  const [gmailAddress, setGmailAddress] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState(false);
  const [testMessage, setTestMessage] = useState("");

  async function load() {
    const res = await getSmtpSettings();
    setSettings(res);
    setGmailAddress(res.gmail_address ?? "");
    setEnabled(res.enabled);
  }

  useEffect(() => {
    load()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await updateSmtpSettings({
        gmail_address: gmailAddress.trim(),
        gmail_app_password: appPassword.trim() || undefined,
        enabled,
      });
      setSettings(res);
      setAppPassword("");
      setMessage("Settings saved successfully");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    if (!testTo.trim()) return;
    setTesting(true);
    setTestMessage("");
    try {
      const res = await testSmtpSettings(testTo.trim());
      setTestMessage(res.message);
    } catch (err) {
      setTestMessage(err instanceof Error ? err.message : "Failed to send test email");
    } finally {
      setTesting(false);
    }
  }

  if (loading) return <PageLoading label="Loading SMTP Settings..." />;

  return (
    <div>
      <PageHeader
        title="SMTP Settings (Gmail)"
        description="Configure the Gmail account used to send automatic report emails — Gmail (App Password) only"
      />

      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Mail className="h-4 w-4 text-brand-navy-dark" />
          <h2 className="text-sm font-semibold text-slate-700">Gmail Account</h2>
        </div>

        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Gmail Address</span>
            <input
              type="email"
              value={gmailAddress}
              onChange={(e) => setGmailAddress(e.target.value)}
              placeholder="example@gmail.com"
              className={`${inputClass} max-w-md`}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>App Password (16 characters)</span>
            <input
              type="password"
              value={appPassword}
              onChange={(e) => setAppPassword(e.target.value)}
              placeholder={settings?.has_app_password ? "•••• •••• •••• •••• (already set — enter a new one to change it)" : "abcd efgh ijkl mnop"}
              className={`${inputClass} max-w-md`}
            />
            <span className="text-xs text-slate-400">
              Generate one at Google Account → Security → 2-Step Verification → App Passwords (2-Step Verification must be enabled first)
            </span>
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 accent-brand-amber"
            />
            Enable automatic email sending
          </label>

          <div>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-brand-navy-dark px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navy-dark/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </button>
          </div>

          {message && <p className="text-sm text-emerald-600">{message}</p>}
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        </div>
      </div>

      {can("config.smtp_test") && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">Send Test Email</h2>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Send To</span>
              <input
                type="email"
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
                placeholder="you@example.com"
                className={`${inputClass} w-64`}
              />
            </label>
            <button
              type="button"
              onClick={handleTest}
              disabled={testing || !testTo.trim()}
              className="flex items-center gap-2 rounded-lg border border-brand-navy-dark px-4 py-2 text-sm font-semibold text-brand-navy-dark hover:bg-brand-navy-dark/5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send Test
            </button>
          </div>
          {testMessage && <p className="mt-3 text-sm text-slate-500">{testMessage}</p>}
        </div>
      )}
    </div>
  );
}
