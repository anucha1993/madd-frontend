"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2, Users } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import Modal from "@/components/ui/Modal";
import PageLoading from "@/components/ui/PageLoading";
import {
  createBillingCustomer,
  deleteBillingCustomer,
  listBillingCustomers,
  updateBillingCustomer,
  type BillingCustomer,
  type BillingCustomerInput,
} from "@/lib/billingCustomers";

const inputClass =
  "rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-brand-navy focus:bg-white focus:ring-2 focus:ring-brand-navy/15";
const labelClass = "text-sm font-medium text-slate-600";

const emptyForm: BillingCustomerInput = {
  name: "",
  tax_id: "",
  is_head_office: true,
  branch_no: "",
  address1: "",
  address2: "",
  address3: "",
  city: "",
  postcode: "",
  country: "",
  phone: "",
  email: "",
};

export default function BillingCustomersPage() {
  const [customers, setCustomers] = useState<BillingCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const [modalCustomer, setModalCustomer] = useState<BillingCustomer | "new" | null>(null);
  const [form, setForm] = useState<BillingCustomerInput>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await listBillingCustomers({ q: search || undefined });
      setCustomers(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load customers");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function openModal(customer: BillingCustomer | "new") {
    setModalCustomer(customer);
    setFormError("");
    setForm(
      customer === "new"
        ? emptyForm
        : {
            customer_id: customer.customer_id,
            name: customer.name,
            tax_id: customer.tax_id ?? "",
            is_head_office: customer.is_head_office,
            branch_no: customer.branch_no ?? "",
            address1: customer.address1 ?? "",
            address2: customer.address2 ?? "",
            address3: customer.address3 ?? "",
            city: customer.city ?? "",
            state_code: customer.state_code ?? "",
            postcode: customer.postcode ?? "",
            country: customer.country ?? "",
            phone: customer.phone ?? "",
            email: customer.email ?? "",
            notes: customer.notes ?? "",
          },
    );
  }

  async function handleSubmit() {
    if (!form.name.trim()) {
      setFormError("Please enter the customer/company name");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      if (modalCustomer && modalCustomer !== "new") {
        await updateBillingCustomer(modalCustomer.id, form);
      } else {
        await createBillingCustomer(form);
      }
      setModalCustomer(null);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save");
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
    <div>
      <div className="mb-6 flex items-start justify-between">
        <PageHeader
          title="Tax Invoice Customers"
          description="Buyer database (separate from Ship To) used when issuing Tax Invoices"
        />
        <button
          type="button"
          onClick={() => openModal("new")}
          className="flex items-center gap-2 rounded-lg bg-brand-navy-dark px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navy-dark/90"
        >
          <Plus className="h-4 w-4" />
          Add Customer
        </button>
      </div>

      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name / tax ID..."
          className={`${inputClass} w-full max-w-sm`}
        />
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {loading ? (
        <PageLoading label="Loading..." />
      ) : customers.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white py-20 text-center">
          <Users className="h-10 w-10 text-brand-amber" />
          <p className="font-medium text-slate-600">No customers yet</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gradient-to-r from-brand-navy-dark to-brand-navy text-xs uppercase text-white/90">
              <tr>
                <th className="px-5 py-2.5 font-medium">Name</th>
                <th className="px-5 py-2.5 font-medium">Tax ID</th>
                <th className="px-5 py-2.5 font-medium">Branch</th>
                <th className="px-5 py-2.5 font-medium">Address</th>
                <th className="px-5 py-2.5 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-b border-slate-200 last:border-0">
                  <td className="px-5 py-3 font-medium text-slate-700">{c.name}</td>
                  <td className="px-5 py-3 text-slate-500">{c.tax_id ?? "-"}</td>
                  <td className="px-5 py-3 text-slate-500">
                    {c.is_head_office ? "Head Office" : `Branch ${c.branch_no ?? "-"}`}
                  </td>
                  <td className="px-5 py-3 max-w-[280px] truncate text-slate-500">
                    {[c.address1, c.address2, c.city, c.postcode].filter(Boolean).join(", ") || "-"}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => openModal(c)}
                      className="mr-2 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalCustomer && (
        <Modal
          title={modalCustomer === "new" ? "Add Customer" : `Edit ${modalCustomer.name}`}
          onClose={() => setModalCustomer(null)}
        >
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Company / Individual Name</span>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Tax ID</span>
              <input
                type="text"
                value={form.tax_id ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, tax_id: e.target.value }))}
                className={inputClass}
              />
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={form.is_head_office ?? true}
                  onChange={(e) => setForm((f) => ({ ...f, is_head_office: e.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300 accent-brand-amber"
                />
                Head Office
              </label>
              {!form.is_head_office && (
                <label className="flex flex-col gap-1.5">
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
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Address Line 1</span>
              <input
                type="text"
                value={form.address1 ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, address1: e.target.value }))}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Address Line 2</span>
              <input
                type="text"
                value={form.address2 ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, address2: e.target.value }))}
                className={inputClass}
              />
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>City / Province</span>
                <input
                  type="text"
                  value={form.city ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>Postal Code</span>
                <input
                  type="text"
                  value={form.postcode ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, postcode: e.target.value }))}
                  className={inputClass}
                />
              </label>
            </div>
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Country</span>
              <input
                type="text"
                value={form.country ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                className={inputClass}
              />
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>Phone</span>
                <input
                  type="text"
                  value={form.phone ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>Email</span>
                <input
                  type="text"
                  value={form.email ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className={inputClass}
                />
              </label>
            </div>

            {formError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{formError}</p>}

            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalCustomer(null)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className="rounded-lg bg-brand-navy-dark px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-navy-dark/90 disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
