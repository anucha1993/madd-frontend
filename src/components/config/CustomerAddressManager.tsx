"use client";

import { useEffect, useState } from "react";
import { MapPinned, PackageOpen, Pencil, Plus, Star, Trash2, User } from "lucide-react";
import Modal from "@/components/ui/Modal";
import CustomerAddressForm from "@/components/config/CustomerAddressForm";
import {
  createCustomerAddress,
  deleteCustomerAddress,
  listCustomerAddresses,
  updateCustomerAddress,
  type Customer,
  type CustomerAddress,
} from "@/lib/customers";

type Props = {
  customer: Customer;
  onClose: () => void;
};

// Full detail row for one saved address — mirrors every field on the Create Shipment
// Ship From/Ship To form (contact, company, tax id, phone, email, full address, notes).
function AddressCard({ addr, onEdit, onDelete }: { addr: CustomerAddress; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="text-sm">
        <div className="flex items-center gap-1.5 font-medium text-slate-700">
          {addr.is_default && <Star className="h-3.5 w-3.5 fill-brand-amber text-brand-amber" />}
          {addr.label || addr.contact_name}
          {addr.type === "both" && (
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-500">Ship From/To</span>
          )}
        </div>
        <p className="text-xs text-slate-500">
          {addr.contact_name}
          {addr.company_name ? ` · ${addr.company_name}` : ""}
          {addr.tax_id ? ` · Tax ID: ${addr.tax_id}` : ""}
        </p>
        <p className="text-xs text-slate-500">{[addr.phone, addr.email].filter(Boolean).join(" · ") || "-"}</p>
        <p className="text-xs text-slate-400">
          {[addr.address1, addr.address2, addr.address3, addr.city, addr.postcode, addr.country].filter(Boolean).join(", ") || "-"}
        </p>
        {addr.notes && <p className="text-xs italic text-slate-400">หมายเหตุ: {addr.notes}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button type="button" onClick={onEdit} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200" aria-label="แก้ไข">
          <Pencil className="h-4 w-4" />
        </button>
        <button type="button" onClick={onDelete} className="rounded-lg p-1.5 text-red-500 hover:bg-red-50" aria-label="ลบ">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default function CustomerAddressManager({ customer, onClose }: Props) {
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // "new-ship_from" / "new-ship_to" distinguishes which section's "+ เพิ่มที่อยู่" was clicked,
  // so the new address defaults to the right type instead of always "both".
  const [editing, setEditing] = useState<CustomerAddress | "new-ship_from" | "new-ship_to" | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      setAddresses(await listCustomerAddresses(customer.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดที่อยู่ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer.id]);

  async function handleDelete(address: CustomerAddress) {
    if (!confirm(`ยืนยันลบที่อยู่ "${address.label || address.contact_name}" ?`)) return;
    await deleteCustomerAddress(address.id);
    await load();
  }

  const shipFromAddresses = addresses.filter((a) => a.type === "ship_from" || a.type === "both");
  const shipToAddresses = addresses.filter((a) => a.type === "ship_to" || a.type === "both");
  const isNew = editing === "new-ship_from" || editing === "new-ship_to";

  function renderSection(sectionType: "ship_from" | "ship_to", title: string, list: CustomerAddress[]) {
    const newKey = sectionType === "ship_from" ? "new-ship_from" : "new-ship_to";
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-600">
            {sectionType === "ship_from" ? <PackageOpen className="h-4 w-4" /> : <MapPinned className="h-4 w-4" />}
            {title}
          </h3>
          {editing !== newKey && (
            <button
              type="button"
              onClick={() => setEditing(newKey)}
              className="flex items-center gap-1 text-xs font-medium text-amber-600 hover:underline"
            >
              <Plus className="h-3.5 w-3.5" /> เพิ่มที่อยู่ {title}
            </button>
          )}
        </div>
        {list.length === 0 ? (
          <p className="text-sm text-slate-400">ยังไม่มีที่อยู่ {title} ที่บันทึกไว้</p>
        ) : (
          <div className="flex flex-col gap-2">
            {list.map((addr) => (
              <AddressCard key={addr.id} addr={addr} onEdit={() => setEditing(addr)} onDelete={() => handleDelete(addr)} />
            ))}
          </div>
        )}
        {editing === newKey && (
          <div className="rounded-lg border border-slate-200 p-3">
            <CustomerAddressForm
              defaultType={sectionType}
              onCancel={() => setEditing(null)}
              onSubmit={async (data) => {
                await createCustomerAddress(customer.id, data);
                setEditing(null);
                await load();
              }}
            />
          </div>
        )}
      </div>
    );
  }

  // The "customer info" summary is NOT its own editable record — it's just a read-only
  // preview pulled from the first saved address, since that address already holds the same
  // contact/company/tax/phone/email fields. Edit that address directly to change it.
  const primaryAddress = addresses[0] ?? null;

  return (
    <Modal title={`จัดการลูกค้า — ${customer.name}`} onClose={onClose} maxWidthClassName="max-w-4xl">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <User className="h-3.5 w-3.5" /> ข้อมูลลูกค้า (จากที่อยู่แรกที่บันทึกไว้)
          </h3>
          {primaryAddress ? (
            <div className="text-sm text-slate-600">
              <p className="font-medium text-slate-700">
                {primaryAddress.contact_name}
                {primaryAddress.company_name ? ` · ${primaryAddress.company_name}` : ""}
              </p>
              <p className="text-xs text-slate-500">
                {[primaryAddress.tax_id ? `Tax ID: ${primaryAddress.tax_id}` : null, primaryAddress.phone, primaryAddress.email]
                  .filter(Boolean)
                  .join(" · ") || "-"}
              </p>
              <p className="mt-1 text-xs text-slate-400">แก้ไขได้จากที่อยู่ด้านล่าง ({primaryAddress.label || primaryAddress.contact_name})</p>
            </div>
          ) : (
            <p className="text-sm text-slate-400">ยังไม่มีที่อยู่ที่บันทึกไว้ — เพิ่มที่อยู่ด้านล่างเพื่อดูข้อมูลลูกค้า</p>
          )}
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        {loading ? (
          <p className="text-sm text-slate-400">กำลังโหลด...</p>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {renderSection("ship_from", "Ship From", shipFromAddresses)}
            {renderSection("ship_to", "Ship To", shipToAddresses)}
          </div>
        )}

        {editing && !isNew && (
          <div className="rounded-lg border border-slate-200 p-3">
            <CustomerAddressForm
              initial={editing as CustomerAddress}
              onCancel={() => setEditing(null)}
              onSubmit={async (data) => {
                await updateCustomerAddress((editing as CustomerAddress).id, data);
                setEditing(null);
                await load();
              }}
            />
          </div>
        )}
      </div>
    </Modal>
  );
}

