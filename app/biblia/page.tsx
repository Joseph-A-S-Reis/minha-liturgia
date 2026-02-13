import Link from "next/link";
import {
  BookIcon,
  CalendarIcon,
  CheckCircleIcon,
  SparkIcon,
} from "@/app/components/icons";
import { getBibleVersions, getBooksByVersion, getDefaultBibleVersion } from "@/lib/bible-repository";

export default async function BibliaPage() {
  const defaultVersion = await getDefaultBibleVersion();
  const versions = await getBibleVersions();
  const books = await getBooksByVersion(defaultVersion.id);
  const oldTestament = books.filter((book) => book.testament === "AT");
  const newTestament = books.filter((book) => book.testament === "NT");

  return (
    <main className="flex min-h-screen w-full flex-col gap-8 px-6 py-10 sm:px-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-zinc-900 sm:text-4xl flex items-center gap-2">
          <BookIcon className="size-8" /> Bíblia
        </h1>
        <p className="text-zinc-600">
          Leitura completa por livro, capítulo e versículo. Versão padrão: {" "}
          <strong>{defaultVersion.name}</strong>.
        </p>
      </header>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900 flex items-center gap-2">
          <CheckCircleIcon className="size-5 text-emerald-700" /> Versões disponíveis
        </h2>
        <ul className="mt-3 space-y-2 text-sm text-zinc-700">
          {versions.map((version) => (
            <li key={version.id}>
              <span className="font-medium">{version.name}</span> ({version.language})
              {version.isDefault || version.id === defaultVersion.id ? " · padrão" : ""}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-sky-200 bg-sky-50 p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-sky-900 flex items-center gap-2">
          <SparkIcon className="size-5" /> Busca textual
        </h2>
        <p className="mt-2 text-sm text-sky-800">
          Pesquise por palavras ou frases em toda a Bíblia Ave Maria.
        </p>
        <form action={`/biblia/${defaultVersion.id}/buscar`} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            name="q"
            required
            placeholder="Ex.: misericórdia, fé, amor"
            className="w-full rounded-xl border border-sky-300 bg-white px-3 py-2 text-sm text-zinc-800 outline-none ring-sky-500 focus:ring"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-800"
          >
            Buscar
          </button>
        </form>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-zinc-900 flex items-center gap-2">
            <CalendarIcon className="size-4" /> Antigo Testamento
          </h2>
          <ul className="mt-3 grid grid-cols-1 gap-2 text-sm text-zinc-700 lg:grid-cols-2">
            {oldTestament.map((book) => (
              <li key={book.id}>
                <Link
                  href={`/biblia/${defaultVersion.id}/${book.id}`}
                  className="block rounded-lg border border-transparent px-2 py-1 transition hover:border-sky-200 hover:bg-sky-50"
                >
                  <span className="font-medium">{book.name}</span>
                  <span className="ml-2 text-xs text-zinc-500">{book.chapterCount || "-"} caps.</span>
                </Link>
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-zinc-900 flex items-center gap-2">
            <CalendarIcon className="size-4" /> Novo Testamento
          </h2>
          <ul className="mt-3 grid grid-cols-1 gap-2 text-sm text-zinc-700 lg:grid-cols-2">
            {newTestament.map((book) => (
              <li key={book.id}>
                <Link
                  href={`/biblia/${defaultVersion.id}/${book.id}`}
                  className="block rounded-lg border border-transparent px-2 py-1 transition hover:border-sky-200 hover:bg-sky-50"
                >
                  <span className="font-medium">{book.name}</span>
                  <span className="ml-2 text-xs text-zinc-500">{book.chapterCount || "-"} caps.</span>
                </Link>
              </li>
            ))}
          </ul>
        </article>
      </section>
    </main>
  );
}
