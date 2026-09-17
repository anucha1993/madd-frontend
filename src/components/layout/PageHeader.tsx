import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Construction } from "lucide-react";

export default function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function ComingSoonCard({ icon: Icon = Construction }: { icon?: LucideIcon }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white py-20 text-center">
      <Icon className="h-10 w-10 text-brand-amber" />
      <p className="font-medium text-slate-600">หน้านี้อยู่ระหว่างการพัฒนา</p>
      <p className="text-sm text-slate-400">Mockup UI — ฟีเจอร์เต็มรูปแบบจะตามมาเร็ว ๆ นี้</p>
    </div>
  );
}
