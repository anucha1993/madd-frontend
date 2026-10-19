"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, ChevronDown, Pencil, X } from "lucide-react";
import { NAV_SECTIONS, type NavItem } from "@/lib/nav";
import { getNavLabels, labelOf, navLabelKey, saveNavLabel, type NavLabels } from "@/lib/navLabels";
import { canVisit } from "@/lib/access";
import { useAccess } from "@/components/auth/AccessProvider";

type Props = {
  open: boolean;
  onNavigate: () => void;
};

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

// Some nav hrefs can be prefixes of others (e.g. two hrefs where one starts with the other) —
// naive prefix matching would light up BOTH at once. Only the longest (most specific) matching
// href among every nav link should be considered the active one.
function findActiveHref(pathname: string): string | undefined {
  const hrefs: string[] = [];
  NAV_SECTIONS.forEach((s) => {
    if (s.href) hrefs.push(s.href);
    s.children?.forEach((c) => hrefs.push(c.href));
  });
  const matches = hrefs.filter((href) => isActive(pathname, href));
  return matches.reduce<string | undefined>((best, href) => (!best || href.length > best.length ? href : best), undefined);
}

export default function Sidebar({ open, onNavigate }: Props) {
  const pathname = usePathname();
  const { access } = useAccess();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  // Only the menu entries this user's Roles allow (see lib/access.ts ROUTE_PERMISSIONS) — a
  // section whose every child is filtered out disappears entirely.
  const sections = useMemo(
    () =>
      NAV_SECTIONS.flatMap<NavItem>((s) => {
        if (!s.children) return s.href && canVisit(access, s.href) ? [s] : [];
        const children = s.children.filter((c) => canVisit(access, c.href));
        return children.length > 0 ? [{ ...s, children }] : [];
      }),
    [access],
  );
  const activeHref = useMemo(() => findActiveHref(pathname), [pathname]);
  // Renamed menu entries (Super Admin only — the pencil on hover).
  const [labels, setLabels] = useState<NavLabels>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const canRename = access.is_super_admin;
  useEffect(() => {
    getNavLabels()
      .then((r) => setLabels(r.labels ?? {}))
      .catch(() => {});
  }, []);
  const rename = async (key: string, label: string) => {
    setEditingKey(null);
    try {
      setLabels((await saveNavLabel(key, label)).labels ?? {});
    } catch {
      // keep the current names — the API rejects anyone but a Super Admin anyway
    }
  };
  const renameProps = (item: Pick<NavItem, "id" | "href" | "label" | "children">) => {
    const key = navLabelKey(item);
    return {
      canRename,
      editing: editingKey === key,
      current: labels[key] ?? "",
      builtIn: item.label,
      onEdit: () => setEditingKey(key),
      onCancel: () => setEditingKey(null),
      onSave: (label: string) => rename(key, label),
    };
  };

  const activeSectionLabel = useMemo(
    () => NAV_SECTIONS.find((s) => s.children?.some((c) => c.href === activeHref))?.label,
    [activeHref],
  );

  useEffect(() => {
    if (activeSectionLabel) {
      setExpanded((prev) => ({ ...prev, [activeSectionLabel]: true }));
    }
  }, [activeSectionLabel]);

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-gradient-to-b from-brand-navy-dark from-80% to-brand-navy transition-transform lg:static lg:translate-x-0 ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="flex h-20 items-center justify-center border-b border-white/10 px-5">
        <Image src="/logo-250-white.png" alt="MADD" width={140} height={45} className="h-auto w-44" priority />
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {sections.map((section) => {
          const Icon = section.icon;

          if (!section.children) {
            const active = section.href === activeHref;
            const r = renameProps(section);
            if (r.editing) return <RenameInput key={section.label} {...r} />;
            return (
              <div key={section.label} className="group relative">
                <Link
                  href={section.href!}
                  onClick={onNavigate}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                    active ? "bg-brand-amber text-brand-navy-dark" : "text-slate-300 hover:bg-white/5"
                  } ${canRename ? "pr-9" : ""}`}
                >
                  <Icon className="h-4.5 w-4.5" />
                  {labelOf(labels, section)}
                </Link>
                <PencilButton {...r} className={`right-2 ${active ? "text-brand-navy-dark/60" : ""}`} />
              </div>
            );
          }

          const isOpenSection = !!expanded[section.label];
          const sectionActive = section.children.some((c) => c.href === activeHref);

          const sr = renameProps(section);
          return (
            <div key={section.label}>
              {sr.editing ? (
                <RenameInput {...sr} />
              ) : (
                <div className="group relative">
                  <button
                    type="button"
                    onClick={() => setExpanded((prev) => ({ ...prev, [section.label]: !prev[section.label] }))}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                      sectionActive ? "text-brand-amber" : "text-slate-300 hover:bg-white/5"
                    }`}
                  >
                    <Icon className="h-4.5 w-4.5" />
                    <span className="flex-1 text-left">{labelOf(labels, section)}</span>
                    {canRename && <span className="w-6" />}
                    <ChevronDown className={`h-4 w-4 transition-transform ${isOpenSection ? "rotate-180" : ""}`} />
                  </button>
                  <PencilButton {...sr} className="right-8" />
                </div>
              )}
              {isOpenSection && (
                <div className="ml-4 mt-1 flex flex-col gap-1 border-l border-white/10 pl-4">
                  {section.children.map((leaf) => {
                    const active = leaf.href === activeHref;
                    const lr = renameProps(leaf);
                    if (lr.editing) return <RenameInput key={leaf.href} {...lr} />;
                    return (
                      <div key={leaf.href} className="group relative">
                        <Link
                          href={leaf.href}
                          onClick={onNavigate}
                          className={`block rounded-md px-3 py-2 text-sm transition ${
                            active ? "bg-white/10 text-brand-amber" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                          } ${canRename ? "pr-9" : ""}`}
                        >
                          {labelOf(labels, leaf)}
                        </Link>
                        <PencilButton {...lr} className="right-1.5" />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

type RenameProps = {
  canRename: boolean;
  current: string;
  builtIn: string;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (label: string) => void;
};

// Shown on hover for a Super Admin only.
function PencilButton({ canRename, onEdit, builtIn, className = "" }: RenameProps & { className?: string }) {
  if (!canRename) return null;
  return (
    <button
      type="button"
      onClick={onEdit}
      title={`เปลี่ยนชื่อเมนู "${builtIn}"`}
      aria-label={`เปลี่ยนชื่อเมนู ${builtIn}`}
      className={`absolute top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 opacity-0 transition hover:bg-white/10 hover:text-brand-amber focus:opacity-100 group-hover:opacity-100 ${className}`}
    >
      <Pencil className="h-3.5 w-3.5" />
    </button>
  );
}

function RenameInput({ current, builtIn, onCancel, onSave }: RenameProps) {
  const [value, setValue] = useState(current || builtIn);
  // Same as the built-in name → store nothing, so later renames of the default still apply.
  const submit = () => onSave(value.trim() === builtIn ? "" : value.trim());
  return (
    <div className="flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1.5">
      <input
        autoFocus
        value={value}
        maxLength={60}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") onCancel();
        }}
        placeholder={builtIn}
        className="min-w-0 flex-1 rounded border border-white/20 bg-brand-navy-dark px-2 py-1 text-sm text-white outline-none focus:border-brand-amber"
      />
      <button type="button" onClick={submit} title="บันทึก (ว่าง = ชื่อเดิม)" className="rounded p-1 text-emerald-400 hover:bg-white/10">
        <Check className="h-4 w-4" />
      </button>
      <button type="button" onClick={onCancel} title="ยกเลิก" className="rounded p-1 text-slate-400 hover:bg-white/10">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
