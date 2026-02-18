"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LoginIcon, LogoutIcon } from "./icons";
import { isNavItemActive, navigationItems } from "./navigation-items";

type SidebarProps = {
  isAuthenticated: boolean;
};

export function Sidebar({ isAuthenticated }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-64 bg-[#003366] text-white fixed h-screen left-0 top-0 overflow-y-auto flex-col border-r border-sky-800 shadow-2xl z-40">
      <div className="p-6">
        <h1 className="text-2xl font-serif font-bold border-b border-white/20 pb-4 mb-6 tracking-wide">
          Minha Liturgia
        </h1>
        <nav className="flex-1" aria-label="Navegação principal">
          <ul className="space-y-2">
            {navigationItems.map((item) => {
              const isActive = pathname ? isNavItemActive(pathname, item) : false;

              return (
                <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex items-center gap-3 text-lg px-4 py-3 rounded transition-colors font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 ${
                    isActive
                      ? "bg-white/20 text-white"
                      : "hover:bg-white/10 text-sky-50"
                  }`}
                >
                  <item.icon className="size-5 text-sky-100" />
                  {item.label}
                </Link>
              </li>
              );
            })}
          </ul>
        </nav>
      </div>
      
      <div className="mt-auto p-6 bg-[#002244]">
        {isAuthenticated ? (
          <Link href="/api/auth/signout" className="flex items-center gap-2 text-sm opacity-80 hover:opacity-100">
             <LogoutIcon className="size-4" />
             <span>Sair da conta</span>
          </Link>
        ) : (
          <Link href="/entrar" className="flex items-center gap-2 text-lg font-medium hover:text-sky-200 transition-colors">
             <LoginIcon className="size-5" />
             <span>Entrar</span>
          </Link>
        )}
      </div>
    </aside>
  );
}
