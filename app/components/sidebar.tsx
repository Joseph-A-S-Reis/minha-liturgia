import Link from "next/link";
import { auth } from "@/auth";
import {
  BookIcon,
  CalendarIcon,
  HomeIcon,
  LoginIcon,
  LogoutIcon,
  PenIcon,
} from "./icons";

const navItems = [
  { href: "/inicio", label: "Início", icon: HomeIcon },
  { href: "/biblia", label: "Bíblia", icon: BookIcon },
  { href: "/diario", label: "Diário", icon: PenIcon },
  { href: "/calendario", label: "Calendário", icon: CalendarIcon },
];

export async function Sidebar() {
  const session = await auth();

  return (
    <aside className="w-64 bg-[#003366] text-white fixed h-screen left-0 top-0 overflow-y-auto flex flex-col border-r border-sky-800 shadow-2xl z-40">
      <div className="p-6">
        <h1 className="text-2xl font-serif font-bold border-b border-white/20 pb-4 mb-6 tracking-wide">
          Minha Liturgia
        </h1>
        <nav className="flex-1">
          <ul className="space-y-2">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex items-center gap-3 text-lg px-4 py-3 rounded hover:bg-white/10 transition-colors font-medium"
                >
                  <item.icon className="size-5 text-sky-100" />
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      
      <div className="mt-auto p-6 bg-[#002244]">
        {session ? (
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
