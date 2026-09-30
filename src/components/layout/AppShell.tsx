"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import RateChatWidget from "@/components/ai/RateChatWidget";
import { useAccess } from "@/components/auth/AccessProvider";
import { canVisit } from "@/lib/access";
import { NAV_SECTIONS } from "@/lib/nav";

export default function AppShell({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const { access, can } = useAccess();
  const allowed = canVisit(access, pathname);

  return (
    <div className="flex min-h-screen bg-zinc-50">
      <Sidebar open={sidebarOpen} onNavigate={() => setSidebarOpen(false)} />

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}

      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar onMenuClick={() => setSidebarOpen((v) => !v)} />
        <main className="relative flex-1 p-4 sm:p-6">{allowed ? children : <NoAccess />}</main>
      </div>

      {can("ai.rate_chat") && <RateChatWidget />}
    </div>
  );
}

function NoAccess() {
  const { access } = useAccess();
  // Send the user somewhere they CAN go (e.g. right after login lands on /shipment/list for a
  // role without shipment.view).
  const firstAllowedHref = useMemo(() => {
    for (const section of NAV_SECTIONS) {
      for (const href of section.children ? section.children.map((c) => c.href) : [section.href!]) {
        if (canVisit(access, href)) return href;
      }
    }
    return "/profile";
  }, [access]);

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white py-20 text-center">
      <ShieldAlert className="h-10 w-10 text-brand-amber" />
      <p className="font-medium text-slate-600">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</p>
      <p className="text-sm text-slate-400">หากต้องการใช้งาน กรุณาติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์</p>
      <Link
        href={firstAllowedHref}
        className="mt-2 rounded-lg bg-brand-navy-dark px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navy-dark/90"
      >
        ไปหน้าที่ใช้งานได้
      </Link>
    </div>
  );
}
