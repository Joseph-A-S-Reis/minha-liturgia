import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { BibleNotesPanel } from "@/app/components/bible-notes-panel";
import { BookIcon, CalendarIcon } from "@/app/components/icons";
import { getVerseNotesForChapter } from "@/lib/verse-notes";
import {
  getBibleVersionById,
  getBookById,
  getBookChapterCount,
  getChapterVerseList,
} from "@/lib/bible-repository";

type PageProps = {
  params: Promise<{
    version: string;
    book: string;
    chapter: string;
  }>;
};

export default async function BibleChapterPage({ params }: PageProps) {
  const { version, book, chapter } = await params;
  const chapterNumber = Number(chapter);

  if (!Number.isInteger(chapterNumber) || chapterNumber <= 0) {
    notFound();
  }

  const [versionInfo, bookInfo] = await Promise.all([
    getBibleVersionById(version),
    getBookById(book),
  ]);

  const session = await auth();

  if (!versionInfo || !bookInfo) {
    return (
      <main className="flex min-h-screen w-full flex-col gap-4 px-6 py-10 sm:px-10">
        <h1 className="text-2xl font-bold text-zinc-900">Referência não encontrada</h1>
        <p className="text-sm text-zinc-600">
          Não foi possível identificar esta versão/livro. Verifique o link ou selecione novamente
          na listagem da Bíblia.
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

  const [verseList, chapterCount] = await Promise.all([
    getChapterVerseList(versionInfo.id, bookInfo.id, chapterNumber),
    getBookChapterCount(versionInfo.id, bookInfo.id),
  ]);

  const userId = session?.user?.id ?? null;

  const initialNotes = userId
    ? await getVerseNotesForChapter({
        userId,
        versionId: versionInfo.id,
        bookId: bookInfo.id,
        chapter: chapterNumber,
      })
    : [];

  const noteCountByVerse = new Map<number, number>();

  for (const note of initialNotes) {
    noteCountByVerse.set(note.verse, (noteCountByVerse.get(note.verse) ?? 0) + 1);
  }

  const totalChapters = chapterCount || bookInfo.chapterCount;

  if (totalChapters > 0 && chapterNumber > totalChapters) {
    notFound();
  }

  const prevChapter = chapterNumber > 1 ? chapterNumber - 1 : null;
  const nextChapter = totalChapters > chapterNumber ? chapterNumber + 1 : null;

  return (
    <main className="flex min-h-screen w-full flex-col gap-6 px-6 py-10 sm:px-10">
      <header className="space-y-2">
        <p className="text-sm text-zinc-500">
          <Link href="/biblia" className="hover:underline">
            Bíblia
          </Link>{" "}
          /{" "}
          <Link href={`/biblia/${versionInfo.id}/${bookInfo.id}`} className="hover:underline">
            {bookInfo.name}
          </Link>{" "}
          / {chapterNumber}
        </p>
        <h1 className="text-3xl font-bold text-zinc-900 sm:text-4xl flex items-center gap-2">
          <BookIcon className="size-8" /> {bookInfo.name} {chapterNumber}
        </h1>
        <p className="text-zinc-600">Versão: {versionInfo.name}</p>
      </header>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {prevChapter ? (
                <Link
                  href={`/biblia/${versionInfo.id}/${bookInfo.id}/${prevChapter}`}
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  ← Capítulo {prevChapter}
                </Link>
              ) : null}

              <Link
                href={`/biblia/${versionInfo.id}/${bookInfo.id}`}
                className="rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800 hover:bg-sky-100"
              >
                Ver capítulos
              </Link>

              {nextChapter ? (
                <Link
                  href={`/biblia/${versionInfo.id}/${bookInfo.id}/${nextChapter}`}
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Capítulo {nextChapter} →
                </Link>
              ) : null}
            </div>

            {verseList.length === 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
                <h2 className="font-semibold">Capítulo ainda indisponível</h2>
                <p className="mt-1 text-sm">
                  Este capítulo não foi encontrado no banco de dados. Após a importação da Bíblia
                  Ave Maria, os versículos serão exibidos aqui.
                </p>
              </div>
            ) : (
              <ol className="space-y-3">
                {verseList.map((verse) => {
                  const noteCount = noteCountByVerse.get(verse.verse) ?? 0;

                  return (
                    <li
                      key={verse.id}
                      id={`v${verse.verse}`}
                      className={`rounded-lg px-2 py-1 transition hover:bg-zinc-50 ${
                        noteCount > 0 ? "ring-1 ring-amber-300 bg-amber-50/60" : ""
                      }`}
                    >
                      <Link
                        href={`#v${verse.verse}`}
                        className="mr-2 inline-flex min-w-8 items-center justify-center rounded bg-sky-100 px-2 py-0.5 text-xs font-bold text-sky-800"
                      >
                        {verse.verse}
                      </Link>
                      <span className="text-zinc-800 leading-7">{verse.text}</span>
                      {noteCount > 0 ? (
                        <span className="ml-2 inline-flex items-center rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                          {noteCount} nota{noteCount > 1 ? "s" : ""}
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          <section className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
            <h2 className="text-sm font-semibold text-sky-900 flex items-center gap-2">
              <CalendarIcon className="size-4" /> Busca textual nesta versão
            </h2>
            <form
              action={`/biblia/${versionInfo.id}/buscar`}
              className="mt-3 flex flex-col gap-2 sm:flex-row"
            >
              <input
                type="text"
                name="q"
                required
                placeholder="Pesquisar palavra ou frase"
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
        </div>

        <BibleNotesPanel
          versionId={versionInfo.id}
          bookId={bookInfo.id}
          bookName={bookInfo.name}
          chapter={chapterNumber}
          verses={verseList.map((verse) => ({
            verse: verse.verse,
            text: verse.text,
          }))}
          initialNotes={initialNotes}
          isAuthenticated={Boolean(userId)}
        />
      </div>
    </main>
  );
}