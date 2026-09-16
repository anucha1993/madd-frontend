"use client";

import { useEffect, useState } from "react";
import { Building2, Pencil, Plus, Trash2 } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import Modal from "@/components/ui/Modal";
import PageLoading from "@/components/ui/PageLoading";
import BranchForm from "@/components/config/BranchForm";
import {
  createBranch,
  deleteBranch,
  listBranches,
  updateBranch,
  type Branch,
  type BranchInput,
} from "@/lib/branches";
import { listAgentAccounts, type AgentAccount } from "@/lib/agentAccounts";
import {
  listBranchCarrierAccounts,
  syncBranchCarrierAccounts,
  type BranchCarrierAccount,
  type BranchCarrierAccountInput,
} from "@/lib/branchCarrierAccounts";

export default function BranchPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const [agentAccounts, setAgentAccounts] = useState<AgentAccount[]>([]);
  const [modalBranch, setModalBranch] = useState<Branch | "new" | null>(null);
  const [modalCarrierAccounts, setModalCarrierAccounts] = useState<BranchCarrierAccount[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState("");

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      const [branchList, accounts] = await Promise.all([listBranches(), listAgentAccounts()]);
      setBranches(branchList);
      setAgentAccounts(accounts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function openModal(branch: Branch | "new") {
    setModalBranch(branch);
    setModalCarrierAccounts([]);
    setModalError("");
    if (branch === "new") return;

    setModalLoading(true);
    try {
      setModalCarrierAccounts(await listBranchCarrierAccounts(branch.id));
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "โหลดข้อมูลบัญชี Agent ไม่สำเร็จ");
    } finally {
      setModalLoading(false);
    }
  }

  async function handleSubmit(data: BranchInput, carrierAccounts: BranchCarrierAccountInput[]) {
    const branch = modalBranch && modalBranch !== "new" ? await updateBranch(modalBranch.id, data) : await createBranch(data);
    await syncBranchCarrierAccounts(branch.id, carrierAccounts);
    setModalBranch(null);
    await loadAll();
  }

  async function handleDelete(branch: Branch) {
    if (!confirm(`ยืนยันลบสาขา "${branch.name}" ?`)) return;
    await deleteBranch(branch.id);
    await loadAll();
  }

  async function handleToggleStatus(branch: Branch) {
    setTogglingId(branch.id);
    const nextStatus = !branch.status;
    setBranches((prev) => prev.map((b) => (b.id === branch.id ? { ...b, status: nextStatus } : b)));
    try {
      await updateBranch(branch.id, { status: nextStatus });
    } catch {
      setBranches((prev) => prev.map((b) => (b.id === branch.id ? { ...b, status: !nextStatus } : b)));
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div className="relative min-h-[360px]">
      <div className="mb-6 flex items-start justify-between">
        <PageHeader title="สาขา" description="จัดการข้อมูลสาขาของบริษัท" />
        <button
          type="button"
          onClick={() => openModal("new")}
          className="flex items-center gap-2 rounded-lg bg-brand-navy-dark px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navy-dark/90"
        >
          <Plus className="h-4 w-4" />
          เพิ่มสาขา
        </button>
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {loading ? (
        <PageLoading label="Loading Branches..." />
      ) : branches.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white py-20 text-center">
          <Building2 className="h-10 w-10 text-brand-amber" />
          <p className="font-medium text-slate-600">ยังไม่มีสาขาในระบบ</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gradient-to-r from-brand-navy-dark to-brand-navy text-xs uppercase text-white/90">
              <tr>
                <th className="px-5 py-2.5 font-medium">ชื่อบริษัท / สาขา</th>
                <th className="px-5 py-2.5 font-medium">รหัส</th>
                <th className="px-5 py-2.5 font-medium">เลขประจำตัวผู้เสียภาษี</th>
                <th className="px-5 py-2.5 font-medium">ที่อยู่</th>
                <th className="px-5 py-2.5 font-medium">เบอร์โทร</th>
                <th className="px-5 py-2.5 font-medium">บัญชี Agent</th>
                <th className="px-5 py-2.5 font-medium">สถานะ</th>
                <th className="px-5 py-2.5 font-medium text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {branches.map((branch) => (
                <tr key={branch.id} className="border-b border-slate-200 last:border-0">
                  <td className="px-5 py-3">
                    <div className="font-medium text-slate-700">{branch.name}</div>
                    <div className="text-xs text-slate-400">{branch.company_name}</div>
                  </td>
                  <td className="px-5 py-3 text-slate-500">{branch.code}</td>
                  <td className="px-5 py-3 text-slate-500">{branch.tax_id || "-"}</td>
                  <td className="px-5 py-3 max-w-[220px] truncate text-slate-500" title={branch.address ?? undefined}>
                    {branch.address ?? "-"}
                  </td>
                  <td className="px-5 py-3 text-slate-500">{branch.phone ?? "-"}</td>
                  <td className="px-5 py-3">
                    <button
                      type="button"
                      onClick={() => openModal(branch)}
                      className="rounded-full bg-brand-navy/5 px-2.5 py-0.5 text-xs font-medium text-brand-navy-dark hover:bg-brand-navy/10"
                    >
                      {branch.carrier_accounts_count ? `${branch.carrier_accounts_count} บัญชี` : "ทั้งหมด (ค่าเริ่มต้น)"}
                    </button>
                  </td>
                  <td className="px-5 py-3">
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(branch)}
                      disabled={togglingId === branch.id}
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition disabled:opacity-50 ${
                        branch.status
                          ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                      }`}
                      title="คลิกเพื่อเปิด/ปิดใช้งาน"
                    >
                      {togglingId === branch.id ? "..." : branch.status ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                    </button>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => openModal(branch)}
                      className="mr-2 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                      aria-label="แก้ไข"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(branch)}
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
        </div>
      )}

      {modalBranch && (
        <Modal
          title={modalBranch === "new" ? "เพิ่มสาขา" : `แก้ไขสาขา ${modalBranch.name}`}
          onClose={() => setModalBranch(null)}
        >
          {modalLoading ? (
            <PageLoading label="Loading..." />
          ) : modalError ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{modalError}</p>
          ) : (
            <BranchForm
              initial={modalBranch === "new" ? null : modalBranch}
              agentAccounts={agentAccounts}
              initialCarrierAccounts={modalCarrierAccounts}
              onSubmit={handleSubmit}
              onCancel={() => setModalBranch(null)}
            />
          )}
        </Modal>
      )}
    </div>
  );
}
