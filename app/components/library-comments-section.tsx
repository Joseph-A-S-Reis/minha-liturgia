import Link from "next/link";
import { InteractiveSubmitButton } from "@/app/components/interactive-submit-button";
import { LibraryCommentItem } from "@/app/components/library-comment-item";
import type { LibraryPublishAccess } from "@/lib/library-access";
import type { LibraryResourceComment } from "@/lib/library-repository";
import {
  createLibraryCommentAction,
} from "@/app/biblioteca/actions";
import {
  canDeleteOwnLibraryComment,
  canEditOwnLibraryComment,
} from "@/lib/library-access";

type LibraryCommentsSectionProps = {
  resourceId: string;
  comments: LibraryResourceComment[];
  sessionUserId: string | null;
  access: LibraryPublishAccess;
  canInteract: boolean;
  isAuthenticated: boolean;
};

function formatCommentDate(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(value);
}

function getCommentInitials(input: { authorName: string | null; authorEmail: string | null }) {
  const source = input.authorName?.trim() || input.authorEmail?.trim() || "U";
  const parts = source
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export function LibraryCommentsSection({
  resourceId,
  comments,
  sessionUserId,
  access,
  canInteract,
  isAuthenticated,
}: LibraryCommentsSectionProps) {
  async function handleCreateComment(formData: FormData) {
    "use server";

    await createLibraryCommentAction({
      resourceId,
      content: String(formData.get("content") ?? ""),
      idempotencyKey: crypto.randomUUID(),
    });
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Comentários</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Partilhe sua reflexão com caridade, clareza e objetividade.
          </p>
        </div>
        <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-600">
          {comments.length} comentário(s)
        </span>
      </div>

      {isAuthenticated && canInteract ? (
        <form
          action={handleCreateComment}
          className="mt-4 space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <label
                htmlFor="new-library-comment"
                className="block text-sm font-medium text-zinc-800"
              >
                Deixe seu comentário
              </label>
              <p className="mt-1 text-xs text-zinc-500">
                Comentários são públicos nesta publicação.
              </p>
            </div>
            <span className="text-xs text-zinc-400">mín. 3 · máx. 4000 caracteres</span>
          </div>
          <textarea
            id="new-library-comment"
            name="content"
            rows={4}
            required
            minLength={3}
            maxLength={4000}
            placeholder="Partilhe sua reflexão com caridade e objetividade."
            className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800 outline-none ring-sky-500 focus:ring"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-zinc-500">Seu nome e a data da publicação serão exibidos.</p>
            <InteractiveSubmitButton
              idleLabel="Publicar comentário"
              pendingLabel="Publicando..."
              className="inline-flex items-center rounded-lg bg-sky-700 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-800"
            />
          </div>
        </form>
      ) : !isAuthenticated ? (
        <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
          <Link href="/entrar" className="font-semibold text-sky-700 hover:text-sky-900">
            Entre na sua conta
          </Link>{" "}
          para comentar nesta publicação.
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          Você não pode comentar em conteúdos da própria autoria se possuir papel de administração ou curadoria.
        </p>
      )}

      {comments.length === 0 ? (
        <p className="mt-5 text-sm text-zinc-600">Ainda não há comentários nesta publicação.</p>
      ) : (
        <ul className="mt-5 grid gap-3">
          {comments.map((comment) => {
            const canEdit =
              sessionUserId !== null &&
              canEditOwnLibraryComment({
                userId: sessionUserId,
                commentUserId: comment.userId,
                access,
              });
            const canDelete =
              sessionUserId !== null &&
              canDeleteOwnLibraryComment({
                userId: sessionUserId,
                commentUserId: comment.userId,
                access,
              });
            const authorLabel = comment.authorName ?? comment.authorEmail ?? "Usuário";
            const initials = getCommentInitials({
              authorName: comment.authorName,
              authorEmail: comment.authorEmail,
            });

            return (
              <LibraryCommentItem
                key={comment.id}
                commentId={comment.id}
                initialContent={comment.content}
                authorLabel={authorLabel}
                initials={initials}
                createdAtLabel={formatCommentDate(comment.createdAt)}
                authorImage={comment.authorImage}
                devotionSaint={comment.authorDevotionSaint}
                communityName={comment.authorCommunityName}
                isEdited={comment.updatedAt.getTime() !== comment.createdAt.getTime()}
                canEdit={canEdit}
                canDelete={canDelete}
              />
            );
          })}
        </ul>
      )}
    </section>
  );
}
