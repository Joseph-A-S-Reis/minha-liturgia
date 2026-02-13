import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen w-full flex-col items-start justify-center gap-4 px-6 py-10 sm:px-10">
      <p className="text-sm font-medium text-emerald-700">Erro 404</p>
      <h1 className="text-3xl font-bold text-zinc-900">Página não encontrada</h1>
      <p className="text-zinc-600">
        Essa rota ainda não existe na primeira versão do Minha Liturgia.
      </p>
      <Link
        href="/inicio"
        className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
      >
        Voltar ao início
      </Link>
    </main>
  );
}
