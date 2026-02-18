import type { ComponentType, SVGProps } from "react";
import {
  BookIcon,
  CalendarIcon,
  HomeIcon,
  PenIcon,
  UserIcon,
} from "./icons";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

export type NavigationItem = {
  href: string;
  label: string;
  icon: IconComponent;
  activeMatchers?: string[];
};

const AUTH_MATCHERS = [
  "/conta",
  "/entrar",
  "/cadastro",
  "/esqueci-senha",
  "/redefinir-senha",
  "/reenviar-verificacao",
  "/verificar-email",
];

export const navigationItems: NavigationItem[] = [
  { href: "/inicio", label: "Início", icon: HomeIcon },
  { href: "/biblia", label: "Bíblia", icon: BookIcon },
  { href: "/diario", label: "Diário", icon: PenIcon },
  { href: "/calendario", label: "Calendário", icon: CalendarIcon },
  { href: "/conta", label: "Conta", icon: UserIcon, activeMatchers: AUTH_MATCHERS },
];

function isMatcherActive(pathname: string, matcher: string) {
  return pathname === matcher || pathname.startsWith(`${matcher}/`);
}

export function isNavItemActive(pathname: string, item: NavigationItem) {
  if (isMatcherActive(pathname, item.href)) {
    return true;
  }

  return item.activeMatchers?.some((matcher) => isMatcherActive(pathname, matcher)) ?? false;
}
