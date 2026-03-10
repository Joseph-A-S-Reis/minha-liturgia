"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isNavItemActive, navigationItems } from "./navigation-items";

const compactLabels: Record<string, string> = {
  "/inicio": "Início",
  "/minha-devocao": "Devoção",
  "/biblia": "Bíblia",
  "/biblioteca": "Acervo",
  "/diario": "Diário",
  "/calendario": "Agenda",
  "/conta": "Conta",
};

export function MobileTabbar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegação móvel"
      className="mobile-tabbar-safe md:hidden fixed inset-x-0 bottom-0 z-50 border-t border-sky-200 bg-white/95 backdrop-blur supports-backdrop-filter:bg-white/90"
    >
      <ul className="flex items-stretch justify-between gap-0.5 px-1 py-1.5">
        {navigationItems.map((item) => {
          const isActive = pathname ? isNavItemActive(pathname, item) : false;
          const compactLabel = compactLabels[item.href];

          return (
            <li key={item.href} className="min-w-0 flex-1">
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`flex min-h-11 w-full flex-col items-center justify-center rounded-lg px-0.5 py-1.5 text-[8px] font-semibold leading-none tracking-[-0.02em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#003366]/35 min-[360px]:text-[9px] min-[390px]:rounded-xl min-[390px]:px-1 min-[390px]:py-2 min-[390px]:text-[10px] ${
                  isActive
                    ? "bg-[#003366] text-white"
                    : "text-[#003366] hover:bg-sky-50"
                }`}
              >
                <item.icon className="size-3 min-[360px]:size-3.5 min-[390px]:size-4" />
                <span className="mt-0.5 max-w-full truncate whitespace-nowrap text-center">
                  <span className="min-[390px]:hidden">{compactLabel}</span>
                  <span className="hidden min-[390px]:inline">{item.label}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
