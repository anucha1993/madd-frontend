"use client";

import { useState, type FormEvent } from "react";
import type { Agent, AgentAccount, AgentAccountInput } from "@/lib/agentAccounts";

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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!agentId || !usernameAcc.trim()) {
      setError("กรุณาเลือก Agent และกรอกชื่อบัญชี");
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
          <input
            type="text"
            value={basicAuthUsername}
            onChange={(e) => setBasicAuthUsername(e.target.value)}
            className={inputClass}
          />
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

      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={status}
          onChange={(e) => setStatus(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 accent-brand-amber"
        />
        เปิดใช้งานบัญชีนี้
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
