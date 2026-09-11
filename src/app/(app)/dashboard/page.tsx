"use client";

import { useEffect, useState } from "react";
import { PackageCheck, PackagePlus, Truck, Wallet } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import { getUser } from "@/lib/auth";

const KPI_CARDS = [
  { label: "พัสดุวันนี้", value: "24", icon: PackagePlus, color: "text-blue-600 bg-blue-50" },
  { label: "อยู่ระหว่างจัดส่ง", value: "58", icon: Truck, color: "text-amber-600 bg-amber-50" },
  { label: "จัดส่งสำเร็จ (เดือนนี้)", value: "312", icon: PackageCheck, color: "text-emerald-600 bg-emerald-50" },
  { label: "ยอดขนส่ง (เดือนนี้)", value: "฿186,420", icon: Wallet, color: "text-brand-navy bg-slate-100" },
];

export default function DashboardPage() {
  const [name, setName] = useState("");

  useEffect(() => {
    setName(getUser()?.name ?? "");
  }, []);

  return (
    <div>
      <PageHeader title={`สวัสดี, ${name || "ผู้ใช้งาน"} 👋`} description="ภาพรวมระบบจัดการงานขนส่ง MADD" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {KPI_CARDS.map((card) => (
          <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${card.color}`}>
              <card.icon className="h-5 w-5" />
            </div>
            <p className="mt-4 text-2xl font-bold text-slate-800">{card.value}</p>
            <p className="text-sm text-slate-500">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-400">
        กราฟสรุปยอดขนส่งรายวัน/รายเดือน (Mockup) — จะเพิ่มในเวอร์ชันถัดไป
      </div>
    </div>
  );
}
