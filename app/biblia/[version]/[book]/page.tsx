import Link from "next/link";
import { BookIcon, CheckCircleIcon } from "@/app/components/icons";
import {
  getBibleVersionById,
  getBookById,
  getBookChapterCount,
} from "@/lib/bible-repository";

type PageProps = {
  params: Promise<{
    version: string;
    book: string;
  }>;
};

export default async function BibleBookPage({ params }: PageProps) {
  const { version, book } = await params;

  const [versionInfo, bookInfo] = await Promise.all([
    getBibleVersionById(version),
    getBookById(book),
  ]);

  if (!versionInfo || !bookInfo) {
    return (
      <main className="flex min-h-screen w-full flex-col gap-4 px-6 py-10 sm:px-10">
        <h1 className="text-2xl font-bold text-zinc-900">Livro não encontrado</h1>
        <p className="text-sm text-zinc-600">
          Este livro/versão não pôde ser localizado. Se o link for antigo, selecione novamente a
          referência a partir da página da Bíblia.
        </p>
        <Link
          href="/biblia"
          className="inline-flex w-fit rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800"
        >
          Voltar para Bíblia
        </Link>
      </main>
    );
  }

  const chaptersInDb = await getBookChapterCount(versionInfo.id, bookInfo.id);
  const chapterCount = chaptersInDb || bookInfo.chapterCount;

  if (chapterCount <= 0) {
    return (
      <main className="flex min-h-screen w-full flex-col gap-6 px-6 py-10 sm:px-10">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold text-zinc-900 sm:text-4xl flex items-center gap-2">
            <BookIcon className="size-8" /> {bookInfo.name}
          </h1>
          <p className="text-zinc-600">Versão: {versionInfo.name}</p>
        </header>

        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="text-lg font-semibold text-amber-900">Conteúdo ainda não importado</h2>
          <p className="mt-2 text-sm text-amber-800">
            Este livro ainda não possui capítulos no banco de dados. Assim que a importação da Ave
            Maria for concluída, os capítulos aparecerão automaticamente.
          </p>
          <Link
            href="/biblia"
            className="mt-4 inline-flex rounded-xl border border-amber-300 px-3 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100"
          >
            Voltar para Bíblia
          </Link>
        </section>
      </main>
    );
  }

  const chapters = Array.from({ length: chapterCount }, (_, i) => i + 1);

  return (
    <main className="flex min-h-screen w-full flex-col gap-6 px-6 py-10 sm:px-10">
      <header className="space-y-2">
        <p className="text-sm text-zinc-500">
          <Link href="/biblia" className="hover:underline">
            Bíblia
          </Link>{" "}
          / {bookInfo.name}
        </p>
        <h1 className="text-3xl font-bold text-zinc-900 sm:text-4xl flex items-center gap-2">
          <BookIcon className="size-8" /> {bookInfo.name}
        </h1>
        <p className="text-zinc-600">Escolha um capítulo para iniciar a leitura ({versionInfo.name}).</p>
      </header>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900 flex items-center gap-2">
          <CheckCircleIcon className="size-5 text-emerald-700" /> Capítulos
        </h2>
        <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
          {chapters.map((chapter) => (
            <Link
              key={chapter}
              href={`/biblia/${versionInfo.id}/${bookInfo.id}/${chapter}`}
              className="rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-center text-sm font-semibold text-zinc-800 transition hover:border-sky-300 hover:bg-sky-50"
            >
              {chapter}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}