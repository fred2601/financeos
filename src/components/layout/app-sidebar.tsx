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
  available: boolean;
}

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, available: true },
  { href: "/variance", label: "Budget vs actual", icon: ArrowLeftRight, available: true },
  { href: "/forecast", label: "Forecast", icon: ChartNoAxesCombined, available: false },
  { href: "/scenarios", label: "Scenarios", icon: Layers, available: false },
  { href: "/analyst", label: "AI analyst", icon: Sparkles, available: false },
];

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid size-8 place-items-center rounded-lg bg-sidebar-primary text-sm font-bold text-sidebar-primary-foreground">
        F
      </div>
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
      {NAV.map(({ href, label, icon: Icon, available }) => {
        const active = pathname.startsWith(href);
        const classes = cn(
          "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm whitespace-nowrap transition-colors",
          active
            ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
          !available && "pointer-events-none opacity-50",
        );
        const content = (
          <>
            <Icon className="size-4 shrink-0" aria-hidden />
            <span>{label}</span>
            {!available && !compact && (
              <span className="ml-auto rounded bg-sidebar-border px-1.5 py-px text-[10px] uppercase tracking-wide text-sidebar-muted">
                Soon
              </span>
            )}
          </>
        );
        return available ? (
          <Link key={href} href={href} className={classes} aria-current={active ? "page" : undefined}>
            {content}
          </Link>
        ) : (
          <span key={href} className={classes} aria-disabled="true" title="Coming in a later milestone">
            {content}
          </span>
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
