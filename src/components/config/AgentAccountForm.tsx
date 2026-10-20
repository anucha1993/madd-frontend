"use client";

import { useState, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { Agent, AgentAccount, AgentAccountInput } from "@/lib/agentAccounts";
import { serviceOptionsFor } from "@/lib/carrierServices";

type RangeDraft = {
  service_code: string;
  min: string;
  max: string;
  min_charge: string;
};

type Props = {
  agents: Agent[];
  initial?: AgentAccount | null;
  onSubmit: (data: AgentAccountInput) => Promise<void>;
  onCancel: () => void;
};

export default function AgentAccountForm({ agents, initial, onSubmit, onCancel }: Props) {
  const [agentId, setAgentId] = useState(initial?.agent_id ?? agents[0]?.id ?? 0);
  const [usernameAcc, setUsernameAcc] = useState(initial?.username_acc ?? "");
  const [apiKey, setApiKey] = useState(initial?.api_key ?? "");
  const [clientId, setClientId] = useState(initial?.client_id ?? "");
  const [clientSecret, setClientSecret] = useState("");
  const [basicAuthUsername, setBasicAuthUsername] = useState(initial?.basic_auth_username ?? "");
  const [basicAuthPassword, setBasicAuthPassword] = useState("");
  const [status, setStatus] = useState(initial?.status ?? true);
  const [mode, setMode] = useState<"test" | "production">(initial?.mode ?? "production");
  const [isApiEnabled, setIsApiEnabled] = useState(initial?.is_api_enabled ?? true);
  const [rateMinWeight, setRateMinWeight] = useState(initial?.rate_min_weight != null ? String(initial.rate_min_weight) : "");
  const [rateMaxWeight, setRateMaxWeight] = useState(initial?.rate_max_weight != null ? String(initial.rate_max_weight) : "");
  // Per-service ranges — none = every service uses the range above.
  const [serviceRanges, setServiceRanges] = useState<RangeDraft[]>(() =>
    (initial?.service_weight_ranges ?? []).map((r) => ({
      service_code: r.service_code,
      min: r.min != null ? String(r.min) : "",
      max: r.max != null ? String(r.max) : "",
      min_charge: r.min_charge != null ? String(r.min_charge) : "",
    })),
  );
  const [perService, setPerService] = useState((initial?.service_weight_ranges ?? []).length > 0);
  const agentCode = agents.find((a) => a.id === agentId)?.agent_code;
  const serviceOptions = serviceOptionsFor(agentCode);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!agentId || !usernameAcc.trim()) {
      setError("กรุณาเลือก Agent และกรอกชื่อบัญชี");
      return;
    }
    if (rateMinWeight !== "" && rateMaxWeight !== "" && Number(rateMaxWeight) <= Number(rateMinWeight)) {
      setError("ช่วงน้ำหนัก Check Rate: น้ำหนักสูงสุดต้องมากกว่าน้ำหนักต่ำสุด");
      return;
    }
    const ranges = perService ? serviceRanges.filter((r) => r.service_code) : [];
    const codes = ranges.map((r) => r.service_code);
    if (new Set(codes).size !== codes.length) {
      setError("ช่วงน้ำหนักแยกตาม Service: เลือก Service ซ้ำกัน");
      return;
    }
    const bad = ranges.find((r) => r.min !== "" && r.max !== "" && Number(r.max) <= Number(r.min));
    if (bad) {
      setError(`Service ${bad.service_code}: น้ำหนักสูงสุดต้องมากกว่าน้ำหนักต่ำสุด`);
      return;
    }
    const badMin = ranges.find((r) => r.min_charge !== "" && (r.min === "" || (r.max !== "" && Number(r.min_charge) > Number(r.max))));
    if (badMin) {
      setError(`Service ${badMin.service_code}: ราคาขั้นต่ำต้องมีน้ำหนักเริ่มต้นของช่วง และไม่เกินน้ำหนักสูงสุด`);
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        agent_id: agentId,
        username_acc: usernameAcc.trim(),
        api_key: apiKey.trim() || undefined,
        client_id: clientId.trim() || undefined,
        client_secret: clientSecret.trim() || undefined,
        basic_auth_username: basicAuthUsername.trim() || undefined,
        basic_auth_password: basicAuthPassword.trim() || undefined,
        status,
        mode,
        is_api_enabled: isApiEnabled,
        rate_min_weight: rateMinWeight === "" ? null : Number(rateMinWeight),
        rate_max_weight: rateMaxWeight === "" ? null : Number(rateMaxWeight),
        service_weight_ranges: ranges.map((r) => ({
          service_code: r.service_code,
          min: r.min === "" ? null : Number(r.min),
          max: r.max === "" ? null : Number(r.max),
          min_charge: r.min_charge === "" ? null : Number(r.min_charge),
        })),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-brand-navy focus:bg-white focus:ring-2 focus:ring-brand-navy/15";
  const labelClass = "text-sm font-medium text-slate-600";
  // Same look without w-full — for inputs sharing a row.
  const compactInput = inputClass.replace("w-full ", "");

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className={labelClass}>Agent</span>
        <select value={agentId} onChange={(e) => setAgentId(Number(e.target.value))} className={inputClass}>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.agent_name} ({a.agent_code})
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={labelClass}>ชื่อบัญชี (username_acc)</span>
        <input
          type="text"
          value={usernameAcc}
          onChange={(e) => setUsernameAcc(e.target.value)}
          placeholder="เช่น ax3173"
          className={inputClass}
        />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>API Key</span>
          <input type="text" value={apiKey} onChange={(e) => setApiKey(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Client ID</span>
          <input type="text" value={clientId} onChange={(e) => setClientId(e.target.value)} className={inputClass} />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className={labelClass}>Client Secret</span>
        <input
          type="password"
          value={clientSecret}
          onChange={(e) => setClientSecret(e.target.value)}
          placeholder={initial?.has_client_secret ? "•••••••• (เว้นว่างไว้เพื่อไม่เปลี่ยนแปลง)" : ""}
          className={inputClass}
        />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Basic Auth Username</span>
          <input type="text" value={basicAuthUsername} onChange={(e) => setBasicAuthUsername(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Basic Auth Password</span>
          <input
            type="password"
            value={basicAuthPassword}
            onChange={(e) => setBasicAuthPassword(e.target.value)}
            placeholder={initial?.has_basic_auth_password ? "•••••••• (เว้นว่างไว้เพื่อไม่เปลี่ยนแปลง)" : ""}
            className={inputClass}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className={labelClass}>Mode</span>
        <select value={mode} onChange={(e) => setMode(e.target.value as "test" | "production")} className={inputClass}>
          <option value="production">Production (ใช้งานจริง)</option>
          <option value="test">Test (ทดสอบบน Sandbox — ไม่คิดเงินจริง)</option>
        </select>
        <p className="text-xs text-slate-400">
          กำหนดว่า Client ID/Secret หรือ Basic Auth ของบัญชีนี้เป็นของ Sandbox (Test) หรือ Production จริง — ระบบจะเรียก URL ของ UPS/DHL
          คนละสภาพแวดล้อมตามค่านี้
        </p>
      </label>

      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={status}
          onChange={(e) => setStatus(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 accent-brand-amber"
        />
        เปิดใช้งานบัญชีนี้
      </label>

      <label className="flex flex-col gap-1.5 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
        <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={!isApiEnabled}
            onChange={(e) => setIsApiEnabled(!e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 accent-brand-amber"
          />
          ปิดใช้งาน API (สำหรับขนส่งที่ไม่มีการเชื่อมต่อ API จริง เช่น Kerry, Flash)
        </span>
        <span className="pl-6 text-xs text-slate-400">
          บัญชีนี้จะไม่แสดงให้เลือกตอนเช็คราคา/สร้าง Shipment แต่จะยังแสดงให้เลือกเป็นชื่อขนส่งตอนออกใบเสร็จได้
        </span>
      </label>

      {isApiEnabled && (
        <div className="flex flex-col gap-1.5">
          <span className={labelClass}>ช่วงน้ำหนักที่ใช้ Check Rate (kg)</span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              step="0.01"
              value={rateMinWeight}
              onChange={(e) => setRateMinWeight(e.target.value)}
              placeholder="ตั้งแต่ (ว่าง = 0)"
              className={inputClass}
            />
            <span className="text-slate-400">–</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={rateMaxWeight}
              onChange={(e) => setRateMaxWeight(e.target.value)}
              placeholder="ถึง (ว่าง = ไม่จำกัด)"
              className={inputClass}
            />
          </div>
          <p className="text-xs text-slate-400">
            เช่น 0 – 10 = ดึงราคาจากบัญชีนี้เฉพาะ Shipment ที่น้ำหนักคิดเงิน (รวมน้ำหนักตามขนาด) ไม่เกิน 10 kg · ว่างทั้งสองช่อง =
            ทุกน้ำหนัก
          </p>

          {serviceOptions.length > 0 && (
            <div className="mt-2 flex flex-col gap-2 rounded-lg border border-slate-200 p-3">
              <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                <label className="flex items-center gap-1.5">
                  <input type="radio" checked={!perService} onChange={() => setPerService(false)} className="accent-brand-amber" />
                  ใช้ช่วงเดียวกันทุก Service
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    checked={perService}
                    onChange={() => {
                      setPerService(true);
                      if (serviceRanges.length === 0)
                        setServiceRanges([
                          {
                            service_code: serviceOptions[0].code,
                            min: "",
                            max: "",
                            min_charge: "",
                          },
                        ]);
                    }}
                    className="accent-brand-amber"
                  />
                  กำหนดแยกตาม Service
                </label>
              </div>
              {perService && (
                <>
                  {serviceRanges.map((r, i) => {
                    const set = (patch: Partial<RangeDraft>) =>
                      setServiceRanges((prev) => prev.map((x, k) => (k === i ? { ...x, ...patch } : x)));
                    return (
                      <div key={i} className="flex flex-col gap-1.5 rounded-lg bg-slate-50 p-2">
                        <div className="flex items-center gap-2">
                          <select
                            value={r.service_code}
                            onChange={(e) => set({ service_code: e.target.value })}
                            className={`${compactInput} min-w-0 flex-1`}
                          >
                            {serviceOptions.map((o) => (
                              <option key={o.code} value={o.code}>
                                {o.code} · {o.label}
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={r.min}
                            onChange={(e) => set({ min: e.target.value })}
                            placeholder="ตั้งแต่"
                            className={`${compactInput} w-20 shrink-0`}
                          />
                          <span className="text-slate-400">–</span>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={r.max}
                            onChange={(e) => set({ max: e.target.value })}
                            placeholder="ถึง"
                            title="ว่าง = ไม่จำกัด"
                            className={`${compactInput} w-20 shrink-0`}
                          />
                          <button
                            type="button"
                            onClick={() => setServiceRanges((prev) => prev.filter((_, k) => k !== i))}
                            className="shrink-0 rounded p-1.5 text-red-500 hover:bg-red-50"
                            aria-label="ลบ"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        {r.min !== "" && (
                          <label className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            ต่ำกว่า {r.min} kg:
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={r.min_charge}
                              onChange={(e) => set({ min_charge: e.target.value })}
                              placeholder="ไม่ขาย"
                              className={`${compactInput} w-24`}
                            />
                            {r.min_charge === ""
                              ? "ว่าง = ไม่ขาย Service นี้"
                              : `kg = ขายขั้นต่ำ ${r.min_charge} kg (จองจริงตามน้ำหนักจริง)`}
                          </label>
                        )}
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() =>
                      setServiceRanges((prev) => [
                        ...prev,
                        {
                          service_code:
                            serviceOptions.find((o) => !prev.some((p) => p.service_code === o.code))?.code ?? serviceOptions[0].code,
                          min: "",
                          max: "",
                          min_charge: "",
                        },
                      ])
                    }
                    className="flex w-fit items-center gap-1 text-sm font-medium text-brand-navy hover:underline"
                  >
                    <Plus className="h-4 w-4" /> เพิ่ม Service
                  </button>
                  <p className="text-xs text-slate-400">
                    เช่น 08 Worldwide Expedited 25.01 – 70 = ขาย Expedited จากบัญชีนี้ 25.01–70 kg · ต่ำกว่า 25.01 ใส่ 25 = ยังขาย
                    แต่คิดราคาที่ 25 kg · Service ที่ไม่ได้ระบุใช้ช่วงด้านบน
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      )}

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
          ยกเลิก
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-brand-navy-dark px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-navy-dark/90 disabled:opacity-60"
        >
          {submitting ? "กำลังบันทึก..." : "บันทึก"}
        </button>
      </div>
    </form>
  );
}
