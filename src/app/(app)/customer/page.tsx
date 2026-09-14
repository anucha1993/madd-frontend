"use client";

import { useEffect, useState } from "react";
import { MapPin, Pencil, Plus, Trash2, Users } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import Modal from "@/components/ui/Modal";
import PageLoading from "@/components/ui/PageLoading";
import CustomerForm from "@/components/config/CustomerForm";
import CustomerAddressManager from "@/components/config/CustomerAddressManager";
import {
  createCustomer,
  deleteCustomer,
  listCustomers,
  type Customer,
  type CustomerInput,
} from "@/lib/customers";

export default function CustomerPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  // "new" opens the plain create-customer form (no addresses to manage yet); an existing
  // Customer opens the unified detail modal (customer info + Ship From/Ship To together).
  const [modalCustomer, setModalCustomer] = useState<Customer | "new" | null>(null);

  async function loadAll(searchTerm?: string) {
    setLoading(true);
    setError("");
    try {
      setCustomers(await listCustomers(searchTerm));
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => loadAll(search.trim() || undefined), 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // Only used for creating a brand-new customer — editing an existing one happens inline
  // inside the unified detail modal (CustomerAddressManager), which has its own save.
  async function handleCreate(data: CustomerInput) {
    await createCustomer(data);
    setModalCustomer(null);
    await loadAll(search.trim() || undefined);
  }

  async function handleDelete(customer: Customer) {
    if (!confirm(`ยืนยันลบลูกค้า "${customer.name}" ?`)) return;
    await deleteCustomer(customer.id);
    await loadAll(search.trim() || undefined);
  }

  return (
    <div className="relative min-h-[360px]">
      <div className="mb-6 flex items-start justify-between gap-4">
        <PageHeader title="ลูกค้า" description="จัดการข้อมูลลูกค้าและที่อยู่ Ship From/Ship To ที่บันทึกไว้ใช้ซ้ำ" />
        <button
          type="button"
          onClick={() => setModalCustomer("new")}
          className="flex shrink-0 items-center gap-2 rounded-lg bg-brand-navy-dark px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navy-dark/90"
        >
          <Plus className="h-4 w-4" />
          เพิ่มลูกค้า
        </button>
      </div>

      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ค้นหาชื่อ / บริษัท / เบอร์โทร / เลขภาษี..."
          className="w-full max-w-sm rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15"
        />
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {loading ? (
        <PageLoading label="กำลังโหลดข้อมูลลูกค้า..." />
      ) : customers.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white py-20 text-center">
          <Users className="h-10 w-10 text-brand-amber" />
          <p className="font-medium text-slate-600">ยังไม่มีลูกค้าในระบบ</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gradient-to-r from-brand-navy-dark to-brand-navy text-xs uppercase text-white/90">
              <tr>
                <th className="px-5 py-2.5 font-medium">ชื่อลูกค้า / บริษัท</th>
                <th className="px-5 py-2.5 font-medium">เลขประจำตัวผู้เสียภาษี</th>
                <th className="px-5 py-2.5 font-medium">เบอร์โทร</th>
                <th className="px-5 py-2.5 font-medium">อีเมล</th>
                <th className="px-5 py-2.5 font-medium">ที่อยู่ที่บันทึกไว้</th>
                <th className="px-5 py-2.5 font-medium text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id} className="border-b border-slate-200 last:border-0">
                  <td className="px-5 py-3">
                    <div className="font-medium text-slate-700">{customer.name}</div>
                    <div className="text-xs text-slate-400">{customer.company_name || "-"}</div>
                  </td>
                  <td className="px-5 py-3 text-slate-500">{customer.tax_id || "-"}</td>
                  <td className="px-5 py-3 text-slate-500">{customer.phone || "-"}</td>
                  <td className="px-5 py-3 text-slate-500">{customer.email || "-"}</td>
                  <td className="px-5 py-3">
                    <button
                      type="button"
                      onClick={() => setModalCustomer(customer)}
                      className="flex items-center gap-1 rounded-full bg-brand-navy/5 px-2.5 py-0.5 text-xs font-medium text-brand-navy-dark hover:bg-brand-navy/10"
                    >
                      <MapPin className="h-3 w-3" />
                      {customer.addresses_count ?? 0} ที่อยู่
                    </button>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setModalCustomer(customer)}
                      className="mr-2 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                      aria-label="แก้ไข"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(customer)}
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

      {modalCustomer === "new" && (
        <Modal title="เพิ่มลูกค้า" onClose={() => setModalCustomer(null)}>
          <CustomerForm initial={null} onSubmit={handleCreate} onCancel={() => setModalCustomer(null)} />
        </Modal>
      )}

      {modalCustomer && modalCustomer !== "new" && (
        <CustomerAddressManager customer={modalCustomer} onClose={() => setModalCustomer(null)} />
      )}
    </div>
  );
}
