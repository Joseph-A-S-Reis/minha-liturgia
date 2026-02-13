import { logoutAction } from "@/app/auth-actions";
import { LogoutIcon } from "./icons";

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        className="inline-flex items-center rounded-xl border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100"
      >
        <LogoutIcon className="mr-2 size-4" />
        Sair
      </button>
    </form>
  );
}
