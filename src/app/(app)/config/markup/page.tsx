"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import Modal from "@/components/ui/Modal";
import PageLoading from "@/components/ui/PageLoading";
import { listAgents, listAgentAccounts, type Agent, type AgentAccount } from "@/lib/agentAccounts";
import { createChargeCode, listChargeCodes, type ChargeCode } from "@/lib/chargeCodes";
import {
  createMarkupRule,
  deleteMarkupRule,
  listMarkupRules,
  updateMarkupRule,
  type MarkupRule,
} from "@/lib/markupRules";

const inputClass =
  "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15";

export default function ConfigMarkupPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [accounts, setAccounts] = useState<AgentAccount[]>([]);
  const [chargeCodes, setChargeCodes] = useState<ChargeCode[]>([]);
  const [rules, setRules] = useState<MarkupRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Table filters — optional, default to "All" so the full overview shows on load.
  const [filterAgentId, setFilterAgentId] = useState<number | "">("");
  const [filterAccountId, setFilterAccountId] = useState<number | "">("");
  const [search, setSearch] = useState("");

  const [showAddModal, setShowAddModal] = useState(false);
  const [modalAgentId, setModalAgentId] = useState<number | null>(null);
  const [modalAccountIds, setModalAccountIds] = useState<Set<number>>(new Set());
  const [newChargeCodeId, setNewChargeCodeId] = useState<number | "">("");
  const [newValue, setNewValue] = useState("");
  const [newUnit, setNewUnit] = useState<"PERCENTAGE" | "BAHT">("PERCENTAGE");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [chargeCodeQuery, setChargeCodeQuery] = useState("");
  const [chargeCodeDropdownOpen, setChargeCodeDropdownOpen] = useState(false);
  const chargeCodeBoxRef = useRef<HTMLDivElement>(null);

  const [showNewChargeCode, setShowNewChargeCode] = useState(false);
  const [newCodeValue, setNewCodeValue] = useState("");
  const [newCodeLabel, setNewCodeLabel] = useState("");
  const [newCodeCategory, setNewCodeCategory] = useState("");
  const [creatingCode, setCreatingCode] = useState(false);
  const [newCodeError, setNewCodeError] = useState("");

  const [editingRule, setEditingRule] = useState<MarkupRule | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editUnit, setEditUnit] = useState<"PERCENTAGE" | "BAHT">("PERCENTAGE");
  const [editStatus, setEditStatus] = useState(true);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  useEffect(() => {
    Promise.all([listAgents(), listAgentAccounts()])
      .then(([a, acc]) => {
        setAgents(a);
        setAccounts(acc);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load data"))
      .finally(() => setLoading(false));
    loadRules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadRules() {
    try {
      setRules(await listMarkupRules());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load rules");
    }
  }

  const filterAgentAccounts = accounts.filter((a) => a.agent_id === filterAgentId);
  const modalAgent = agents.find((a) => a.id === modalAgentId);
  const modalAgentAccounts = accounts.filter((a) => a.agent_id === modalAgentId);

  const searchTerm = search.trim().toLowerCase();
  const visibleRules = rules.filter((r) => {
    if (filterAgentId && r.agent_id !== filterAgentId) return false;
    if (filterAccountId && r.agent_account_id !== filterAccountId) return false;
    if (!searchTerm) return true;
    const haystack = [
      r.agent?.agent_name,
      r.agent_account?.username_acc,
      r.charge_code?.label,
      r.charge_code?.code,
      r.charge_code?.category,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(searchTerm);
  });

  function loadChargeCodes(provider: string) {
    listChargeCodes({ provider: provider as "UPS" | "DHL" })
      .then(setChargeCodes)
      .catch(() => setChargeCodes([]));
  }

  function openAddModal() {
    setNewChargeCodeId("");
    setNewValue("");
    setNewUnit("PERCENTAGE");
    setAddError("");
    setShowNewChargeCode(false);
    setChargeCodeQuery("");
    setChargeCodeDropdownOpen(false);
    const defaultAgentId = filterAgentId || agents[0]?.id || null;
    setModalAgentId(defaultAgentId);
    const defaultAccounts = accounts.filter((a) => a.agent_id === defaultAgentId);
    setModalAccountIds(new Set(filterAccountId ? [filterAccountId] : defaultAccounts.map((a) => a.id)));
    const agent = agents.find((a) => a.id === defaultAgentId);
    if (agent) loadChargeCodes(agent.agent_code);
    setShowAddModal(true);
  }

  useEffect(() => {
    if (!modalAgentId) return;
    const agent = agents.find((a) => a.id === modalAgentId);
    if (agent) loadChargeCodes(agent.agent_code);
    const agentAccounts = accounts.filter((a) => a.agent_id === modalAgentId);
    setModalAccountIds(new Set(agentAccounts.map((a) => a.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalAgentId]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (chargeCodeBoxRef.current && !chargeCodeBoxRef.current.contains(e.target as Node)) {
        setChargeCodeDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function toggleAccountSelection(id: number) {
    setModalAccountIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllAccounts() {
    setModalAccountIds((prev) =>
      prev.size === modalAgentAccounts.length ? new Set() : new Set(modalAgentAccounts.map((a) => a.id))
    );
  }

  // Mass-create: submits one request per selected Agent Account, then reports how many
  // succeeded vs. were skipped (e.g. a rule for that charge code already exists on that account).
  async function handleAddRule() {
    if (!modalAgentId || modalAccountIds.size === 0 || !newChargeCodeId || !newValue) return;
    setAdding(true);
    setAddError("");
    const accountIds = Array.from(modalAccountIds);
    let created = 0;
    const skipped: string[] = [];
    for (const accountId of accountIds) {
      try {
        await createMarkupRule({
          agent_id: modalAgentId,
          agent_account_id: accountId,
          charge_code_id: Number(newChargeCodeId),
          value: Number(newValue),
          unit: newUnit,
        });
        created++;
      } catch (err) {
        const account = modalAgentAccounts.find((a) => a.id === accountId);
        skipped.push(`${account?.username_acc ?? accountId}: ${err instanceof Error ? err.message : "Failed"}`);
      }
    }
    await loadRules();
    setAdding(false);
    if (skipped.length === 0) {
      setShowAddModal(false);
    } else {
      setAddError(`Created for ${created} account(s). ${skipped.length} skipped:\n${skipped.join("\n")}`);
    }
  }

  async function handleToggleStatus(rule: MarkupRule) {
    await updateMarkupRule(rule.id, { status: !rule.status });
    await loadRules();
  }

  function openEditModal(rule: MarkupRule) {
    setEditingRule(rule);
    setEditValue(String(rule.value));
    setEditUnit(rule.unit);
    setEditStatus(rule.status);
    setEditError("");
  }

  async function handleSaveEdit() {
    if (!editingRule || !editValue) return;
    setEditSaving(true);
    setEditError("");
    try {
      await updateMarkupRule(editingRule.id, { value: Number(editValue), unit: editUnit, status: editStatus });
      setEditingRule(null);
      await loadRules();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to update rule");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleCreateChargeCode() {
    if (!modalAgent || !newCodeValue || !newCodeLabel) return;
    setCreatingCode(true);
    setNewCodeError("");
    try {
      const created = await createChargeCode({
        provider: modalAgent.agent_code,
        code: newCodeValue.trim(),
        label: newCodeLabel.trim(),
        category: newCodeCategory.trim() || undefined,
      });
      loadChargeCodes(modalAgent.agent_code);
      setNewChargeCodeId(created.id);
      setNewCodeValue("");
      setNewCodeLabel("");
      setNewCodeCategory("");
      setShowNewChargeCode(false);
    } catch (err) {
      setNewCodeError(err instanceof Error ? err.message : "Failed to create charge code");
    } finally {
      setCreatingCode(false);
    }
  }

  async function handleDelete(rule: MarkupRule) {
    if (!confirm(`Delete markup rule for "${rule.charge_code?.label}"?`)) return;
    await deleteMarkupRule(rule.id);
    await loadRules();
  }

  const selectedChargeCode = chargeCodes.find((c) => c.id === newChargeCodeId);
  const chargeCodeSearchTerm = chargeCodeQuery.trim().toLowerCase();
  const filteredChargeCodes = chargeCodes.filter((c) => {
    if (!chargeCodeSearchTerm) return true;
    return `${c.label} ${c.code} ${c.category ?? ""}`.toLowerCase().includes(chargeCodeSearchTerm);
  });

  return (
    <div>
      <PageHeader
        title="Mark-up Settings"
        description="กำหนดค่า Markup ต่อรายการค่าธรรมเนียม (Charge Code) แยกตามบัญชี Agent Account"
      />

      {loading ? (
        <PageLoading label="Loading Markup Rules..." />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-600">Agent (Carrier)</span>
              <select
                value={filterAgentId}
                onChange={(e) => {
                  const v = e.target.value ? Number(e.target.value) : "";
                  setFilterAgentId(v);
                  setFilterAccountId("");
                }}
                className={inputClass}
              >
                <option value="">All</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.agent_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-600">Agent Account</span>
              <select
                value={filterAccountId}
                onChange={(e) => setFilterAccountId(e.target.value ? Number(e.target.value) : "")}
                className={`${inputClass} w-56`}
              >
                <option value="">All</option>
                {filterAgentAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.username_acc}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-1 min-w-[200px] flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-600">Search</span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Charge code, category, account..."
                className={inputClass}
              />
            </label>
          </div>

          {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

          <div className="mb-3 flex justify-end">
            <button
              type="button"
              onClick={openAddModal}
              disabled={agents.length === 0}
              className="flex items-center gap-2 rounded-lg bg-brand-navy-dark px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navy-dark/90 disabled:opacity-60"
            >
              <Plus className="h-4 w-4" /> Add Rule
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-gradient-to-r from-brand-navy-dark to-brand-navy text-xs uppercase text-white/90">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Agent</th>
                  <th className="px-5 py-2.5 font-medium">Account</th>
                  <th className="px-5 py-2.5 font-medium">Charge Code</th>
                  <th className="px-5 py-2.5 font-medium">Category</th>
                  <th className="px-5 py-2.5 font-medium text-right">Value</th>
                  <th className="px-5 py-2.5 font-medium">Unit</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                  <th className="px-5 py-2.5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleRules.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-6 text-center text-sm text-slate-400">
                      No markup rules yet.
                    </td>
                  </tr>
                ) : (
                  visibleRules.map((rule) => (
                    <tr key={rule.id} className="border-b border-slate-200 last:border-0">
                      <td className="px-5 py-3 text-slate-500">{rule.agent?.agent_name ?? "-"}</td>
                      <td className="px-5 py-3 text-slate-500">{rule.agent_account?.username_acc ?? "-"}</td>
                      <td className="px-5 py-3 font-medium text-slate-700">
                        {rule.charge_code?.label}
                        <div className="text-xs text-slate-400">{rule.charge_code?.code}</div>
                      </td>
                      <td className="px-5 py-3 text-slate-500">{rule.charge_code?.category ?? "-"}</td>
                      <td className="px-5 py-3 text-right text-slate-500">{Number(rule.value).toLocaleString()}</td>
                      <td className="px-5 py-3 text-slate-500">{rule.unit === "PERCENTAGE" ? "%" : "THB"}</td>
                      <td className="px-5 py-3">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(rule)}
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            rule.status ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {rule.status ? "Active" : "Inactive"}
                        </button>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEditModal(rule)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                            aria-label="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(rule)}
                            className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                            aria-label="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {editingRule && (
            <Modal title="Edit Markup Rule" onClose={() => setEditingRule(null)}>
              <div className="flex flex-col gap-3">
                <p className="text-sm text-slate-500">
                  {editingRule.agent?.agent_name} — {editingRule.agent_account?.username_acc} —{" "}
                  <span className="font-medium text-slate-700">{editingRule.charge_code?.label}</span>{" "}
                  <span className="text-xs text-slate-400">({editingRule.charge_code?.code})</span>
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-slate-600">Value</span>
                    <input
                      type="number"
                      step="0.01"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-slate-600">Unit</span>
                    <select
                      value={editUnit}
                      onChange={(e) => setEditUnit(e.target.value as "PERCENTAGE" | "BAHT")}
                      className={inputClass}
                    >
                      <option value="PERCENTAGE">%</option>
                      <option value="BAHT">THB (flat)</option>
                    </select>
                  </label>
                </div>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-slate-600">Status</span>
                  <select
                    value={editStatus ? "1" : "0"}
                    onChange={(e) => setEditStatus(e.target.value === "1")}
                    className={inputClass}
                  >
                    <option value="1">Active</option>
                    <option value="0">Inactive</option>
                  </select>
                </label>
                {editError && <p className="text-sm text-red-600">{editError}</p>}
                <div className="mt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingRule(null)}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    disabled={editSaving || !editValue}
                    className="flex items-center gap-2 rounded-lg bg-brand-amber px-4 py-2 text-sm font-semibold text-brand-navy-dark hover:bg-brand-amber/90 disabled:opacity-60"
                  >
                    {editSaving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            </Modal>
          )}

          {showAddModal && (
            <Modal title="Add Markup Rule" onClose={() => setShowAddModal(false)}>
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-slate-600">Agent (Carrier)</span>
                    <select
                      value={modalAgentId ?? ""}
                      onChange={(e) => setModalAgentId(e.target.value ? Number(e.target.value) : null)}
                      className={inputClass}
                    >
                      {agents.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.agent_name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-600">Agent Account(s)</span>
                      <button
                        type="button"
                        onClick={toggleSelectAllAccounts}
                        disabled={modalAgentAccounts.length === 0}
                        className="text-xs font-medium text-brand-navy-dark hover:underline disabled:opacity-40"
                      >
                        {modalAccountIds.size === modalAgentAccounts.length ? "Deselect All" : "Select All"}
                      </button>
                    </div>
                    <div className="max-h-36 overflow-y-auto rounded-lg border border-slate-300 bg-white p-2">
                      {modalAgentAccounts.length === 0 ? (
                        <p className="px-1 py-1 text-xs text-slate-400">No accounts for this agent</p>
                      ) : (
                        modalAgentAccounts.map((a) => (
                          <label
                            key={a.id}
                            className="flex items-center gap-2 rounded px-1 py-1 text-sm text-slate-700 hover:bg-slate-50"
                          >
                            <input
                              type="checkbox"
                              checked={modalAccountIds.has(a.id)}
                              onChange={() => toggleAccountSelection(a.id)}
                              className="h-3.5 w-3.5 rounded border-slate-300 text-brand-navy-dark focus:ring-brand-navy/30"
                            />
                            {a.username_acc}
                          </label>
                        ))
                      )}
                    </div>
                    <p className="text-xs text-slate-400">
                      {modalAccountIds.size} account(s) selected — the rule will be created for each one.
                    </p>
                  </div>
                </div>

                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-slate-600">Charge Code</span>
                  <div ref={chargeCodeBoxRef} className="relative">
                    <input
                      type="text"
                      value={
                        chargeCodeDropdownOpen
                          ? chargeCodeQuery
                          : selectedChargeCode
                          ? `${selectedChargeCode.label} (${selectedChargeCode.code})`
                          : ""
                      }
                      onFocus={() => {
                        setChargeCodeQuery("");
                        setChargeCodeDropdownOpen(true);
                      }}
                      onChange={(e) => setChargeCodeQuery(e.target.value)}
                      placeholder="Search charge code by label or code..."
                      className={`${inputClass} w-full`}
                    />
                    {chargeCodeDropdownOpen && (
                      <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                        {filteredChargeCodes.length === 0 ? (
                          <p className="px-3 py-2 text-xs text-slate-400">No matching charge codes</p>
                        ) : (
                          filteredChargeCodes.map((c) => (
                            <button
                              type="button"
                              key={c.id}
                              onClick={() => {
                                setNewChargeCodeId(c.id);
                                setChargeCodeQuery("");
                                setChargeCodeDropdownOpen(false);
                              }}
                              className="block w-full border-b border-slate-50 px-3 py-2 text-left text-xs last:border-0 hover:bg-slate-50"
                            >
                              <span className="font-medium text-slate-700">{c.label}</span>{" "}
                              <span className="text-slate-400">
                                ({c.code}
                                {c.category ? `, ${c.category}` : ""})
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </label>

                <button
                  type="button"
                  onClick={() => setShowNewChargeCode((v) => !v)}
                  className="self-start text-xs font-medium text-amber-600 hover:underline"
                >
                  {showNewChargeCode ? "Cancel new charge code" : "+ Charge code not in the list? Add one"}
                </button>

                {showNewChargeCode && (
                  <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs text-slate-400">
                      Adds a new charge code for provider &quot;{modalAgent?.agent_code}&quot; (e.g. onboarding a
                      new carrier that isn&apos;t in the list yet).
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Code (e.g. FUEL01)"
                        value={newCodeValue}
                        onChange={(e) => setNewCodeValue(e.target.value)}
                        className={inputClass}
                      />
                      <input
                        type="text"
                        placeholder="Label (e.g. Fuel Surcharge)"
                        value={newCodeLabel}
                        onChange={(e) => setNewCodeLabel(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="Category (optional, e.g. FUEL)"
                      value={newCodeCategory}
                      onChange={(e) => setNewCodeCategory(e.target.value)}
                      className={inputClass}
                    />
                    {newCodeError && <p className="text-xs text-red-600">{newCodeError}</p>}
                    <button
                      type="button"
                      onClick={handleCreateChargeCode}
                      disabled={creatingCode || !newCodeValue || !newCodeLabel}
                      className="self-start rounded-lg bg-brand-navy-dark px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-navy-dark/90 disabled:opacity-60"
                    >
                      {creatingCode ? "Creating..." : "Create Charge Code"}
                    </button>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-slate-600">Value</span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={newValue}
                      onChange={(e) => setNewValue(e.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-slate-600">Unit</span>
                    <select
                      value={newUnit}
                      onChange={(e) => setNewUnit(e.target.value as "PERCENTAGE" | "BAHT")}
                      className={inputClass}
                    >
                      <option value="PERCENTAGE">%</option>
                      <option value="BAHT">THB (flat)</option>
                    </select>
                  </label>
                </div>
                {addError && <p className="whitespace-pre-line text-sm text-red-600">{addError}</p>}
                <div className="mt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAddRule}
                    disabled={adding || !newChargeCodeId || !newValue || modalAccountIds.size === 0}
                    className="flex items-center gap-2 rounded-lg bg-brand-amber px-4 py-2 text-sm font-semibold text-brand-navy-dark hover:bg-brand-amber/90 disabled:opacity-60"
                  >
                    <Plus className="h-4 w-4" />{" "}
                    {adding
                      ? "Adding..."
                      : modalAccountIds.size > 1
                      ? `Add Rule to ${modalAccountIds.size} Accounts`
                      : "Add Rule"}
                  </button>
                </div>
              </div>
            </Modal>
          )}
        </>
      )}
    </div>
  );
}



