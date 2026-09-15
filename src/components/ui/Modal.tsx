"use client";

import { type ReactNode } from "react";
import { X } from "lucide-react";

type Props = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  // Tailwind max-width class for the modal card — defaults to the compact size used by simple
  // forms (Branch/Customer edit); pass a wider one (e.g. "max-w-3xl") for content-heavy modals.
  maxWidthClassName?: string;
  // Tailwind max-height class for the scrollable body — defaults to 75vh; pass a taller value
  // (e.g. "max-h-[92vh]") for content-heavy modals that should avoid scrolling where possible.
  bodyMaxHeightClassName?: string;
};

export default function Modal({
  title,
  onClose,
  children,
  maxWidthClassName = "max-w-lg",
  bodyMaxHeightClassName = "max-h-[75vh]",
}: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
      <div className={`w-full ${maxWidthClassName} overflow-hidden rounded-2xl border border-black/10 bg-white shadow-2xl`}>
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
        <div className={`${bodyMaxHeightClassName} overflow-y-auto bg-white px-6 py-5`}>{children}</div>
      </div>
    </div>
  );
}
