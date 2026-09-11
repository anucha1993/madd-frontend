"use client";

import { useEffect, useState } from "react";
import { Plug, Sparkles } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import PageLoading from "@/components/ui/PageLoading";
import { getAiSettings, toggleAi, updateAiSettings, type AiSettings } from "@/lib/ai";
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

  const [aiSettings, setAiSettings] = useState<AiSettings | null>(null);
  const [aiKeyInput, setAiKeyInput] = useState("");
  const [aiSavingKey, setAiSavingKey] = useState(false);
  const [aiKeyMessage, setAiKeyMessage] = useState("");
  const [aiKeyError, setAiKeyError] = useState("");
  const [aiToggling, setAiToggling] = useState(false);

  useEffect(() => {
    Promise.all([getRestCountriesSettings(), getAiSettings()])
      .then(([rc, ai]) => {
        setSettings(rc);
        setAiSettings(ai);
      })
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

  async function handleSaveAiApiKey() {
    if (!aiKeyInput.trim()) return;
    setAiSavingKey(true);
    setAiKeyError("");
    setAiKeyMessage("");
    try {
      const res = await updateAiSettings(aiKeyInput.trim());
      setAiSettings({ is_configured: res.is_configured, masked_api_key: res.masked_api_key, is_enabled: res.is_enabled });
      setAiKeyMessage(res.message);
      setAiKeyInput("");
    } catch (err) {
      setAiKeyError(err instanceof Error ? err.message : "Failed to save API key");
    } finally {
      setAiSavingKey(false);
    }
  }

  async function handleToggleAi() {
    if (!aiSettings || aiToggling) return;
    setAiToggling(true);
    try {
      const res = await toggleAi(!aiSettings.is_enabled);
      setAiSettings({ is_configured: res.is_configured, masked_api_key: res.masked_api_key, is_enabled: res.is_enabled });
    } catch (err) {
      setAiKeyError(err instanceof Error ? err.message : "Failed to toggle AI");
    } finally {
      setAiToggling(false);
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
        <div className="flex flex-col gap-4">
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

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-slate-400" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">OpenAI</h2>
            </div>
            <p className="mb-3 text-xs text-slate-400">
              ใช้สำหรับ AI ช่วยกรอกที่อยู่อัตโนมัติในหน้า Create Shipment และ Chat ถามเรทราคาส่งที่ปุ่มลอยมุมซ้ายล่าง
            </p>
            <div className="mb-3 flex items-center gap-3">
              <span className="text-sm font-medium text-slate-600">เปิดใช้งาน AI</span>
              <button
                type="button"
                onClick={handleToggleAi}
                disabled={aiToggling || !aiSettings}
                aria-pressed={aiSettings?.is_enabled ?? false}
                className={`relative h-6 w-11 rounded-full transition disabled:opacity-60 ${
                  aiSettings?.is_enabled ? "bg-emerald-500" : "bg-slate-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                    aiSettings?.is_enabled ? "left-5" : "left-0.5"
                  }`}
                />
              </button>
              <span className="text-xs text-slate-400">
                {aiSettings?.is_enabled ? "กำลังเปิดใช้งานอยู่" : "ปิดใช้งานอยู่ — ปุ่ม AI สำหรับผู้ใช้จะถูกซ่อนทั้งหมด"}
              </span>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-slate-600">Status</span>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    aiSettings?.is_configured ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"
                  }`}
                >
                  {aiSettings?.is_configured ? `Connected · ${aiSettings.masked_api_key}` : "Not configured"}
                </span>
              </div>
              <label className="flex flex-1 min-w-[240px] flex-col gap-1.5">
                <span className="text-sm font-medium text-slate-600">API Key</span>
                <input
                  type="text"
                  value={aiKeyInput}
                  onChange={(e) => setAiKeyInput(e.target.value)}
                  placeholder="sk-..."
                  className={inputClass}
                />
              </label>
              <button
                type="button"
                onClick={handleSaveAiApiKey}
                disabled={aiSavingKey || !aiKeyInput.trim()}
                className="flex items-center gap-2 rounded-lg bg-brand-amber px-4 py-2 text-sm font-semibold text-brand-navy-dark hover:bg-brand-amber/90 disabled:opacity-60"
              >
                {aiSavingKey ? "Saving..." : "Save Key"}
              </button>
            </div>
            {aiKeyMessage && <p className="mt-2 text-sm text-emerald-600">{aiKeyMessage}</p>}
            {aiKeyError && <p className="mt-2 text-sm text-red-600">{aiKeyError}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

