"use client";

import { useEffect, useState } from "react";
import { Plug } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import PageLoading from "@/components/ui/PageLoading";
import { getRestCountriesSettings, updateRestCountriesSettings, type RestCountriesSettings } from "@/lib/countries";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm text-slate-800 outline-none transition focus:border-brand-navy focus:bg-white focus:ring-2 focus:ring-brand-navy/15";

export default function IntegrationsPage() {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<RestCountriesSettings | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [savingKey, setSavingKey] = useState(false);
  const [keyMessage, setKeyMessage] = useState("");
  const [keyError, setKeyError] = useState("");

  useEffect(() => {
    getRestCountriesSettings()
      .then(setSettings)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSaveApiKey() {
    if (!apiKeyInput.trim()) return;
    setSavingKey(true);
    setKeyError("");
    setKeyMessage("");
    try {
      const res = await updateRestCountriesSettings(apiKeyInput.trim());
      setSettings({ is_configured: res.is_configured, masked_api_key: res.masked_api_key });
      setKeyMessage(res.message);
      setApiKeyInput("");
    } catch (err) {
      setKeyError(err instanceof Error ? err.message : "Failed to save API key");
    } finally {
      setSavingKey(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="API Integrations"
        description="จัดการ API Key ของบริการภายนอกที่ระบบเชื่อมต่อ (ไม่เกี่ยวกับข้อมูลของแต่ละหน้า)"
      />

      {loading ? (
        <PageLoading label="กำลังโหลดข้อมูลการเชื่อมต่อ..." />
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Plug className="h-4 w-4 text-slate-400" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">restcountries.com</h2>
          </div>
          <p className="mb-3 text-xs text-slate-400">
            ใช้สำหรับซิงค์รายชื่อประเทศในหน้า{" "}
            <a href="/config/countries" className="font-medium text-brand-navy hover:underline">
              Countries
            </a>
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-600">Status</span>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  settings?.is_configured ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"
                }`}
              >
                {settings?.is_configured ? `Connected · ${settings.masked_api_key}` : "Not configured"}
              </span>
            </div>
            <label className="flex flex-1 min-w-[240px] flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-600">API Key</span>
              <input
                type="text"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="rc_live_..."
                className={inputClass}
              />
            </label>
            <button
              type="button"
              onClick={handleSaveApiKey}
              disabled={savingKey || !apiKeyInput.trim()}
              className="flex items-center gap-2 rounded-lg bg-brand-amber px-4 py-2 text-sm font-semibold text-brand-navy-dark hover:bg-brand-amber/90 disabled:opacity-60"
            >
              {savingKey ? "Saving..." : "Save Key"}
            </button>
          </div>
          {keyMessage && <p className="mt-2 text-sm text-emerald-600">{keyMessage}</p>}
          {keyError && <p className="mt-2 text-sm text-red-600">{keyError}</p>}
        </div>
      )}
    </div>
  );
}
