"use client";

import { useTransition } from "react";
import { signOut } from "next-auth/react";
import { LogoutIcon } from "./icons";

type LogoutButtonProps = {
  label?: string;
  className?: string;
};

export function LogoutButton({
  label = "Sair",
  className,
}: LogoutButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleSignOut() {
    startTransition(async () => {
      await signOut({ callbackUrl: "/inicio" });
    });
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={isPending}
      className={
        className ??
        "inline-flex items-center rounded-xl border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-70"
      }
    >
      <LogoutIcon className="mr-2 size-4" />
      {isPending ? "Saindo..." : label}
    </button>
  );
}
