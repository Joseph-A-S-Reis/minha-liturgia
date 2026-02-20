"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isNavItemActive, navigationItems } from "./navigation-items";

export function MobileTabbar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegação móvel"
      className="mobile-tabbar-safe md:hidden fixed inset-x-0 bottom-0 z-50 border-t border-sky-200 bg-white/95 backdrop-blur supports-backdrop-filter:bg-white/90"
    >
      <ul className="grid grid-cols-6 gap-1 px-2 py-2">
        {navigationItems.map((item) => {
          const isActive = pathname ? isNavItemActive(pathname, item) : false;

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`flex min-h-12 flex-col items-center justify-center rounded-xl px-1 py-2 text-[11px] font-semibold leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#003366]/35 ${
                  isActive
                    ? "bg-[#003366] text-white"
                    : "text-[#003366] hover:bg-sky-50"
                }`}
              >
                <item.icon className="size-4" />
                <span className="mt-1">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
