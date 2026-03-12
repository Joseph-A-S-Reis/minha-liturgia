"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  deleteLibraryCommentAction,
  updateLibraryCommentAction,
} from "@/app/biblioteca/actions";

type LibraryCommentItemProps = {
  commentId: string;
  initialContent: string;
  authorLabel: string;
  initials: string;
  createdAtLabel: string;
  authorImage: string | null;
  devotionSaint: string | null;
  communityName: string | null;
  isEdited: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

export function LibraryCommentItem({
  commentId,
  initialContent,
  authorLabel,
  initials,
  createdAtLabel,
  authorImage,
  devotionSaint,
  communityName,
  isEdited,
  canEdit,
  canDelete,
}: LibraryCommentItemProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(initialContent);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const editFieldId = `comment-edit-textarea-${commentId}`;

  async function handleSave() {
    if (isSaving || isDeleting) return;

    const normalizedDraft = draft.trim();
    if (normalizedDraft.length < 3) {
      setErrorMessage("O comentário precisa ter ao menos 3 caracteres.");
      return;
    }

    setErrorMessage(null);
    setIsSaving(true);

    try {
      const result = await updateLibraryCommentAction({
        commentId,
        content: normalizedDraft,
        idempotencyKey: crypto.randomUUID(),
      });

      if (!result.ok) {
        throw new Error("Não foi possível salvar a edição.");
      }

      setIsEditing(false);
      router.refresh();
    } catch (error) {
      console.error("[library:comment] falha ao salvar edição", error);
      setErrorMessage("Não foi possível salvar a edição agora.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (isSaving || isDeleting) return;

    const confirmed = window.confirm("Deseja realmente excluir este comentário?");
    if (!confirmed) return;

    setErrorMessage(null);
    setIsDeleting(true);

    try {
      const result = await deleteLibraryCommentAction({
        commentId,
        idempotencyKey: crypto.randomUUID(),
      });

      if (!result.ok) {
        throw new Error("Não foi possível excluir o comentário.");
      }

      router.refresh();
    } catch (error) {
      console.error("[library:comment] falha ao excluir comentário", error);
      setErrorMessage("Não foi possível excluir o comentário agora.");
    } finally {
      setIsDeleting(false);
    }
  }

  function handleCancelEdit() {
    setDraft(initialContent);
    setErrorMessage(null);
    setIsEditing(false);
  }

  return (
    <li className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        {authorImage ? (
          <Image
            src={authorImage}
            alt={`Foto de perfil de ${authorLabel}`}
            width={40}
            height={40}
            unoptimized
            className="size-10 shrink-0 rounded-full border border-zinc-200 bg-zinc-100 object-cover shadow-sm"
          />
        ) : (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-sky-200 bg-sky-50 text-xs font-bold text-sky-800">
            {initials}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-zinc-900">{authorLabel}</p>
              {(devotionSaint || communityName) ? (
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {devotionSaint ? (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                      Devoto de {devotionSaint}
                    </span>
                  ) : null}
                  {communityName ? (
                    <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-600">
                      Frequenta a {communityName}
                    </span>
                  ) : null}
                </div>
              ) : null}
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                <span>{createdAtLabel}</span>
                {isEdited ? (
                  <span className="rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[11px] font-medium text-zinc-500">
                    editado
                  </span>
                ) : null}
              </div>
            </div>

            {(canEdit || canDelete) && !isEditing ? (
              <div className="flex flex-wrap items-center gap-2">
                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMessage(null);
                      setIsEditing(true);
                    }}
                    disabled={isSaving || isDeleting}
                    className="inline-flex items-center rounded-lg border border-sky-300 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-800 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Editar comentário
                  </button>
                ) : null}

                {canDelete ? (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isSaving || isDeleting}
                    className="inline-flex items-center rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isDeleting ? "Excluindo..." : "Excluir comentário"}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          {isEditing ? (
            <div className="mt-3 rounded-xl border border-zinc-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Editar comentário
                </p>
                <span className="text-xs text-zinc-400">mín. 3 · máx. 4000 caracteres</span>
              </div>

              <label htmlFor={editFieldId} className="sr-only">
                Editar comentário de {authorLabel}
              </label>

              <textarea
                id={editFieldId}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                rows={5}
                minLength={3}
                maxLength={4000}
                className="mt-3 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800 outline-none ring-sky-500 focus:ring"
              />

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-zinc-500">Revise com calma antes de salvar a edição.</p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                    className="inline-flex items-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving}
                    className="inline-flex items-center rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSaving ? "Salvando..." : "Salvar edição"}
                  </button>
                </div>
              </div>

              {canDelete ? (
                <div className="mt-3 border-t border-zinc-100 pt-3">
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isSaving || isDeleting}
                    className="inline-flex items-center rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isDeleting ? "Excluindo..." : "Excluir comentário"}
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-800">
              {initialContent}
            </p>
          )}

          {errorMessage ? <p className="mt-3 text-sm text-red-700">{errorMessage}</p> : null}
        </div>
      </div>
    </li>
  );
}
