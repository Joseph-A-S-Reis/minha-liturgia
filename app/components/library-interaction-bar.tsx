"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BookmarkIcon, HeartIcon, MessageSquareIcon } from "@/app/components/icons";
import { LibraryShareButton } from "@/app/components/library-share-button";
import {
  toggleLibraryBookmarkAction,
  toggleLibraryLikeAction,
} from "@/app/biblioteca/actions";

type LibraryInteractionBarProps = {
  resourceId: string;
  resourceTitle: string;
  resourceUrl: string;
  totalLikes: number;
  totalComments: number;
  isBookmarked: boolean;
  isLiked: boolean;
  canInteract: boolean;
  isAuthenticated: boolean;
};

export function LibraryInteractionBar({
  resourceId,
  resourceTitle,
  resourceUrl,
  totalLikes,
  totalComments,
  isBookmarked,
  isLiked,
  canInteract,
  isAuthenticated,
}: LibraryInteractionBarProps) {
  const router = useRouter();
  const [likedState, setLikedState] = useState(isLiked);
  const [bookmarkedState, setBookmarkedState] = useState(isBookmarked);
  const [likesCountState, setLikesCountState] = useState(totalLikes);
  const [pendingAction, setPendingAction] = useState<"bookmark" | "like" | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setLikedState(isLiked);
  }, [isLiked]);

  useEffect(() => {
    setBookmarkedState(isBookmarked);
  }, [isBookmarked]);

  useEffect(() => {
    setLikesCountState(totalLikes);
  }, [totalLikes]);

  const isDisabled = !isAuthenticated || !canInteract || pendingAction !== null;
  const actionButtonClass =
    "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition";

  async function handleBookmark() {
    if (isDisabled) return;

    const previousBookmarked = bookmarkedState;
    setErrorMessage(null);
    setPendingAction("bookmark");
    setBookmarkedState(!previousBookmarked);

    try {
      const result = await toggleLibraryBookmarkAction({
        resourceId,
        idempotencyKey: crypto.randomUUID(),
      });

      if (!result.ok) {
        throw new Error("Não foi possível atualizar os favoritos.");
      }

      const nextBookmarkedState =
        typeof result.bookmarked === "boolean" ? result.bookmarked : !previousBookmarked;

      setBookmarkedState(Boolean(nextBookmarkedState));
      router.refresh();
    } catch (error) {
      console.error("[library:bookmark] falha ao atualizar favorito", error);
      setBookmarkedState(previousBookmarked);
      setErrorMessage("Não foi possível atualizar favoritos agora.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleLike() {
    if (isDisabled) return;

    const previousLiked = likedState;
    const previousLikesCount = likesCountState;
    const nextLiked = !previousLiked;
    const nextLikesCount = Math.max(0, previousLikesCount + (nextLiked ? 1 : -1));

    setErrorMessage(null);
    setPendingAction("like");
    setLikedState(nextLiked);
    setLikesCountState(nextLikesCount);

    try {
      const result = await toggleLibraryLikeAction({
        resourceId,
        idempotencyKey: crypto.randomUUID(),
      });

      if (!result.ok) {
        throw new Error("Não foi possível registrar a curtida.");
      }

      const nextLikedState = typeof result.liked === "boolean" ? result.liked : nextLiked;

      setLikedState(Boolean(nextLikedState));
      setLikesCountState(result.totalLikes ?? nextLikesCount);
      router.refresh();
    } catch (error) {
      console.error("[library:like] falha ao atualizar curtida", error);
      setLikedState(previousLiked);
      setLikesCountState(previousLikesCount);
      setErrorMessage("Não foi possível atualizar a curtida agora.");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleBookmark}
            disabled={isDisabled}
            className={`${actionButtonClass} ${
              bookmarkedState
                ? "border-amber-300 bg-amber-50 text-amber-800"
                : "border-zinc-300 bg-white text-zinc-700 hover:border-amber-300 hover:text-amber-800"
            } ${isDisabled ? "cursor-not-allowed opacity-60" : ""}`}
          >
            <BookmarkIcon className="size-4" />
            {pendingAction === "bookmark"
              ? "Salvando..."
              : bookmarkedState
                ? "Favoritado"
                : "Favoritar"}
          </button>

          <button
            type="button"
            onClick={handleLike}
            disabled={isDisabled}
            className={`${actionButtonClass} ${
              likedState
                ? "border-rose-300 bg-rose-50 text-rose-700"
                : "border-zinc-300 bg-white text-zinc-700 hover:border-rose-300 hover:text-rose-700"
            } ${isDisabled ? "cursor-not-allowed opacity-60" : ""}`}
          >
            <HeartIcon className="size-4" />
            {pendingAction === "like"
              ? `Atualizando... (${likesCountState})`
              : `${likedState ? "Curtido" : "Curtir"} (${likesCountState})`}
          </button>

          <div className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
            <MessageSquareIcon className="size-4" /> {totalComments} comentário(s)
          </div>
        </div>

        <LibraryShareButton
          title={resourceTitle}
          url={resourceUrl}
          className="inline-flex items-center gap-2 rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800 hover:bg-sky-100"
        />
      </div>

      {errorMessage ? <p className="mt-3 text-sm text-red-700">{errorMessage}</p> : null}

      {!isAuthenticated ? (
        <p className="mt-3 text-sm text-zinc-600">
          <Link href="/entrar" className="font-semibold text-sky-700 hover:text-sky-900">
            Entre na sua conta
          </Link>{" "}
          para favoritar, curtir e comentar.
        </p>
      ) : !canInteract ? (
        <p className="mt-3 text-sm text-amber-700">
          Administradores e curadores não podem interagir com conteúdos da própria autoria.
        </p>
      ) : null}
    </section>
  );
}
