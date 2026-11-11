"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  ChartNoAxesCombined,
  Layers,
  LayoutDashboard,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/variance", label: "Budget vs actual", icon: ArrowLeftRight },
  { href: "/forecast", label: "Forecast", icon: ChartNoAxesCombined },
  { href: "/scenarios", label: "Scenarios", icon: Layers },
  { href: "/analyst", label: "AI analyst", icon: Sparkles },
];

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <svg viewBox="0 0 64 64" className="size-8 shrink-0" aria-hidden="true">
        <rect width="64" height="64" rx="14" fill="var(--sidebar-accent)" />
        <rect x="14" y="36" width="8" height="14" rx="2" fill="var(--sidebar-primary)" />
        <rect x="28" y="26" width="8" height="24" rx="2" fill="var(--sidebar-primary)" />
        <rect x="42" y="16" width="8" height="34" rx="2" fill="#ffffff" />
      </svg>
      <div className="leading-tight">
        <div className="text-[15px] font-semibold tracking-tight text-sidebar-accent-foreground">FinanceOS</div>
        <div className="text-[11px] text-sidebar-muted">Financial planning & analysis</div>
      </div>
    </div>
  );
}

function NavLinks({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname();
  return (
    <nav className={cn(compact ? "flex gap-1" : "flex flex-col gap-0.5")} aria-label="Main">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-primary",
              active
                ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function CompanyFooter() {
  return (
    <div className="rounded-lg border border-sidebar-border p-3">
      <div className="text-xs font-medium text-sidebar-accent-foreground">Fjordhus Retail A/S</div>
      <div className="mt-0.5 text-[11px] text-sidebar-muted">Fictional demo company · DKK</div>
    </div>
  );
}

export function AppSidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-8 bg-sidebar px-4 py-5 lg:flex">
      <Logo />
      <div className="flex flex-col gap-2">
        <div className="px-2.5 text-[11px] font-medium uppercase tracking-wider text-sidebar-muted">Analysis</div>
        <NavLinks />
      </div>
      <div className="mt-auto">
        <CompanyFooter />
      </div>
    </aside>
  );
}

export function MobileNav() {
  return (
    <div className="flex flex-col gap-3 bg-sidebar px-4 py-3 lg:hidden">
      <Logo />
      <div className="-mx-4 overflow-x-auto px-4 pb-1">
        <NavLinks compact />
      </div>
    </div>
  );
}
