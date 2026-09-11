"use client";

import { useEffect, useState } from "react";
import { Image as ImageIcon, KeyRound, Loader2, Pencil, Plug, Plus, ShieldCheck, Trash2 } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import Modal from "@/components/ui/Modal";
import PageLoading from "@/components/ui/PageLoading";
import AgentAccountForm from "@/components/config/AgentAccountForm";
import {
  createAgentAccount,
  deleteAgentAccount,
  listAgentAccounts,
  listAgents,
  testAgentAccount,
  updateAgent,
  updateAgentAccount,
  type Agent,
  type AgentAccount,
  type AgentAccountInput,
  type TestResult,
} from "@/lib/agentAccounts";

export default function AgentAccountsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [accounts, setAccounts] = useState<AgentAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalAccount, setModalAccount] = useState<AgentAccount | "new" | null>(null);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [testResults, setTestResults] = useState<Record<number, TestResult>>({});
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [logoEditAgent, setLogoEditAgent] = useState<Agent | null>(null);
  const [logoUrlInput, setLogoUrlInput] = useState("");
  const [logoSaving, setLogoSaving] = useState(false);

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      const [agentsRes, accountsRes] = await Promise.all([listAgents(), listAgentAccounts()]);
      setAgents(agentsRes);
      setAccounts(accountsRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function handleSubmit(data: AgentAccountInput) {
    if (modalAccount && modalAccount !== "new") {
      await updateAgentAccount(modalAccount.id, data);
    } else {
      await createAgentAccount(data);
    }
    setModalAccount(null);
    await loadAll();
  }

  async function handleDelete(account: AgentAccount) {
    if (!confirm(`ยืนยันลบบัญชี "${account.username_acc}" ?`)) return;
    await deleteAgentAccount(account.id);
    await loadAll();
  }

  async function handleTest(account: AgentAccount) {
    setTestingId(account.id);
    try {
      const result = await testAgentAccount(account.id);
      setTestResults((prev) => ({ ...prev, [account.id]: result }));
    } catch (err) {
      setTestResults((prev) => ({
        ...prev,
        [account.id]: { success: false, message: err instanceof Error ? err.message : "ทดสอบไม่สำเร็จ" },
      }));
    } finally {
      setTestingId(null);
    }
  }

  async function handleToggleStatus(account: AgentAccount) {
    setTogglingId(account.id);
    const nextStatus = !account.status;
    setAccounts((prev) => prev.map((a) => (a.id === account.id ? { ...a, status: nextStatus } : a)));
    try {
      await updateAgentAccount(account.id, { status: nextStatus });
    } catch {
      setAccounts((prev) => prev.map((a) => (a.id === account.id ? { ...a, status: !nextStatus } : a)));
    } finally {
      setTogglingId(null);
    }
  }

  function openLogoEdit(agent: Agent) {
    setLogoEditAgent(agent);
    setLogoUrlInput(agent.logo_url ?? "");
  }

  async function handleSaveLogo() {
    if (!logoEditAgent) return;
    setLogoSaving(true);
    try {
      await updateAgent(logoEditAgent.id, { logo_url: logoUrlInput.trim() || null });
      setLogoEditAgent(null);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกโลโก้ไม่สำเร็จ");
    } finally {
      setLogoSaving(false);
    }
  }

  return (
    <div className="relative min-h-[360px]">
      <div className="mb-6 flex items-start justify-between">
        <PageHeader title="บัญชี Agent (UPS/DHL)" description="จัดการบัญชีขนส่งที่ใช้สำหรับเช็คราคาและสร้างพัสดุ" />
        <button
          type="button"
          onClick={() => setModalAccount("new")}
          className="flex items-center gap-2 rounded-lg bg-brand-navy-dark px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navy-dark/90"
        >
          <Plus className="h-4 w-4" />
          เพิ่มบัญชี
        </button>
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {loading ? (
        <PageLoading label="กำลังโหลดข้อมูลบัญชี Agent..." />
      ) : (
      <div className="flex flex-col gap-6">
        {agents.map((agent) => {
            const agentAccounts = accounts.filter((a) => a.agent_id === agent.id);
            return (
              <div key={agent.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between bg-gradient-to-r from-brand-navy-dark to-brand-navy px-5 py-3 text-white shadow-md">
                  <div className="flex items-center gap-2">
                    {agent.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={agent.logo_url}
                        alt={agent.agent_code}
                        className="h-9 max-w-[90px] object-contain"
                      />
                    ) : (
                      <span className="rounded-full bg-brand-amber px-2.5 py-0.5 text-xs font-bold text-brand-navy-dark">
                        {agent.agent_code}
                      </span>
                    )}
                    <span className="font-semibold">{agent.agent_name}</span>
                    <button
                      type="button"
                      onClick={() => openLogoEdit(agent)}
                      className="rounded-lg p-1 text-slate-300 hover:bg-white/10 hover:text-white"
                      title="แนบ URL โลโก้"
                      aria-label="แก้ไขโลโก้"
                    >
                      <ImageIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <span className="text-xs text-slate-300">{agentAccounts.length} บัญชี</span>
                </div>

                {agentAccounts.length === 0 ? (
                  <p className="px-5 py-6 text-sm text-slate-400">ยังไม่มีบัญชีสำหรับ Agent นี้</p>
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gradient-to-r from-brand-navy-dark to-brand-navy text-xs uppercase text-white/90">
                      <tr>
                        <th className="px-5 py-2.5 font-medium">ชื่อบัญชี</th>
                        <th className="px-5 py-2.5 font-medium">Client ID</th>
                        <th className="px-5 py-2.5 font-medium">Credentials</th>
                        <th className="px-5 py-2.5 font-medium">Mode</th>
                        <th className="px-5 py-2.5 font-medium">สถานะ</th>
                        <th className="px-5 py-2.5 font-medium">ผลทดสอบ</th>
                        <th className="px-5 py-2.5 font-medium text-right">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agentAccounts.map((account) => (
                        <tr key={account.id} className="border-b border-slate-200 last:border-0">
                          <td className="px-5 py-3 font-medium text-slate-700">{account.username_acc}</td>
                          <td className="px-5 py-3 text-slate-500">{account.client_id ?? "-"}</td>
                          <td className="px-5 py-3">
                            <div className="flex gap-1.5">
                              {account.has_client_secret && (
                                <span
                                  title="มี Client Secret"
                                  className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-600"
                                >
                                  <KeyRound className="h-3 w-3" /> OAuth
                                </span>
                              )}
                              {account.has_basic_auth_password && (
                                <span
                                  title="มี Basic Auth Password"
                                  className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600"
                                >
                                  <ShieldCheck className="h-3 w-3" /> Basic
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                account.mode === "test" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-600"
                              }`}
                            >
                              {account.mode === "test" ? "Test" : "Production"}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(account)}
                              disabled={togglingId === account.id}
                              className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition disabled:opacity-50 ${
                                account.status
                                  ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                              }`}
                              title="คลิกเพื่อเปิด/ปิดใช้งาน"
                            >
                              {togglingId === account.id ? "..." : account.status ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                            </button>
                          </td>
                          <td className="px-5 py-3">
                            {testingId === account.id ? (
                              <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" /> กำลังทดสอบ...
                              </span>
                            ) : testResults[account.id] ? (
                              <span
                                title={testResults[account.id].detail}
                                className={`inline-flex max-w-[220px] items-center gap-1 truncate rounded-full px-2 py-0.5 text-xs font-medium ${
                                  testResults[account.id].success
                                    ? "bg-emerald-50 text-emerald-600"
                                    : "bg-red-50 text-red-600"
                                }`}
                              >
                                {testResults[account.id].success ? "✅" : "❌"} {testResults[account.id].message}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-300">ยังไม่ได้ทดสอบ</span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleTest(account)}
                              disabled={testingId === account.id}
                              className="mr-2 rounded-lg p-1.5 text-brand-navy hover:bg-slate-100 disabled:opacity-50"
                              aria-label="ทดสอบ"
                              title="ทดสอบการเชื่อมต่อ API"
                            >
                              <Plug className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setModalAccount(account)}
                              className="mr-2 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                              aria-label="แก้ไข"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(account)}
                              className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                              aria-label="ลบ"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
      </div>
      )}

      {modalAccount && (
        <Modal
          title={modalAccount === "new" ? "เพิ่มบัญชี Agent" : `แก้ไขบัญชี ${modalAccount.username_acc}`}
          onClose={() => setModalAccount(null)}
        >
          <AgentAccountForm
            agents={agents}
            initial={modalAccount === "new" ? null : modalAccount}
            onSubmit={handleSubmit}
            onCancel={() => setModalAccount(null)}
          />
        </Modal>
      )}

      {logoEditAgent && (
        <Modal title={`โลโก้ ${logoEditAgent.agent_name}`} onClose={() => setLogoEditAgent(null)}>
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-600">URL รูปโลโก้</span>
              <input
                type="text"
                value={logoUrlInput}
                onChange={(e) => setLogoUrlInput(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15"
              />
            </label>
            {logoUrlInput.trim() && (
              <div className="flex items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoUrlInput.trim()} alt="ตัวอย่างโลโก้" className="h-10 max-w-[160px] object-contain" />
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setLogoEditAgent(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleSaveLogo}
                disabled={logoSaving}
                className="rounded-lg bg-brand-navy-dark px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navy-dark/90 disabled:opacity-60"
              >
                {logoSaving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
