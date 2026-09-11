"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, Menu, User } from "lucide-react";
import { getUser, removeAuth } from "@/lib/auth";

type Props = {
  onMenuClick: () => void;
};

export default function Topbar({ onMenuClick }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setName(getUser()?.name ?? "");
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleLogout() {
    removeAuth();
    router.replace("/login");
  }

  return (
    <header className="flex h-20 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
      <button
        type="button"
        onClick={onMenuClick}
        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
        aria-label="เปิดเมนู"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="hidden lg:block" />

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-navy text-white">
            <User className="h-4.5 w-4.5" />
          </span>
          <span className="hidden text-sm font-medium text-slate-700 sm:inline">{name}</span>
          <ChevronDown className="h-4 w-4 text-slate-400" />
        </button>

        {open && (
          <div className="absolute right-0 mt-2 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
            <a href="/profile" className="block px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50">
              โปรไฟล์ของฉัน
            </a>
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-2 border-t border-slate-100 px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" />
              ออกจากระบบ
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
