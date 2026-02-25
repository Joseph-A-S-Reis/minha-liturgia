import Link from "next/link";
import { auth } from "@/auth";
import { LibraryIcon, SparkIcon } from "@/app/components/icons";
import {
  getLibraryCategories,
  listPublishedLibraryResources,
} from "@/lib/library-repository";
import { getLibraryPublishAccess } from "@/lib/library-access";

type PageProps = {
  searchParams: Promise<{
    q?: string;
    tipo?: string;
    aba?: string;
  }>;
};

const RESOURCE_TYPES = [
  { value: "all", label: "Todos" },
  { value: "article", label: "Artigo" },
  { value: "book", label: "Livro" },
  { value: "document", label: "Documento" },
] as const;

type ResourceTypeFilter = (typeof RESOURCE_TYPES)[number]["value"];

function isResourceTypeFilter(value: string | undefined): value is ResourceTypeFilter {
  return RESOURCE_TYPES.some((item) => item.value === value);
}

function formatArticleDate(value: Date | null) {
  if (!value) return null;

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export default async function BibliotecaPage({ searchParams }: PageProps) {
  const session = await auth();
  const publishAccess = session?.user?.id
    ? await getLibraryPublishAccess(session.user.id)
    : { canPublish: false, isAdmin: false, isCurator: false };
  const { q, tipo, aba } = await searchParams;

  const query = q?.trim() ?? "";
  const selectedType: ResourceTypeFilter = isResourceTypeFilter(tipo) ? tipo : "all";
  const tab = aba === "santa-igreja" ? "santa-igreja" : "geral";

  const buildLibraryHref = (input: {
    tab: "geral" | "santa-igreja";
    type: ResourceTypeFilter;
    query: string;
  }) => {
    const params = new URLSearchParams();

    if (input.tab === "santa-igreja") {
      params.set("aba", "santa-igreja");
    }

    if (input.type !== "all") {
      params.set("tipo", input.type);
    }

    if (input.query.trim()) {
      params.set("q", input.query.trim());
    }

    const queryString = params.toString();
    return queryString ? `/biblioteca?${queryString}` : "/biblioteca";
  };

  let categories: Awaited<ReturnType<typeof getLibraryCategories>> = [];
  let resources: Awaited<ReturnType<typeof listPublishedLibraryResources>> = [];
  let databaseSetupError: string | null = null;

  try {
    [categories, resources] = await Promise.all([
      getLibraryCategories(tab === "santa-igreja" ? "santa-igreja" : undefined),
      listPublishedLibraryResources({
        query: query || undefined,
        type: selectedType !== "all" ? selectedType : undefined,
        section: undefined,
        officialOnly: tab === "santa-igreja",
        limit: 80,
      }),
    ]);
  } catch (error) {
    const dbCode =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code?: string }).code)
        : "";

    if (dbCode === "42P01") {
      databaseSetupError =
        "As tabelas da Biblioteca ainda não existem neste banco. Execute as migrações (npm run db:push) usando o DATABASE_URL atual do .env.";
    } else {
      throw error;
    }
  }

  return (
    <main className="flex min-h-screen w-full flex-col gap-6 px-6 py-10 sm:px-10">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-bold text-zinc-900 sm:text-4xl flex items-center gap-2">
            <LibraryIcon className="size-8" /> Biblioteca Católica
          </h1>
          {publishAccess.canPublish ? (
            <Link
              href="/biblioteca/novo"
              className="inline-flex rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800 hover:bg-sky-100"
            >
              Novo conteúdo
            </Link>
          ) : null}
        </div>
        <p className="text-zinc-600">
          Um acervo para estudo rápido e prático: doutrina, santos, história da Igreja e vida
          católica.
        </p>
      </header>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-2">
            <Link
              href={buildLibraryHref({ tab: "geral", type: selectedType, query })}
              className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                tab === "geral"
                  ? "bg-[#003366] text-white"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
              }`}
            >
              Biblioteca Geral
            </Link>
            <Link
              href={buildLibraryHref({ tab: "santa-igreja", type: selectedType, query })}
              className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                tab === "santa-igreja"
                  ? "bg-[#003366] text-white"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
              }`}
            >
              Santa Igreja
            </Link>
          </div>

          <div className="h-7 w-px bg-zinc-200" aria-hidden />

          <div className="flex flex-wrap gap-2">
            {RESOURCE_TYPES.map((item) => (
              <Link
                key={item.value}
                href={buildLibraryHref({ tab, type: item.value, query })}
                className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                  selectedType === item.value
                    ? "bg-sky-700 text-white"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        <form action="/biblioteca" className="mt-4 grid gap-3 lg:grid-cols-[2fr,auto]">
          <input type="hidden" name="aba" value={tab} />
          <input type="hidden" name="tipo" value={selectedType} />
          <label className="sr-only" htmlFor="busca-biblioteca">
            Buscar por conteúdo
          </label>
          <input
            id="busca-biblioteca"
            type="text"
            name="q"
            defaultValue={query}
            placeholder="Busque por título, tema, santo, doutrina..."
            className="w-full rounded-xl border border-sky-300 bg-white px-3 py-2 text-sm text-zinc-800 outline-none ring-sky-500 focus:ring"
          />

          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-800"
          >
            <SparkIcon className="mr-2 size-4" /> Buscar
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        {databaseSetupError ? (
          <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {databaseSetupError}
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-zinc-900">
            {resources.length} publicação(ões) encontrada(s)
          </h2>
          {tab === "santa-igreja" ? (
            <span className="rounded-full border border-emerald-300 bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
              Fontes oficiais
            </span>
          ) : null}
        </div>

        {categories.length > 0 ? (
          <p className="mt-2 text-xs text-zinc-500">
            Categorias ativas: {categories.map((item) => item.name).join(" · ")}
          </p>
        ) : null}

        {resources.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-600">
            Nenhum conteúdo encontrado com os filtros atuais.
          </p>
        ) : (
          <ul className="mt-4 grid gap-3">
            {resources.map((resource) => (
              <li key={resource.id} className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-800">
                    {resource.resourceType}
                  </span>
                  {resource.isOfficialChurchSource ? (
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                      Santa Igreja
                    </span>
                  ) : null}
                </div>

                <h3 className="mt-3 text-base font-semibold text-zinc-900">{resource.title}</h3>

                {resource.summary ? (
                  <p className="mt-1 text-sm text-zinc-700">{resource.summary}</p>
                ) : null}

                {resource.categories.length > 0 ? (
                  <p className="mt-2 text-xs text-zinc-500">
                    {resource.categories.map((item) => item.name).join(" · ")}
                  </p>
                ) : null}

                {resource.resourceType === "article" ? (
                  <p className="mt-2 text-xs text-zinc-600">
                    Por {resource.authorName ?? resource.authorEmail ?? "Equipe editorial"}
                    {" · "}
                    Publicado em {formatArticleDate(resource.publishedAt ?? resource.createdAt) ?? "—"}
                  </p>
                ) : null}

                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="text-xs text-zinc-500">{resource.sourceName ?? "Fonte interna"}</span>
                  <Link
                    href={`/biblioteca/${resource.slug}`}
                    className="text-sm font-semibold text-sky-700 hover:text-sky-900"
                  >
                    Abrir conteúdo
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
