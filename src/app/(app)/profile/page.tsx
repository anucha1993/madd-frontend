"use client";

import { useEffect, useState } from "react";
import { User } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import { getUser, type AuthUser } from "@/lib/auth";

export default function ProfilePage() {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    setUser(getUser());
  }, []);

  return (
    <div>
      <PageHeader title="โปรไฟล์ของฉัน" description="ข้อมูลบัญชีผู้ใช้งาน" />
      <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-navy text-white">
            <User className="h-6 w-6" />
          </span>
          <div>
            <p className="font-semibold text-slate-800">{user?.name ?? "-"}</p>
            <p className="text-sm text-slate-500">@{user?.username ?? "-"}</p>
          </div>
        </div>
        <dl className="mt-6 space-y-3 text-sm">
          <div className="flex justify-between border-b border-slate-100 pb-2">
            <dt className="text-slate-500">อีเมล</dt>
            <dd className="text-slate-700">{user?.email ?? "-"}</dd>
          </div>
          <div className="flex justify-between pb-2">
            <dt className="text-slate-500">รหัสผู้ใช้</dt>
            <dd className="text-slate-700">{user?.id ?? "-"}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
