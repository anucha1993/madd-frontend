"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { NAV_SECTIONS } from "@/lib/nav";

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
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const activeHref = useMemo(() => findActiveHref(pathname), [pathname]);

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
        {NAV_SECTIONS.map((section) => {
          const Icon = section.icon;

          if (!section.children) {
            const active = section.href === activeHref;
            return (
              <Link
                key={section.label}
                href={section.href!}
                onClick={onNavigate}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  active ? "bg-brand-amber text-brand-navy-dark" : "text-slate-300 hover:bg-white/5"
                }`}
              >
                <Icon className="h-4.5 w-4.5" />
                {section.label}
              </Link>
            );
          }

          const isOpenSection = !!expanded[section.label];
          const sectionActive = section.children.some((c) => c.href === activeHref);

          return (
            <div key={section.label}>
              <button
                type="button"
                onClick={() => setExpanded((prev) => ({ ...prev, [section.label]: !prev[section.label] }))}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  sectionActive ? "text-brand-amber" : "text-slate-300 hover:bg-white/5"
                }`}
              >
                <Icon className="h-4.5 w-4.5" />
                <span className="flex-1 text-left">{section.label}</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${isOpenSection ? "rotate-180" : ""}`} />
              </button>
              {isOpenSection && (
                <div className="ml-4 mt-1 flex flex-col gap-1 border-l border-white/10 pl-4">
                  {section.children.map((leaf) => {
                    const active = leaf.href === activeHref;
                    return (
                      <Link
                        key={leaf.href}
                        href={leaf.href}
                        onClick={onNavigate}
                        className={`rounded-md px-3 py-2 text-sm transition ${
                          active ? "bg-white/10 text-brand-amber" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                        }`}
                      >
                        {leaf.label}
                      </Link>
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
