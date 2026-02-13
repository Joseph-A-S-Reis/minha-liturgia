import Link from "next/link";
import { notFound } from "next/navigation";
import { SparkIcon } from "@/app/components/icons";
import { getBibleVersionById, searchVerses } from "@/lib/bible-repository";

type PageProps = {
  params: Promise<{ version: string }>;
  searchParams: Promise<{ q?: string }>;
};

export default async function BibleSearchPage({ params, searchParams }: PageProps) {
  const { version } = await params;
  const { q } = await searchParams;

  const versionInfo = await getBibleVersionById(version);
  if (!versionInfo) {
    notFound();
  }

  const query = q?.trim() ?? "";
  const results = query ? await searchVerses(versionInfo.id, query, 80) : [];

  return (
    <main className="flex min-h-screen w-full flex-col gap-6 px-6 py-10 sm:px-10">
      <header className="space-y-2">
        <p className="text-sm text-zinc-500">
          <Link href="/biblia" className="hover:underline">
            Bíblia
          </Link>{" "}
          / Busca
        </p>
        <h1 className="text-3xl font-bold text-zinc-900 sm:text-4xl flex items-center gap-2">
          <SparkIcon className="size-8" /> Busca textual
        </h1>
        <p className="text-zinc-600">Versão: {versionInfo.name}</p>
      </header>

      <section className="rounded-2xl border border-sky-200 bg-sky-50 p-5">
        <form action={`/biblia/${versionInfo.id}/buscar`} className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            name="q"
            required
            defaultValue={query}
            placeholder="Digite um termo para pesquisar"
            className="w-full rounded-xl border border-sky-300 bg-white px-3 py-2 text-sm text-zinc-800 outline-none ring-sky-500 focus:ring"
          />
          <button
            type="submit"
            className="rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800"
          >
            Buscar
          </button>
        </form>
      </section>

      {query ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">
            {results.length} resultado(s) para “{query}”
          </h2>

          {results.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-600">
              Nenhum versículo encontrado. Tente outro termo ou confira se o conteúdo da Ave Maria
              já foi importado no banco.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {results.map((item) => (
                <li key={item.id} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                  <p className="text-sm font-semibold text-zinc-900">
                    {item.bookName} {item.chapter},{item.verse}
                  </p>
                  <p className="mt-1 text-sm text-zinc-700">{item.text}</p>
                  <Link
                    href={`/biblia/${item.versionId}/${item.bookId}/${item.chapter}#v${item.verse}`}
                    className="mt-2 inline-flex text-xs font-semibold text-sky-700 hover:text-sky-900"
                  >
                    Abrir referência
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-zinc-600">
            Digite um termo para pesquisar em toda a Bíblia da versão selecionada.
          </p>
        </section>
      )}
    </main>
  );
}