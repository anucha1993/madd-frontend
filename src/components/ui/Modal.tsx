"use client";

import { type ReactNode } from "react";
import { X } from "lucide-react";

type Props = {
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export default function Modal({ title, onClose, children }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-black/10 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-black/5 bg-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิด"
            className="flex h-4 w-4 items-center justify-center rounded-full bg-[#ff5f57] ring-1 ring-black/10 transition hover:brightness-90"
          >
            <X className="h-3 w-3 text-[#4d0000]" strokeWidth={3.5} />
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto bg-white px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
