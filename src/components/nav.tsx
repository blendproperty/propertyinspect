"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Building2,
  ClipboardCheck,
  Contact,
  LayoutGrid,
  LayoutTemplate,
  Menu,
  Settings,
  Users,
  X,
} from "lucide-react";
import { cx } from "@/lib/format";
import { ROLES, type RoleKey } from "@/lib/options";
import { Logo } from "./logo";

type Item = { href: string; label: string; icon: typeof LayoutGrid; roles?: RoleKey[] };
const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: "Workspace",
    items: [
      { href: "/", label: "Overview", icon: LayoutGrid },
      { href: "/properties", label: "Properties", icon: Building2 },
    ],
  },
  {
    title: "Inspections",
    items: [
      { href: "/inspections", label: "Inspections", icon: ClipboardCheck },
      { href: "/templates", label: "Templates", icon: LayoutTemplate, roles: ["admin", "manager", "inspector"] },
    ],
  },
  {
    title: "Admin",
    items: [
      { href: "/clients", label: "Clients", icon: Contact, roles: ["admin", "manager"] },
      { href: "/team", label: "People", icon: Users, roles: ["admin"] },
      { href: "/settings", label: "Settings", icon: Settings, roles: ["admin"] },
    ],
  },
];

export function Nav({
  userName,
  role,
  logout,
}: {
  userName: string;
  role: RoleKey;
  logout: () => Promise<void>;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) =>
    href === "/" ? path === "/" : path.startsWith(href);

  const links = (
    <nav className="space-y-6">
      {GROUPS.map((g) => {
        const items = g.items.filter((i) => !i.roles || i.roles.includes(role));
        if (!items.length) return null;
        return (
          <div key={g.title}>
            <p className="mb-2 px-3 text-[11px] font-bold tracking-[0.13em] text-[#7ca399] uppercase">{g.title}</p>
            <div className="space-y-0.5">
              {items.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={cx(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium",
                    isActive(href) ? "bg-brand-800 text-white" : "text-[#b8d0c9] hover:bg-white/5 hover:text-white",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </nav>
  );
  const footer = (
    <div className="border-t border-white/10 px-3 pt-4">
      <p className="truncate text-sm font-medium text-white">{userName}</p>
      <p className="truncate text-xs text-[#9cc0b6]">{ROLES[role]}</p>
      <form action={logout}>
        <button className="mt-2 text-xs font-medium text-[#9cc0b6] hover:text-white">Sign out</button>
      </form>
    </div>
  );
  const panel = "flex flex-col justify-between bg-brand-900 p-5";
  return (
    <>
      <header className="no-print sticky top-0 z-20 flex items-center justify-between bg-brand-900 px-4 py-3 lg:hidden">
        <Logo light />
        <button onClick={() => setOpen(true)} aria-label="Open menu" className="rounded-lg p-1.5 text-white hover:bg-white/10">
          <Menu className="h-5 w-5" />
        </button>
      </header>
      {open && (
        <div className="no-print fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)}>
          <aside className={cx(panel, "h-full w-64 overflow-y-auto")} onClick={(e) => e.stopPropagation()}>
            <div className="space-y-8">
              <div className="flex items-start justify-between px-3">
                <Logo light />
                <button onClick={() => setOpen(false)} aria-label="Close menu" className="text-white"><X className="h-5 w-5" /></button>
              </div>
              {links}
            </div>
            {footer}
          </aside>
        </div>
      )}
      <aside className={cx(panel, "no-print sticky top-0 hidden h-screen w-60 shrink-0 overflow-y-auto lg:flex")}>
        <div className="space-y-8">
          <div className="px-3 pt-2"><Logo light /></div>
          {links}
        </div>
        {footer}
      </aside>
    </>
  );
}
