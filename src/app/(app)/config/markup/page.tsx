"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Pin, PinOff, Trash2 } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import Modal from "@/components/ui/Modal";
import PageLoading from "@/components/ui/PageLoading";
import { listAgents, listAgentAccounts, type Agent, type AgentAccount } from "@/lib/agentAccounts";
import { createChargeCode, listChargeCodes, previewChargeFormula, updateChargeCode, type ChargeCode } from "@/lib/chargeCodes";
import {
  createMarkupRule,
  deleteMarkupRule,
  listMarkupRules,
  updateMarkupRule,
  type MarkupRule,
} from "@/lib/markupRules";

const inputClass =
  "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15";

// Same cost-only codes ChargeMarkupService always excludes from the sell total (carrier's own
// insurance) — used here to build an equivalent "sum of everything else" formula when
// simulating a Custom (not-from-API) charge code's PERCENTAGE rule.
const COST_ONLY_CODES = ["400", "II", "IB"];

type ParsedRule =
  | { rule_type: "SIMPLE"; unit: "PERCENTAGE" | "BAHT"; value: number; formula: null }
  | { rule_type: "FORMULA"; unit: null; value: null; formula: string };

// Excel-style single-cell syntax: "7%" => 7% markup, "50" => flat 50 THB, "={BASE}+{FF}*7%" =>
// a formula. Returns null for an empty cell (= no rule), or "invalid" if it doesn't parse.
function parseRuleInput(text: string): ParsedRule | null | "invalid" {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("=")) {
    const formula = trimmed.slice(1).trim();
    return formula ? { rule_type: "FORMULA", unit: null, value: null, formula } : "invalid";
  }
  if (trimmed.endsWith("%")) {
    const num = Number(trimmed.slice(0, -1).trim());
    return Number.isNaN(num) ? "invalid" : { rule_type: "SIMPLE", unit: "PERCENTAGE", value: num, formula: null };
  }
  const num = Number(trimmed);
  return Number.isNaN(num) ? "invalid" : { rule_type: "SIMPLE", unit: "BAHT", value: num, formula: null };
}

// The inverse of parseRuleInput — how an existing rule shows up in the cell when the modal opens.
function formatRuleText(rule?: MarkupRule): string {
  if (!rule) return "";
  if (rule.rule_type === "FORMULA") return `=${rule.formula ?? ""}`;
  return rule.unit === "PERCENTAGE" ? `${rule.value}%` : `${rule.value}`;
}

// Turns ANY rule (Simple % / Simple flat / Formula) into a plain formula string so the
// Calculation panel can preview every row through the same /charge-formula/preview endpoint
// instead of re-implementing the markup math a second time on the frontend.
function buildPreviewFormula(code: ChargeCode, rule: MarkupRule, allCodes: ChargeCode[]): string | null {
  if (rule.rule_type === "FORMULA") return rule.formula;
  if (rule.value == null || !rule.unit) return null;
  if (code.is_custom) {
    if (rule.unit === "PERCENTAGE") {
      const sellCodes = allCodes.filter((c) => !COST_ONLY_CODES.includes(c.code));
      if (sellCodes.length === 0) return null;
      return `(${sellCodes.map((c) => `{${c.code}}`).join("+")}) * (${rule.value}/100)`;
    }
    return `${rule.value}`;
  }
  return rule.unit === "PERCENTAGE" ? `{${code.code}} * (1 + ${rule.value}/100)` : `{${code.code}} + ${rule.value}`;
}

export default function ConfigMarkupPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [accounts, setAccounts] = useState<AgentAccount[]>([]);
  const [rules, setRules] = useState<MarkupRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Account list filters — this page is account-first: pick an account, then manage its rules.
  const [filterAgentId, setFilterAgentId] = useState<number | "">("");
  const [search, setSearch] = useState("");

  const [modalAccount, setModalAccount] = useState<AgentAccount | null>(null);
  const [chargeCodes, setChargeCodes] = useState<ChargeCode[]>([]);
  const [accountRules, setAccountRules] = useState<MarkupRule[]>([]);
  const [accountRulesLoading, setAccountRulesLoading] = useState(false);

  // Spreadsheet-style editing: one row per pinned/rule-bearing Charge Code, cell text parsed by
  // parseRuleInput and auto-saved on blur.
  const [ruleInputs, setRuleInputs] = useState<Record<number, string>>({});
  const [ruleSaving, setRuleSaving] = useState<Record<number, boolean>>({});
  const [ruleErrors, setRuleErrors] = useState<Record<number, string>>({});

  // Autocomplete for inserting {CODE} references while typing a "กฎ" formula — keyed by
  // charge_code_id of the row currently showing suggestions.
  const [formulaDropdownCodeId, setFormulaDropdownCodeId] = useState<number | null>(null);
  const ruleInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  // The dropdown is portaled to <body> with fixed positioning (see render below) so it isn't
  // clipped by the table's/modal's overflow-hidden ancestors — close it on scroll/resize since
  // its position is only recomputed on render.
  useEffect(() => {
    if (formulaDropdownCodeId == null) return;
    const close = () => setFormulaDropdownCodeId(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [formulaDropdownCodeId]);

  // "Calculation" simulation panel — made-up amounts per Charge Code, previewed through every
  // row's rule (converted to an equivalent formula) before anything is used on a real quote.
  const [simValues, setSimValues] = useState<Record<string, string>>({});
  const [simResults, setSimResults] = useState<Record<string, number | null>>({});
  const [simErrors, setSimErrors] = useState<Record<string, string>>({});
  const [simCalculating, setSimCalculating] = useState(false);

  const [chargeCodeQuery, setChargeCodeQuery] = useState("");
  const [chargeCodeDropdownOpen, setChargeCodeDropdownOpen] = useState(false);

  const [showNewChargeCode, setShowNewChargeCode] = useState(false);
  const [newCodeValue, setNewCodeValue] = useState("");
  const [newCodeLabel, setNewCodeLabel] = useState("");
  const [newCodeCategory, setNewCodeCategory] = useState("");
  const [creatingCode, setCreatingCode] = useState(false);
  const [newCodeError, setNewCodeError] = useState("");

  useEffect(() => {
    Promise.all([listAgents(), listAgentAccounts()])
      .then(([a, acc]) => {
        setAgents(a);
        setAccounts(acc);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load data"))
      .finally(() => setLoading(false));
    loadRules();
  }, []);

  async function loadRules() {
    try {
      setRules(await listMarkupRules());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load rules");
    }
  }

  const searchTerm = search.trim().toLowerCase();
  const visibleAccounts = accounts.filter((a) => {
    if (filterAgentId && a.agent_id !== filterAgentId) return false;
    if (!searchTerm) return true;
    const agentName = agents.find((ag) => ag.id === a.agent_id)?.agent_name ?? "";
    return `${a.username_acc} ${agentName}`.toLowerCase().includes(searchTerm);
  });

  function ruleCountFor(accountId: number) {
    const accountOnly = rules.filter((r) => r.agent_account_id === accountId);
    return { total: accountOnly.length, active: accountOnly.filter((r) => r.status).length };
  }

  async function reloadAccountRules(accountId: number) {
    setAccountRules(await listMarkupRules({ agent_account_id: accountId }));
  }

  // Account-first: open one Account and manage its Markup Rules inside as a small spreadsheet
  // (pinned/rule-bearing Charge Codes as rows) instead of one modal per (account, charge code).
  async function openAccountModal(account: AgentAccount) {
    setModalAccount(account);
    setError("");
    setShowNewChargeCode(false);
    setNewCodeValue("");
    setNewCodeLabel("");
    setNewCodeCategory("");
    setNewCodeError("");
    setChargeCodeQuery("");
    setChargeCodeDropdownOpen(false);
    setSimValues({});
    setSimResults({});
    setSimErrors({});
    setRuleErrors({});
    setRuleSaving({});
    setAccountRulesLoading(true);
    try {
      const provider = account.agent?.agent_code as "UPS" | "DHL" | undefined;
      const [codes, rulesForAccount] = await Promise.all([
        listChargeCodes(provider ? { provider } : {}),
        listMarkupRules({ agent_account_id: account.id }),
      ]);
      setChargeCodes(codes);
      setAccountRules(rulesForAccount);
      const initialInputs: Record<number, string> = {};
      codes.forEach((c) => {
        const rule = rulesForAccount.find((r) => r.charge_code_id === c.id);
        if (rule) initialInputs[c.id] = formatRuleText(rule);
      });
      setRuleInputs(initialInputs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load account data");
    } finally {
      setAccountRulesLoading(false);
    }
  }

  // Swaps {CODE} references for their human-readable label, purely for display.
  function describeFormula(formula: string): string {
    return formula.replace(/\{([^{}]+)\}/g, (_match, code) => {
      const match = chargeCodes.find((c) => c.code === code.trim());
      return match ? match.label : code;
    });
  }

  // The bare word (letters/digits/underscore) immediately before the cursor in a "กฎ" cell —
  // what the user is currently typing that could match a Charge Code.
  function ruleFormulaToken(code: ChargeCode): string {
    const text = ruleInputs[code.id] ?? "";
    const cursorPos = ruleInputRefs.current[code.id]?.selectionStart ?? text.length;
    let start = cursorPos;
    while (start > 0 && /[A-Za-z0-9_]/.test(text[start - 1])) start--;
    return text.slice(start, cursorPos).trim().toLowerCase();
  }

  function ruleFormulaSuggestions(code: ChargeCode): ChargeCode[] {
    const query = ruleFormulaToken(code);
    const pool = query
      ? chargeCodes.filter((c) => `${c.code} ${c.label}`.toLowerCase().includes(query))
      : chargeCodes;
    return pool.slice(0, 8);
  }

  // Fixed-position coordinates (viewport-relative) for the portaled suggestion dropdown,
  // anchored just below the row's "กฎ" input.
  function ruleDropdownPosition(codeId: number): { top: number; left: number; width: number } | null {
    const el = ruleInputRefs.current[codeId];
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return { top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 224) };
  }

  // Replaces the word currently being typed with a proper {CODE} reference, auto-prefixing
  // "=" if the cell wasn't already in formula mode, so plain "BASE" becomes "={BASE}".
  function insertCodeIntoRule(rowCode: ChargeCode, selected: ChargeCode) {
    const input = ruleInputRefs.current[rowCode.id];
    const text = ruleInputs[rowCode.id] ?? "";
    const cursorPos = input?.selectionStart ?? text.length;
    let start = cursorPos;
    while (start > 0 && /[A-Za-z0-9_]/.test(text[start - 1])) start--;
    const before = text.slice(0, start);
    const after = text.slice(cursorPos);
    let newText = `${before}{${selected.code}}${after}`;
    if (!newText.trimStart().startsWith("=")) newText = `=${newText}`;
    const newCursor = newText.length - after.length;
    setRuleInputs((prev) => ({ ...prev, [rowCode.id]: newText }));
    requestAnimationFrame(() => {
      const el = ruleInputRefs.current[rowCode.id];
      if (el) {
        el.focus();
        el.setSelectionRange(newCursor, newCursor);
      }
    });
  }

  // Pinned codes are exactly the rows shown in the spreadsheet table below.
  async function toggleChargeCodePin(code: ChargeCode) {
    const updated = await updateChargeCode(code.id, { is_pinned: !code.is_pinned });
    setChargeCodes((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  }

  async function handleCreateChargeCode() {
    if (!modalAccount?.agent || !newCodeValue || !newCodeLabel) return;
    setCreatingCode(true);
    setNewCodeError("");
    try {
      const created = await createChargeCode({
        provider: modalAccount.agent.agent_code,
        code: newCodeValue.trim(),
        label: newCodeLabel.trim(),
        category: newCodeCategory.trim() || undefined,
      });
      const pinned = await updateChargeCode(created.id, { is_pinned: true });
      setChargeCodes((prev) => [...prev, pinned]);
      setNewCodeValue("");
      setNewCodeLabel("");
      setNewCodeCategory("");
      setShowNewChargeCode(false);
      setChargeCodeQuery("");
      setChargeCodeDropdownOpen(false);
    } catch (err) {
      setNewCodeError(err instanceof Error ? err.message : "Failed to create charge code");
    } finally {
      setCreatingCode(false);
    }
  }

  // Auto-saves a row's "กฎ" cell on blur — creates, updates, or deletes the rule depending on
  // what's already saved vs. what was just typed.
  async function handleRuleSave(code: ChargeCode) {
    if (!modalAccount) return;
    const text = ruleInputs[code.id] ?? "";
    const existingRule = accountRules.find((r) => r.charge_code_id === code.id);
    const parsed = parseRuleInput(text);

    setRuleErrors((prev) => ({ ...prev, [code.id]: "" }));
    if (parsed === "invalid") {
      setRuleErrors((prev) => ({ ...prev, [code.id]: "รูปแบบไม่ถูกต้อง — พิมพ์ตัวเลข, ตัวเลข%, หรือ =สูตร" }));
      return;
    }
    if (text.trim() === formatRuleText(existingRule).trim()) return;

    setRuleSaving((prev) => ({ ...prev, [code.id]: true }));
    try {
      if (parsed === null) {
        if (existingRule) await deleteMarkupRule(existingRule.id);
      } else if (existingRule) {
        await updateMarkupRule(existingRule.id, {
          rule_type: parsed.rule_type,
          value: parsed.value,
          unit: parsed.unit,
          formula: parsed.formula,
        });
      } else {
        await createMarkupRule({
          agent_id: modalAccount.agent_id,
          agent_account_id: modalAccount.id,
          charge_code_id: code.id,
          rule_type: parsed.rule_type,
          value: parsed.value,
          unit: parsed.unit,
          formula: parsed.formula,
        });
      }
      await reloadAccountRules(modalAccount.id);
      await loadRules();
    } catch (err) {
      setRuleErrors((prev) => ({ ...prev, [code.id]: err instanceof Error ? err.message : "บันทึกไม่สำเร็จ" }));
    } finally {
      setRuleSaving((prev) => ({ ...prev, [code.id]: false }));
    }
  }

  async function handleToggleRuleStatus(code: ChargeCode) {
    const rule = accountRules.find((r) => r.charge_code_id === code.id);
    if (!rule || !modalAccount) return;
    await updateMarkupRule(rule.id, { status: !rule.status });
    await reloadAccountRules(modalAccount.id);
    await loadRules();
  }

  // Removes the row: deletes its rule (if any, after confirming) and unpins the code so it no
  // longer shows up here.
  async function handleRemoveRow(code: ChargeCode) {
    const rule = accountRules.find((r) => r.charge_code_id === code.id);
    if (rule) {
      if (!confirm(`ลบกฎ Markup ของ "${code.label}" ?`)) return;
      await deleteMarkupRule(rule.id);
      if (modalAccount) {
        await reloadAccountRules(modalAccount.id);
        await loadRules();
      }
    }
    if (code.is_pinned) await toggleChargeCodePin(code);
    setRuleInputs((prev) => {
      const next = { ...prev };
      delete next[code.id];
      return next;
    });
  }

  // Runs every row's rule (converted to a formula) against the SAME shared set of "ค่าสมมติ"
  // (assumed) values, so a formula referencing another Charge Code resolves against whatever was
  // typed for that code's own row. Rows with no rule (or an untucked/inactive one) still count —
  // they pass through their own assumed value unchanged, since users often type numbers to test
  // before ticking "ใช้กฎ" or before a rule even exists.
  async function handleCalculateAll() {
    setSimCalculating(true);
    const values: Record<string, number> = {};
    chargeCodes.forEach((c) => {
      values[c.code] = Number(simValues[c.code]) || 0;
    });
    const nextResults: Record<string, number | null> = {};
    const nextErrors: Record<string, string> = {};
    await Promise.all(
      tableCodes.map(async (code) => {
        const rule = accountRules.find((r) => r.charge_code_id === code.id);
        const formula = rule ? buildPreviewFormula(code, rule, chargeCodes) : null;
        if (!formula) {
          nextResults[code.code] = values[code.code] ?? 0;
          return;
        }
        try {
          const res = await previewChargeFormula(formula, values);
          nextResults[code.code] = res.result;
        } catch (err) {
          nextErrors[code.code] = err instanceof Error ? err.message : "คำนวณไม่สำเร็จ";
        }
      }),
    );
    setSimResults(nextResults);
    setSimErrors(nextErrors);
    setSimCalculating(false);
  }

  const chargeCodeSearchTerm = chargeCodeQuery.trim().toLowerCase();
  const filteredChargeCodes = chargeCodes.filter((c) => {
    if (!chargeCodeSearchTerm) return true;
    return `${c.label} ${c.code} ${c.category ?? ""}`.toLowerCase().includes(chargeCodeSearchTerm);
  });
  // The spreadsheet's rows: every pinned Charge Code, plus any code that already has a rule
  // even if it isn't (or is no longer) pinned, so an existing rule is never hidden.
  const tableCodes = chargeCodes.filter((c) => c.is_pinned || accountRules.some((r) => r.charge_code_id === c.id));

  // Totals sum ALL rows in the table, ticked or not, since assumed values are often typed to
  // test before "ใช้กฎ" is enabled (or before a rule even exists) — a row with no formula just
  // passes its own assumed value through unchanged (see handleCalculateAll).
  const totalSimValue = tableCodes.reduce((sum, code) => sum + (Number(simValues[code.code]) || 0), 0);
  const totalSimResult = tableCodes.reduce((sum, code) => {
    const result = simResults[code.code];
    return result != null ? sum + result : sum;
  }, 0);
  const hasAnyResult = tableCodes.some((code) => simResults[code.code] != null);

  return (
    <div>
      <PageHeader
        title="Mark-up Settings"
        description="เลือก Agent Account แล้วเข้าไปกำหนด Markup ต่อรายการค่าธรรมเนียม (Charge Code) ของบัญชีนั้น"
      />

      {loading ? (
        <PageLoading label="Loading Agent Accounts..." />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-600">Agent (Carrier)</span>
              <select
                value={filterAgentId}
                onChange={(e) => setFilterAgentId(e.target.value ? Number(e.target.value) : "")}
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
            <label className="flex flex-1 min-w-[200px] flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-600">Search</span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Account username, agent name..."
                className={inputClass}
              />
            </label>
          </div>

          {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-gradient-to-r from-brand-navy-dark to-brand-navy text-xs uppercase text-white/90">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Agent</th>
                  <th className="px-5 py-2.5 font-medium">Account</th>
                  <th className="px-5 py-2.5 font-medium">Markup Rules</th>
                  <th className="px-5 py-2.5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-6 text-center text-sm text-slate-400">
                      No agent accounts yet.
                    </td>
                  </tr>
                ) : (
                  visibleAccounts.map((account) => {
                    const counts = ruleCountFor(account.id);
                    return (
                      <tr key={account.id} className="border-b border-slate-200 last:border-0">
                        <td className="px-5 py-3 text-slate-500">{account.agent?.agent_name ?? "-"}</td>
                        <td className="px-5 py-3 font-medium text-slate-700">{account.username_acc}</td>
                        <td className="px-5 py-3 text-slate-500">
                          {counts.total === 0 ? (
                            <span className="text-slate-300">ยังไม่มีกฎ</span>
                          ) : (
                            <>
                              {counts.active} Active / {counts.total} Total
                            </>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => openAccountModal(account)}
                            className="rounded-lg bg-brand-navy-dark px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-navy-dark/90"
                          >
                            Manage Rules
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {modalAccount && (
            <Modal
              title={`Markup Rules — ${modalAccount.username_acc} (${modalAccount.agent?.agent_name ?? ""})`}
              onClose={() => setModalAccount(null)}
              maxWidthClassName="max-w-3xl"
            >
              <div className="flex flex-col gap-3">
                {accountRulesLoading ? (
                  <p className="text-sm text-slate-400">Loading...</p>
                ) : (
                  <>
                    <div className="overflow-hidden rounded-lg border border-slate-200">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                          <tr>
                            <th className="px-3 py-2 font-medium">Charge Code</th>
                            <th className="px-3 py-2 text-center font-medium">ใช้กฎ</th>
                            <th className="px-3 py-2 font-medium">กฎ</th>
                            <th className="px-3 py-2 font-medium">ค่าสมมติ</th>
                            <th className="px-3 py-2 font-medium">คำนวณได้</th>
                            <th className="px-3 py-2 font-medium text-right"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {tableCodes.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="px-3 py-6 text-center text-xs text-slate-400">
                                ยังไม่มี Charge Code ที่ปักหมุดหรือมีกฎ — ค้นหาด้านล่างเพื่อปักหมุดเพิ่ม
                              </td>
                            </tr>
                          ) : (
                            tableCodes.map((code) => {
                              const rule = accountRules.find((r) => r.charge_code_id === code.id);
                              return (
                                <tr key={code.id} className="border-t border-slate-200 align-top">
                                  <td className="px-3 py-2 text-slate-700">
                                    {code.label}
                                    {code.is_custom && (
                                      <span className="ml-1.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-600">
                                        Custom
                                      </span>
                                    )}
                                    <div className="text-xs text-slate-400">{code.code}</div>
                                  </td>
                                  <td className="px-3 py-2 text-center">
                                    <input
                                      type="checkbox"
                                      checked={rule?.status ?? false}
                                      disabled={!rule}
                                      onChange={() => handleToggleRuleStatus(code)}
                                      className="h-3.5 w-3.5 rounded border-slate-300 text-brand-navy-dark focus:ring-brand-navy/30 disabled:opacity-30"
                                    />
                                  </td>
                                  <td className="px-3 py-2">
                                    <div className="relative">
                                      <input
                                        type="text"
                                        ref={(el) => {
                                          ruleInputRefs.current[code.id] = el;
                                        }}
                                        value={ruleInputs[code.id] ?? ""}
                                        onChange={(e) =>
                                          setRuleInputs((prev) => ({ ...prev, [code.id]: e.target.value }))
                                        }
                                        onFocus={() => setFormulaDropdownCodeId(code.id)}
                                        onBlur={() => {
                                          handleRuleSave(code);
                                          setTimeout(
                                            () => setFormulaDropdownCodeId((cur) => (cur === code.id ? null : cur)),
                                            150,
                                          );
                                        }}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                                          if (e.key === "Escape") setFormulaDropdownCodeId(null);
                                        }}
                                        placeholder='7% / 50 / ={BASE}+{FF}'
                                        className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 font-mono text-xs outline-none focus:border-brand-navy focus:ring-1 focus:ring-brand-navy/20"
                                      />
                                      {formulaDropdownCodeId === code.id &&
                                        (() => {
                                          const pos = ruleDropdownPosition(code.id);
                                          if (!pos) return null;
                                          const suggestions = ruleFormulaSuggestions(code);
                                          return createPortal(
                                            <div
                                              style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width }}
                                              className="z-50 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg"
                                            >
                                              {suggestions.length === 0 ? (
                                                <p className="px-2 py-1.5 text-[11px] text-slate-400">
                                                  No matching charge codes
                                                </p>
                                              ) : (
                                                suggestions.map((c) => (
                                                  <button
                                                    type="button"
                                                    key={c.id}
                                                    onMouseDown={(e) => e.preventDefault()}
                                                    onClick={() => insertCodeIntoRule(code, c)}
                                                    className="flex w-full items-center justify-between gap-2 border-b border-slate-50 px-2 py-1.5 text-left text-[11px] last:border-0 hover:bg-slate-50"
                                                  >
                                                    <span className="truncate font-medium text-slate-700">{c.label}</span>
                                                    <span className="shrink-0 font-mono text-slate-400">{`{${c.code}}`}</span>
                                                  </button>
                                                ))
                                              )}
                                            </div>,
                                            document.body,
                                          );
                                        })()}
                                    </div>
                                    {ruleSaving[code.id] && <p className="text-[10px] text-slate-400">saving...</p>}
                                    {ruleErrors[code.id] && <p className="text-[10px] text-red-600">{ruleErrors[code.id]}</p>}
                                    {rule?.rule_type === "FORMULA" && rule.formula && (
                                      <p className="text-[10px] text-slate-400">= {describeFormula(rule.formula)}</p>
                                    )}
                                  </td>
                                  <td className="px-3 py-2">
                                    <input
                                      type="number"
                                      value={simValues[code.code] ?? ""}
                                      onChange={(e) =>
                                        setSimValues((prev) => ({ ...prev, [code.code]: e.target.value }))
                                      }
                                      placeholder="0"
                                      className="w-24 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs outline-none focus:border-brand-navy focus:ring-1 focus:ring-brand-navy/20"
                                    />
                                  </td>
                                  <td className="px-3 py-2 text-xs">
                                    {simErrors[code.code] ? (
                                      <span className="text-red-600">{simErrors[code.code]}</span>
                                    ) : simResults[code.code] != null ? (
                                      <span className="font-semibold text-emerald-600">
                                        {simResults[code.code]!.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                      </span>
                                    ) : (
                                      <span className="text-slate-300">-</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveRow(code)}
                                      className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                                      aria-label="Remove"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                        {tableCodes.length > 0 && (
                          <tfoot>
                            <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                              <td className="px-3 py-2 text-slate-700" colSpan={3}>
                                Total
                              </td>
                              <td className="px-3 py-2 text-xs text-slate-700">
                                {totalSimValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                              </td>
                              <td className="px-3 py-2 text-xs">
                                {hasAnyResult ? (
                                  <span className="font-semibold text-emerald-700">
                                    {totalSimResult.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                  </span>
                                ) : (
                                  <span className="text-slate-300">-</span>
                                )}
                              </td>
                              <td className="px-3 py-2"></td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-slate-400">
                        พิมพ์ในช่อง &quot;กฎ&quot;: ตัวเลขธรรมดา = THB คงที่ / ลงท้ายด้วย % = เปอร์เซ็นต์ / ขึ้นต้นด้วย ={" "}
                        = สูตร เช่น ={"{BASE}"}+{"{FF}"}*7% — พิมพ์ชื่อ/รหัส Charge Code แล้วเลือกจากรายการที่ขึ้นมาเพื่อแทรก{" "}
                        เว้นว่างแล้วออกจากช่อง = ลบกฎ
                      </p>
                      <button
                        type="button"
                        onClick={handleCalculateAll}
                        disabled={simCalculating || tableCodes.length === 0}
                        className="rounded-lg bg-brand-navy-dark px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-navy-dark/90 disabled:opacity-60"
                      >
                        {simCalculating ? "กำลังคำนวณ..." : "คำนวณผลลัพธ์ทั้งหมด"}
                      </button>
                    </div>

                    <div className="flex flex-col gap-1.5 rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <span className="text-xs font-medium text-slate-600">ปักหมุด Charge Code เพิ่ม</span>
                      <div className="relative">
                        <input
                          type="text"
                          value={chargeCodeQuery}
                          onFocus={() => setChargeCodeDropdownOpen(true)}
                          onChange={(e) => {
                            setChargeCodeQuery(e.target.value);
                            setChargeCodeDropdownOpen(true);
                          }}
                          onBlur={() => setTimeout(() => setChargeCodeDropdownOpen(false), 150)}
                          placeholder="ค้นหา Charge Code เพื่อปักหมุด..."
                          className={`${inputClass} w-full bg-white`}
                        />
                        {chargeCodeDropdownOpen && (
                          <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                            {filteredChargeCodes.length === 0 ? (
                              <div className="px-3 py-2">
                                <p className="text-xs text-slate-400">No matching charge codes</p>
                                <button
                                  type="button"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => {
                                    setNewCodeValue(chargeCodeQuery.trim());
                                    setShowNewChargeCode(true);
                                    setChargeCodeDropdownOpen(false);
                                  }}
                                  className="mt-1 text-xs font-medium text-amber-600 hover:underline"
                                >
                                  + เพิ่ม Charge Code ใหม่{chargeCodeQuery.trim() ? ` "${chargeCodeQuery.trim()}"` : ""}
                                </button>
                              </div>
                            ) : (
                              filteredChargeCodes.map((c) => (
                                <button
                                  type="button"
                                  key={c.id}
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => toggleChargeCodePin(c)}
                                  className="flex w-full items-center justify-between border-b border-slate-50 px-3 py-2 text-left text-xs last:border-0 hover:bg-slate-50"
                                >
                                  <span>
                                    <span className="font-medium text-slate-700">{c.label}</span>{" "}
                                    <span className="text-slate-400">
                                      ({c.code}
                                      {c.category ? `, ${c.category}` : ""})
                                    </span>
                                  </span>
                                  {c.is_pinned ? (
                                    <Pin className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                                  ) : (
                                    <PinOff className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                                  )}
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>

                      {!showNewChargeCode ? (
                        <button
                          type="button"
                          onClick={() => setShowNewChargeCode(true)}
                          className="self-start text-xs font-medium text-amber-600 hover:underline"
                        >
                          + Charge code ไม่มีในระบบ? เพิ่มเอง
                        </button>
                      ) : (
                        <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3">
                          <p className="text-xs text-slate-400">
                            Adds a new charge code for provider &quot;{modalAccount.agent?.agent_code}&quot;.
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
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setShowNewChargeCode(false)}
                              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                            >
                              ยกเลิก
                            </button>
                            <button
                              type="button"
                              onClick={handleCreateChargeCode}
                              disabled={creatingCode || !newCodeValue || !newCodeLabel}
                              className="rounded-lg bg-brand-navy-dark px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-navy-dark/90 disabled:opacity-60"
                            >
                              {creatingCode ? "Creating..." : "Create & Pin"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}

                <div className="mt-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setModalAccount(null)}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Close
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





