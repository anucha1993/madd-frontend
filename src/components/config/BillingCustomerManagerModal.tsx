"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import {
  createBillingCustomer,
  deleteBillingCustomer,
  listBillingCustomers,
  updateBillingCustomer,
  type BillingCustomer,
  type BillingCustomerInput,
} from "@/lib/billingCustomers";

type Props = {
  onClose: () => void;
  onSelect: (customer: BillingCustomer) => void;
};

const inputClass =
  "rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-brand-navy focus:bg-white focus:ring-2 focus:ring-brand-navy/15";
const labelClass = "text-xs font-medium uppercase tracking-wide text-slate-400";

const emptyForm: BillingCustomerInput = {
  name: "",
  tax_id: "",
  is_head_office: true,
  branch_no: "",
  address1: "",
  address2: "",
  city: "",
  postcode: "",
  country: "",
  phone: "",
  email: "",
};

// Lightweight in-place Tax Invoice Customer manager — lets staff add/edit/delete a
// BillingCustomer without leaving the Issue Receipt page (full standalone page with the same
// data is /billing/customers). Clicking a row selects it as the current Buyer and closes.
export default function BillingCustomerManagerModal({ onClose, onSelect }: Props) {
  const [customers, setCustomers] = useState<BillingCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<BillingCustomer | "new" | null>(null);
  const [form, setForm] = useState<BillingCustomerInput>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await listBillingCustomers({ q: search || undefined });
      setCustomers(res.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(load, 250);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function openForm(customer: BillingCustomer | "new") {
    setError("");
    setEditing(customer);
    setForm(
      customer === "new"
        ? emptyForm
        : {
            name: customer.name,
            tax_id: customer.tax_id ?? "",
            is_head_office: customer.is_head_office,
            branch_no: customer.branch_no ?? "",
            address1: customer.address1 ?? "",
            address2: customer.address2 ?? "",
            city: customer.city ?? "",
            postcode: customer.postcode ?? "",
            country: customer.country ?? "",
            phone: customer.phone ?? "",
            email: customer.email ?? "",
          },
    );
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setError("Please enter a name");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (editing && editing !== "new") {
        await updateBillingCustomer(editing.id, form);
      } else {
        await createBillingCustomer(form);
      }
      setEditing(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(customer: BillingCustomer) {
    if (!confirm(`Delete customer "${customer.name}"?`)) return;
    await deleteBillingCustomer(customer.id);
    await load();
  }

  return (
    <Modal title="Manage Tax Invoice Customers" onClose={onClose} maxWidthClassName="max-w-2xl">
      <div className="flex flex-col gap-3">
        {!editing && (
          <>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name / tax ID..."
                className={`${inputClass} flex-1`}
              />
              <button
                type="button"
                onClick={() => openForm("new")}
                className="flex shrink-0 items-center gap-1 rounded-lg bg-brand-navy-dark px-3 py-2 text-xs font-semibold text-white hover:bg-brand-navy-dark/90"
              >
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-200">
              {loading ? (
                <p className="px-3 py-4 text-center text-sm text-slate-400">Loading...</p>
              ) : customers.length === 0 ? (
                <p className="px-3 py-4 text-center text-sm text-slate-400">No customers found</p>
              ) : (
                customers.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 text-sm last:border-0 hover:bg-slate-50"
                  >
                    <button type="button" onClick={() => onSelect(c)} className="flex-1 text-left">
                      <div className="font-medium text-slate-700">{c.name}</div>
                      <div className="text-xs text-slate-400">{c.tax_id || "-"}</div>
                    </button>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openForm(c)}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200"
                        aria-label="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(c)}
                        className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                        aria-label="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {editing && (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className={labelClass}>Name</span>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className={labelClass}>Tax ID</span>
              <input
                type="text"
                value={form.tax_id ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, tax_id: e.target.value }))}
                className={inputClass}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-4 text-sm text-slate-600">
                <label className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="modal-office-scope"
                    checked={form.is_head_office ?? true}
                    onChange={() => setForm((f) => ({ ...f, is_head_office: true }))}
                    className="h-4 w-4 accent-brand-amber"
                  />
                  Head Office
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="modal-office-scope"
                    checked={!(form.is_head_office ?? true)}
                    onChange={() => setForm((f) => ({ ...f, is_head_office: false }))}
                    className="h-4 w-4 accent-brand-amber"
                  />
                  Branch
                </label>
              </div>
              {!form.is_head_office && (
                <label className="flex flex-col gap-1">
                  <span className={labelClass}>Branch No.</span>
                  <input
                    type="text"
                    value={form.branch_no ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, branch_no: e.target.value }))}
                    className={inputClass}
                  />
                </label>
              )}
            </div>
            <label className="flex flex-col gap-1">
              <span className={labelClass}>Address</span>
              <textarea
                value={form.address1 ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, address1: e.target.value }))}
                className={`${inputClass} min-h-[64px] resize-y`}
                placeholder="Address line 1"
                rows={2}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                value={form.city ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                className={inputClass}
                placeholder="City"
              />
              <input
                type="text"
                value={form.postcode ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, postcode: e.target.value }))}
                className={inputClass}
                placeholder="Postal code"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                value={form.phone ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className={inputClass}
                placeholder="Phone"
              />
              <input
                type="text"
                value={form.email ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className={inputClass}
                placeholder="Email"
              />
            </div>

            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

            <div className="mt-1 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-brand-navy-dark px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navy-dark/90 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
