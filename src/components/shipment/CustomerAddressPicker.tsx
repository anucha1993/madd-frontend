"use client";

import { useEffect, useRef, useState } from "react";
import { Search, User } from "lucide-react";
import { searchCustomerAddresses, type CustomerAddressType, type CustomerAddressWithCustomer } from "@/lib/customers";

type Props = {
  type: CustomerAddressType;
  onSelect: (address: CustomerAddressWithCustomer) => void;
};

// Search-as-you-type combobox over saved customer addresses (GET /customer-addresses) — lets
// staff reuse a previously saved Ship From/Ship To instead of retyping it every shipment.
export default function CustomerAddressPicker({ type, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CustomerAddressWithCustomer[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const handle = setTimeout(() => {
      searchCustomerAddresses(query.trim(), type)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(handle);
  }, [query, type, open]);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          placeholder="ค้นหาลูกค้าที่บันทึกไว้ (ชื่อ / เบอร์โทร / เลขภาษี)"
          className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-xs outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15"
        />
      </div>
      {open && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {loading ? (
            <p className="px-3 py-2 text-xs text-slate-400">กำลังค้นหา...</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 text-xs text-slate-400">ไม่พบที่อยู่ที่บันทึกไว้</p>
          ) : (
            results.map((addr) => (
              <button
                type="button"
                key={addr.id}
                onClick={() => {
                  onSelect(addr);
                  setOpen(false);
                  setQuery("");
                }}
                className="flex w-full flex-col items-start gap-0.5 border-b border-slate-50 px-3 py-2 text-left text-xs last:border-0 hover:bg-slate-50"
              >
                <span className="flex items-center gap-1.5 font-medium text-slate-700">
                  <User className="h-3 w-3 text-slate-300" />
                  {addr.contact_name}
                  {addr.label && <span className="text-slate-400">({addr.label})</span>}
                  {addr.customer?.name && addr.customer.name !== addr.contact_name && (
                    <span className="text-slate-400">— {addr.customer.name}</span>
                  )}
                </span>
                <span className="text-slate-400">
                  {[addr.address1, addr.city, addr.postcode].filter(Boolean).join(", ") || "-"}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
