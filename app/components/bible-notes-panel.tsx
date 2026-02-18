"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Highlight from "@tiptap/extension-highlight";
import LinkExtension from "@tiptap/extension-link";
import Mention from "@tiptap/extension-mention";
import Placeholder from "@tiptap/extension-placeholder";
import StarterKit from "@tiptap/starter-kit";
import { EditorContent, useEditor } from "@tiptap/react";
import { type SuggestionKeyDownProps, type SuggestionProps } from "@tiptap/suggestion";
import {
  createVerseNoteAction,
  deleteVerseNoteAction,
  getVerseNotesForChapterAction,
  updateVerseNoteAction,
} from "@/app/biblia/note-actions";
import {
  suggestBibleReferences,
  type BibleReferenceSuggestion,
} from "@/lib/bible-reference";
import {
  NOTE_COLORS,
  type NoteColor,
  type VerseNoteRecord,
} from "@/lib/verse-notes-shared";

type VerseOption = {
  verse: number;
  text: string;
};

type BibleNotesPanelProps = {
  versionId: string;
  bookId: string;
  bookName: string;
  chapter: number;
  verses: VerseOption[];
  initialNotes: VerseNoteRecord[];
  isAuthenticated: boolean;
};

type MentionItem = {
  id: string;
  label: string;
  verse: number;
  text: string;
};

type SaveState = "idle" | "typing" | "saving" | "saved" | "error";

type PendingNoteMutation =
  | {
      id: string;
      type: "create";
      payload: {
        versionId: string;
        bookId: string;
        chapter: number;
        verse: number;
        contentHtml: string;
        color: NoteColor;
      };
    }
  | {
      id: string;
      type: "update";
      payload: {
        id: string;
        versionId: string;
        bookId: string;
        chapter: number;
        contentHtml?: string;
        color?: NoteColor;
        isPinned?: boolean;
      };
    }
  | {
      id: string;
      type: "delete";
      payload: {
        id: string;
        versionId: string;
        bookId: string;
        chapter: number;
      };
    };

type NoteListMode = "all" | "pinned";

type NoteSortMode = "pinned-recent" | "recent" | "oldest" | "verse";

type NoteScopeMode = "selected" | "chapter";

const colorClasses: Record<NoteColor, string> = {
  amber: "border-amber-300 bg-amber-50 text-amber-950",
  sky: "border-sky-300 bg-sky-50 text-sky-950",
  emerald: "border-emerald-300 bg-emerald-50 text-emerald-950",
  rose: "border-rose-300 bg-rose-50 text-rose-950",
  violet: "border-violet-300 bg-violet-50 text-violet-950",
};

const NOTE_MUTATION_FALLBACK_KEY = "minha-liturgia:notes:pending-writes";

function readPendingNoteMutations(): PendingNoteMutation[] {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(NOTE_MUTATION_FALLBACK_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as PendingNoteMutation[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writePendingNoteMutations(queue: PendingNoteMutation[]) {
  if (typeof window === "undefined") {
    return;
  }

  if (queue.length === 0) {
    window.localStorage.removeItem(NOTE_MUTATION_FALLBACK_KEY);
    return;
  }

  window.localStorage.setItem(NOTE_MUTATION_FALLBACK_KEY, JSON.stringify(queue));
}

function getVerseFromHash() {
  if (typeof window === "undefined") return null;

  const hash = window.location.hash;
  if (!hash.startsWith("#v")) return null;

  const value = Number(hash.replace("#v", ""));
  if (!Number.isInteger(value) || value <= 0) return null;

  return value;
}

function formatRelativeDate(date: Date | string) {
  const parsed = typeof date === "string" ? new Date(date) : date;

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function toDateValue(input: Date | string) {
  return typeof input === "string" ? new Date(input) : input;
}

function createMentionSuggestionRenderer() {
  let popup: HTMLDivElement | null = null;
  let selectedIndex = 0;
  let suggestionItems: MentionItem[] = [];
  let command: SuggestionProps<MentionItem>["command"] | null = null;

  const destroyPopup = () => {
    if (popup && popup.parentNode) {
      popup.parentNode.removeChild(popup);
    }

    popup = null;
  };

  const paintPopup = (props: SuggestionProps<MentionItem>) => {
    const rect = props.clientRect?.();
    if (!rect && typeof window === "undefined") return;

    const isMobileViewport = typeof window !== "undefined" && window.innerWidth < 768;

    if (!popup) {
      popup = document.createElement("div");
      popup.className =
        "z-[120] min-w-60 max-w-72 overflow-hidden rounded-xl border border-sky-200 bg-white shadow-xl";
      document.body.appendChild(popup);
    }

    popup.style.position = "fixed";
    if (isMobileViewport) {
      popup.style.left = "0.75rem";
      popup.style.right = "0.75rem";
      popup.style.bottom = "1rem";
      popup.style.top = "auto";
      popup.style.maxHeight = "36vh";
      popup.style.overflowY = "auto";
      popup.style.width = "auto";
      popup.style.minWidth = "0";
    } else {
      if (!rect) return;
      popup.style.left = `${rect.left}px`;
      popup.style.top = `${rect.bottom + 6}px`;
      popup.style.right = "auto";
      popup.style.bottom = "auto";
      popup.style.width = "18rem";
      popup.style.maxHeight = "20rem";
      popup.style.overflowY = "auto";
    }

    popup.innerHTML = suggestionItems
      .map((item, index) => {
        const isActive = index === selectedIndex;
        return `
          <button
            data-mention-index="${index}"
            class="flex w-full flex-col items-start gap-0.5 border-b border-zinc-100 px-3 py-2 text-left text-xs ${
              isActive ? "bg-sky-100 text-sky-900" : "bg-white text-zinc-700"
            }"
            type="button"
          >
            <span class="font-semibold">@${item.label}</span>
            <span class="text-[11px] text-zinc-500">${item.text.slice(0, 66)}${item.text.length > 66 ? "..." : ""}</span>
          </button>
        `;
      })
      .join("");

    popup.querySelectorAll<HTMLButtonElement>("[data-mention-index]").forEach((button) => {
      button.onclick = () => {
        const rawIndex = button.getAttribute("data-mention-index");
        if (!rawIndex || !command) return;

        const index = Number(rawIndex);
        const item = suggestionItems[index];
        if (!item) return;

        command({ id: item.id, label: item.label });
      };
    });
  };

  const commitSelection = () => {
    const item = suggestionItems[selectedIndex];
    if (!item || !command) return false;

    command({ id: item.id, label: item.label });
    return true;
  };

  return {
    onStart: (props: SuggestionProps<MentionItem>) => {
      suggestionItems = props.items;
      selectedIndex = 0;
      command = props.command;
      paintPopup(props);
    },
    onUpdate: (props: SuggestionProps<MentionItem>) => {
      suggestionItems = props.items;
      selectedIndex = 0;
      command = props.command;

      if (suggestionItems.length === 0) {
        destroyPopup();
        return;
      }

      paintPopup(props);
    },
    onKeyDown: (props: SuggestionKeyDownProps) => {
      if (!popup) return false;

      if (props.event.key === "ArrowDown") {
        selectedIndex = (selectedIndex + 1) % Math.max(1, suggestionItems.length);
        paintPopup(props as unknown as SuggestionProps<MentionItem>);
        return true;
      }

      if (props.event.key === "ArrowUp") {
        selectedIndex = (selectedIndex + Math.max(1, suggestionItems.length) - 1) % Math.max(1, suggestionItems.length);
        paintPopup(props as unknown as SuggestionProps<MentionItem>);
        return true;
      }

      if (props.event.key === "Enter") {
        return commitSelection();
      }

      if (props.event.key === "Escape") {
        destroyPopup();
        return true;
      }

      return false;
    },
    onExit: () => {
      destroyPopup();
      suggestionItems = [];
      selectedIndex = 0;
      command = null;
    },
  };
}

export function BibleNotesPanel({
  versionId,
  bookId,
  bookName,
  chapter,
  verses,
  initialNotes,
  isAuthenticated,
}: BibleNotesPanelProps) {
  const [notes, setNotes] = useState(initialNotes);
  const [selectedVerse, setSelectedVerse] = useState(() => getVerseFromHash() ?? verses[0]?.verse ?? 1);
  const [draftColor, setDraftColor] = useState<NoteColor>("amber");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [referenceSuggestions, setReferenceSuggestions] = useState<BibleReferenceSuggestion[]>([]);
  const [referenceRange, setReferenceRange] = useState<{ from: number; to: number } | null>(null);
  const [autosaveSeq, setAutosaveSeq] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [listMode, setListMode] = useState<NoteListMode>("all");
  const [listColorFilter, setListColorFilter] = useState<"all" | NoteColor>("all");
  const [listSortMode, setListSortMode] = useState<NoteSortMode>("pinned-recent");
  const [noteScope, setNoteScope] = useState<NoteScopeMode>("selected");
  const [noteQuery, setNoteQuery] = useState("");
  const [visibleNoteLimit, setVisibleNoteLimit] = useState(20);
  const [hasExternalConflict, setHasExternalConflict] = useState(false);
  const [pendingMutationCount, setPendingMutationCount] = useState(0);
  const [isPending, startTransition] = useTransition();
  const hasVerses = verses.length > 0;
  const autosaveTimerRef = useRef<number | null>(null);
  const lastSavedHtmlRef = useRef<string>("");
  const lastSavedColorRef = useRef<NoteColor>("amber");
  const lastKnownUpdatedAtRef = useRef<string>("");

  const mentionItems = useMemo<MentionItem[]>(
    () =>
      verses.map((verse) => ({
        id: String(verse.verse),
        label: `v${verse.verse}`,
        verse: verse.verse,
        text: verse.text,
      })),
    [verses],
  );

  const editor = useEditor({
    extensions: [
      StarterKit,
      Highlight,
      Mention.configure({
        HTMLAttributes: {
          class: "rounded bg-sky-100 px-1 py-0.5 font-semibold text-sky-800",
        },
        renderText({ options, node }) {
          return `${options.suggestion.char}${node.attrs.label ?? node.attrs.id}`;
        },
        renderHTML({ options, node }) {
          const id = String(node.attrs.id ?? "").replace(/[^0-9]/g, "");
          const label = String(node.attrs.label ?? id);
          const href = id ? `/biblia/${versionId}/${bookId}/${chapter}#v${id}` : "#";

          return [
            "a",
            {
              href,
              class: "rounded bg-sky-100 px-1 py-0.5 font-semibold text-sky-800 no-underline",
              "data-type": "mention",
              "data-id": id,
            },
            `${options.suggestion.char}${label}`,
          ];
        },
        suggestion: {
          char: "@",
          allowSpaces: false,
          items: ({ query }) => {
            const cleaned = query.trim().toLowerCase();
            if (!cleaned) return mentionItems.slice(0, 8);

            return mentionItems
              .filter(
                (item) =>
                  item.label.toLowerCase().includes(cleaned) ||
                  item.text.toLowerCase().includes(cleaned),
              )
              .slice(0, 8);
          },
          render: createMentionSuggestionRenderer,
        },
      }),
      Placeholder.configure({
        placeholder:
          "Digite sua nota... use @ para menções e referencie outros trechos do capítulo.",
      }),
      LinkExtension.configure({
        autolink: true,
        openOnClick: false,
        protocols: ["https", "http", "mailto"],
      }),
    ],
    editorProps: {
      attributes: {
        class:
          "min-h-32 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm leading-6 text-zinc-800 outline-none focus:border-sky-400",
      },
    },
    content: "",
    immediatelyRender: false,
    onUpdate: ({ editor: nextEditor }) => {
      const cursor = nextEditor.state.selection.from;
      const beforeCursor = nextEditor.state.doc.textBetween(0, cursor, "\n", "\n");
      const match = /(?:^|[\s;(\[])((?:[1-3]\s*)?[A-Za-zÀ-ÿ.]+(?:\s+(?:dos|das|de|do|da|e|[A-Za-zÀ-ÿ.]+))?\s\d{1,3}(?:\s*[:.,]\s*\d{0,3})?)$/u.exec(
        beforeCursor,
      );

      if (!match) {
        setReferenceSuggestions([]);
        setReferenceRange(null);
        if (editingNoteId) {
          setAutosaveSeq((value) => value + 1);
          setSaveState("typing");
        }
        return;
      }

      const [, query] = match;
      if (!query) {
        setReferenceSuggestions([]);
        setReferenceRange(null);
        if (editingNoteId) {
          setAutosaveSeq((value) => value + 1);
          setSaveState("typing");
        }
        return;
      }

      const from = cursor - query.length;
      const to = cursor;

      const suggestions = suggestBibleReferences(query, versionId, 6);
      setReferenceSuggestions(suggestions);
      setReferenceRange(suggestions.length > 0 ? { from, to } : null);
      if (editingNoteId) {
        setAutosaveSeq((value) => value + 1);
        setSaveState("typing");
      }
    },
  }, [editingNoteId, mentionItems, versionId]);

  const notesByVerse = useMemo(() => {
    const grouped = new Map<number, VerseNoteRecord[]>();

    for (const note of notes) {
      const current = grouped.get(note.verse) ?? [];
      current.push(note);
      grouped.set(note.verse, current);
    }

    return grouped;
  }, [notes]);

  const selectedVerseNotes = notesByVerse.get(selectedVerse) ?? [];

  const chapterVerseNoteStats = useMemo(() => {
    return [...notesByVerse.entries()]
      .map(([verse, verseNotes]) => ({ verse, count: verseNotes.length }))
      .sort((a, b) => a.verse - b.verse);
  }, [notesByVerse]);

  const notesForCurrentScope = useMemo(
    () => (noteScope === "selected" ? selectedVerseNotes : notes),
    [noteScope, notes, selectedVerseNotes],
  );

  const filteredNotesForScope = useMemo(() => {
    const normalizedQuery = noteQuery.trim().toLowerCase();

    return notesForCurrentScope.filter((note) => {
      if (listMode === "pinned" && !note.isPinned) {
        return false;
      }

      if (listColorFilter !== "all" && note.color !== listColorFilter) {
        return false;
      }

      if (normalizedQuery) {
        const plainText = note.contentHtml.replace(/<[^>]+>/g, " ").toLowerCase();
        const byVerse = `v${note.verse}`.includes(normalizedQuery);

        if (!plainText.includes(normalizedQuery) && !byVerse) {
          return false;
        }
      }

      return true;
    });
  }, [listColorFilter, listMode, noteQuery, notesForCurrentScope]);

  const sortedVisibleNotes = useMemo(() => {
    const entries = [...filteredNotesForScope];

    return entries.sort((a, b) => {
      const aTime = toDateValue(a.updatedAt).getTime();
      const bTime = toDateValue(b.updatedAt).getTime();

      if (listSortMode === "verse") {
        if (a.verse !== b.verse) {
          return a.verse - b.verse;
        }

        return bTime - aTime;
      }

      if (listSortMode === "oldest") {
        return aTime - bTime;
      }

      if (listSortMode === "recent") {
        return bTime - aTime;
      }

      if (a.isPinned !== b.isPinned) {
        return a.isPinned ? -1 : 1;
      }

      return bTime - aTime;
    });
  }, [filteredNotesForScope, listSortMode]);

  const paginatedVisibleNotes = useMemo(
    () => sortedVisibleNotes.slice(0, visibleNoteLimit),
    [sortedVisibleNotes, visibleNoteLimit],
  );

  const clearAutosaveTimer = useCallback(() => {
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
  }, []);

  const upsertNoteLocally = useCallback((nextNote: VerseNoteRecord) => {
    setNotes((current) => {
      const index = current.findIndex((item) => item.id === nextNote.id);
      if (index === -1) {
        return [nextNote, ...current];
      }

      const copy = [...current];
      copy[index] = nextNote;
      return copy;
    });
  }, []);

  const removeNoteLocally = useCallback((id: string) => {
    setNotes((current) => current.filter((item) => item.id !== id));
  }, []);

  const enqueuePendingMutation = useCallback((mutation: PendingNoteMutation) => {
    const current = readPendingNoteMutations();
    const next = [mutation, ...current.filter((item) => item.id !== mutation.id)].slice(0, 200);
    writePendingNoteMutations(next);
    setPendingMutationCount(next.length);
  }, []);

  const flushPendingMutations = useCallback(async () => {
    const queue = readPendingNoteMutations();
    if (queue.length === 0) {
      setPendingMutationCount(0);
      return { processed: 0, remaining: 0 };
    }

    const remaining: PendingNoteMutation[] = [];
    let processed = 0;

    for (const mutation of [...queue].reverse()) {
      try {
        if (mutation.type === "create") {
          const created = await createVerseNoteAction({
            ...mutation.payload,
            idempotencyKey: mutation.id,
          });
          upsertNoteLocally(created);
        } else if (mutation.type === "update") {
          const updated = await updateVerseNoteAction({
            ...mutation.payload,
            idempotencyKey: mutation.id,
          });
          if (updated) {
            upsertNoteLocally(updated);
          }
        } else {
          const deleted = await deleteVerseNoteAction({
            ...mutation.payload,
            idempotencyKey: mutation.id,
          });
          if (deleted.ok) {
            removeNoteLocally(mutation.payload.id);
          }
        }

        processed += 1;
      } catch {
        remaining.push(mutation);
      }
    }

    writePendingNoteMutations(remaining);
    setPendingMutationCount(remaining.length);

    return { processed, remaining: remaining.length };
  }, [removeNoteLocally, upsertNoteLocally]);

  const detectExternalConflict = useCallback(
    (nextNotes: VerseNoteRecord[]) => {
      if (!editingNoteId || !editor) {
        setHasExternalConflict(false);
        return;
      }

      const remote = nextNotes.find((note) => note.id === editingNoteId);
      if (!remote) {
        setHasExternalConflict(false);
        return;
      }

      const remoteUpdatedAtIso = toDateValue(remote.updatedAt).toISOString();
      const knownUpdatedAtIso = lastKnownUpdatedAtRef.current;

      const isRemoteNewer = !knownUpdatedAtIso || remoteUpdatedAtIso > knownUpdatedAtIso;
      const hasDifferentBody = remote.contentHtml !== editor.getHTML();

      setHasExternalConflict(isRemoteNewer && hasDifferentBody);
    },
    [editingNoteId, editor],
  );

  const refreshNotes = useCallback(async () => {
    if (!isAuthenticated) return;

    const refreshed = await getVerseNotesForChapterAction({
      versionId,
      bookId,
      chapter,
    });

    setNotes(refreshed);
    detectExternalConflict(refreshed);
    return refreshed;
  }, [bookId, chapter, detectExternalConflict, isAuthenticated, versionId]);

  const resetComposer = useCallback(() => {
    clearAutosaveTimer();
    setEditingNoteId(null);
    setDraftColor("amber");
    setReferenceSuggestions([]);
    setReferenceRange(null);
    setSaveState("idle");
    lastSavedHtmlRef.current = "";
    lastSavedColorRef.current = "amber";
    editor?.commands.clearContent();
  }, [clearAutosaveTimer, editor]);

  useEffect(() => {
    const onHashChange = () => {
      const verse = getVerseFromHash();
      if (verse) {
        setSelectedVerse(verse);
        setVisibleNoteLimit(20);
      }
    };

    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    return () => {
      clearAutosaveTimer();
    };
  }, [clearAutosaveTimer]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const refreshOnFocus = () => {
      void refreshNotes();
    };

    const refreshOnVisibility = () => {
      if (document.visibilityState === "visible") {
        void refreshNotes();
      }
    };

    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnVisibility);

    return () => {
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnVisibility);
    };
  }, [isAuthenticated, refreshNotes]);

  useEffect(() => {
    if (!isAuthenticated) return;

    setPendingMutationCount(readPendingNoteMutations().length);

    const retry = () => {
      void flushPendingMutations().catch(() => {
        // Mantém pendências locais para a próxima tentativa.
      });
    };

    retry();

    const onFocus = () => retry();
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        retry();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [flushPendingMutations, isAuthenticated]);

  const persistEditingNote = useCallback(
    async (trigger: "manual" | "autosave") => {
      if (!editor || !editingNoteId) return false;

      const html = editor.getHTML();
      const plain = editor.getText().trim();

      if (!plain) {
        if (trigger === "manual") {
          setError("A nota está vazia. Escreva algo antes de salvar.");
          setSaveState("error");
        }

        return false;
      }

      const unchanged =
        html === lastSavedHtmlRef.current && draftColor === lastSavedColorRef.current;

      if (unchanged) {
        setSaveState("saved");
        return false;
      }

      setSaveState("saving");
      setError(null);
      const mutationId = crypto.randomUUID();

      try {
        const updated = await updateVerseNoteAction({
          id: editingNoteId,
          versionId,
          bookId,
          chapter,
          contentHtml: html,
          color: draftColor,
          idempotencyKey: mutationId,
        });

        if (!updated) {
          throw new Error("A nota não foi encontrada para atualização.");
        }

        upsertNoteLocally(updated);
        lastSavedHtmlRef.current = updated.contentHtml;
        lastSavedColorRef.current = updated.color;
        lastKnownUpdatedAtRef.current = toDateValue(updated.updatedAt).toISOString();
        setHasExternalConflict(false);
        setSaveState("saved");
        return true;
      } catch (cause) {
        enqueuePendingMutation({
          id: mutationId,
          type: "update",
          payload: {
            id: editingNoteId,
            versionId,
            bookId,
            chapter,
            contentHtml: html,
            color: draftColor,
          },
        });
        setSaveState("error");
        setError(
          cause instanceof Error
            ? `${cause.message} (Rascunho salvo localmente para sincronização automática.)`
            : "Não foi possível salvar a nota. Rascunho salvo localmente para sincronização automática.",
        );
        return false;
      }
    },
    [
      bookId,
      chapter,
      draftColor,
      enqueuePendingMutation,
      editingNoteId,
      editor,
      upsertNoteLocally,
      versionId,
    ],
  );

  useEffect(() => {
    if (!editingNoteId) return;
    if (saveState !== "typing") return;

    clearAutosaveTimer();
    autosaveTimerRef.current = window.setTimeout(() => {
      void persistEditingNote("autosave");
    }, 900);
  }, [autosaveSeq, clearAutosaveTimer, editingNoteId, persistEditingNote, saveState]);

  useEffect(() => {
    if (!editingNoteId) return;
    setSaveState("typing");
    setAutosaveSeq((value) => value + 1);
  }, [draftColor, editingNoteId]);

  const submitNote = useCallback(() => {
    if (!editor || !isAuthenticated || !hasVerses) return;

    clearAutosaveTimer();

    startTransition(async () => {
      const createMutationId = crypto.randomUUID();

      try {
        if (editingNoteId) {
          await persistEditingNote("manual");
          return;
        }

        const html = editor.getHTML();
        const plain = editor.getText().trim();

        if (!plain) {
          setError("A nota está vazia. Escreva algo antes de salvar.");
          return;
        }

        setError(null);

        const created = await createVerseNoteAction({
          versionId,
          bookId,
          chapter,
          verse: selectedVerse,
          contentHtml: html,
          color: draftColor,
          idempotencyKey: createMutationId,
        });

        upsertNoteLocally(created);
        resetComposer();
      } catch (cause) {
        const html = editor?.getHTML() ?? "";

        if (html.trim()) {
          enqueuePendingMutation({
            id: createMutationId,
            type: "create",
            payload: {
              versionId,
              bookId,
              chapter,
              verse: selectedVerse,
              contentHtml: html,
              color: draftColor,
            },
          });
        }

        setError(
          cause instanceof Error
            ? `${cause.message} (Nota salva localmente e será reenviada automaticamente.)`
            : "Não foi possível salvar a nota. Guardamos localmente para reenviar automaticamente.",
        );
      }
    });
  }, [
    bookId,
    chapter,
    clearAutosaveTimer,
    draftColor,
    enqueuePendingMutation,
    editingNoteId,
    editor,
    hasVerses,
    isAuthenticated,
    persistEditingNote,
    resetComposer,
    selectedVerse,
    startTransition,
    upsertNoteLocally,
    versionId,
  ]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isSaveShortcut = (event.ctrlKey || event.metaKey) && event.key === "Enter";
      if (!isSaveShortcut) return;

      event.preventDefault();
      submitNote();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [submitNote]);

  const loadNoteToEditor = (note: VerseNoteRecord) => {
    clearAutosaveTimer();
    setEditingNoteId(note.id);
    setDraftColor(note.color);
    setSelectedVerse(note.verse);
    setVisibleNoteLimit(20);
    setSaveState("idle");
    lastSavedHtmlRef.current = note.contentHtml;
    lastSavedColorRef.current = note.color;
    lastKnownUpdatedAtRef.current = toDateValue(note.updatedAt).toISOString();
    setHasExternalConflict(false);
    editor?.commands.setContent(note.contentHtml, { emitUpdate: false });
    setError(null);
  };

  const togglePin = (note: VerseNoteRecord) => {
    startTransition(async () => {
      const mutationId = crypto.randomUUID();

      try {
        const updated = await updateVerseNoteAction({
          id: note.id,
          versionId,
          bookId,
          chapter,
          isPinned: !note.isPinned,
          idempotencyKey: mutationId,
        });

        if (updated) {
          upsertNoteLocally(updated);

          if (editingNoteId === updated.id) {
            lastKnownUpdatedAtRef.current = toDateValue(updated.updatedAt).toISOString();
          }
        }
      } catch (cause) {
        enqueuePendingMutation({
          id: mutationId,
          type: "update",
          payload: {
            id: note.id,
            versionId,
            bookId,
            chapter,
            isPinned: !note.isPinned,
          },
        });

        setError(
          cause instanceof Error
            ? `${cause.message} (Mudança salva localmente para sincronização.)`
            : "Falha ao fixar nota. Mudança salva localmente para sincronização.",
        );
      }
    });
  };

  const removeNote = (id: string) => {
    startTransition(async () => {
      const mutationId = crypto.randomUUID();

      try {
        const result = await deleteVerseNoteAction({
          id,
          versionId,
          bookId,
          chapter,
          idempotencyKey: mutationId,
        });

        if (result.ok) {
          removeNoteLocally(id);
        }

        if (editingNoteId === id) {
          resetComposer();
        }
      } catch (cause) {
        enqueuePendingMutation({
          id: mutationId,
          type: "delete",
          payload: {
            id,
            versionId,
            bookId,
            chapter,
          },
        });

        setError(
          cause instanceof Error
            ? `${cause.message} (Exclusão será tentada novamente automaticamente.)`
            : "Falha ao remover nota. A exclusão será tentada novamente automaticamente.",
        );
      }
    });
  };

  const insertMention = () => {
    editor
      ?.chain()
      .focus()
      .insertContent([
        {
          type: "mention",
          attrs: {
            id: String(selectedVerse),
            label: `v${selectedVerse}`,
          },
        },
        { type: "text", text: " " },
      ])
      .run();
  };

  const insertReference = () => {
    editor
      ?.chain()
      .focus()
      .insertContent(
        `<a href="/biblia/${versionId}/${bookId}/${chapter}#v${selectedVerse}">${bookName} ${chapter}:${selectedVerse}</a> `,
      )
      .run();
  };

  const applyReferenceSuggestion = (suggestion: BibleReferenceSuggestion) => {
    if (!editor) return;

    const replacement = `<a href="${suggestion.href}">${suggestion.label}</a> `;

    if (referenceRange) {
      editor.chain().focus().insertContentAt(referenceRange, replacement).run();
    } else {
      editor.chain().focus().insertContent(replacement).run();
    }

    setReferenceSuggestions([]);
    setReferenceRange(null);
  };

  const goToVerse = (verse: number) => {
    setSelectedVerse(verse);
    setVisibleNoteLimit(20);

    if (typeof window !== "undefined") {
      const target = document.getElementById(`v${verse}`);
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
      window.history.replaceState(null, "", `#v${verse}`);
    }
  };

  const reloadEditingFromRemote = () => {
    if (!editingNoteId) return;

    const remote = notes.find((note) => note.id === editingNoteId);
    if (!remote) return;

    loadNoteToEditor(remote);
  };

  const keepLocalDraft = () => {
    const remote = notes.find((note) => note.id === editingNoteId);
    if (remote) {
      lastKnownUpdatedAtRef.current = toDateValue(remote.updatedAt).toISOString();
    }

    setHasExternalConflict(false);
  };

  const saveStateLabel =
    saveState === "typing"
      ? "Alterações pendentes..."
      : saveState === "saving"
        ? "Salvando..."
        : saveState === "saved"
          ? "Salvo automaticamente"
          : saveState === "error"
            ? "Falha no salvamento"
            : "";

  return (
    <aside className="sticky top-8 max-h-[calc(100vh-4rem)] overflow-hidden rounded-2xl border border-sky-200 bg-white/90 shadow-xl backdrop-blur-sm">
      <div className="border-b border-sky-200 bg-sky-50/70 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Notas de Versículo</p>
        <h2 className="text-lg font-bold text-sky-950">Post-its da leitura</h2>
      </div>

      <div className="max-h-[calc(100vh-8.5rem)] space-y-4 overflow-y-auto px-4 py-4">
        <div className="space-y-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
          <label htmlFor="verse-select" className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
            Versículo ativo
          </label>
          <select
            id="verse-select"
            value={selectedVerse}
            onChange={(event) => {
              setSelectedVerse(Number(event.target.value));
              setVisibleNoteLimit(20);
            }}
            disabled={!hasVerses}
            className="w-full rounded-lg border border-zinc-300 bg-white px-2 py-2 text-sm text-zinc-800"
          >
            {verses.map((verse) => (
              <option key={verse.verse} value={verse.verse}>
                v{verse.verse} — {verse.text.slice(0, 52)}
                {verse.text.length > 52 ? "..." : ""}
              </option>
            ))}
          </select>

          {hasVerses ? (
            <div className="flex items-center gap-2 text-xs">
              <a href={`#v${selectedVerse}`} className="font-semibold text-sky-700 hover:underline">
                Ir para v{selectedVerse}
              </a>
              <span className="text-zinc-400">•</span>
              <span className="text-zinc-600">{selectedVerseNotes.length} nota(s) neste versículo</span>
            </div>
          ) : (
            <p className="text-xs font-medium text-zinc-600">
              Sem versículos carregados neste capítulo.
            </p>
          )}

          {chapterVerseNoteStats.length > 0 ? (
            <div className="pt-1">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Mapa rápido de notas no capítulo
              </p>
              <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto pr-1">
                {chapterVerseNoteStats.map((item) => (
                  <button
                    key={item.verse}
                    type="button"
                    onClick={() => goToVerse(item.verse)}
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                      selectedVerse === item.verse
                        ? "border-sky-300 bg-sky-100 text-sky-900"
                        : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"
                    }`}
                  >
                    v{item.verse} · {item.count}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {!isAuthenticated ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Para criar suas notas privadas, faça login.
            <div className="mt-2">
              <Link href="/entrar" className="font-semibold underline">
                Entrar agora
              </Link>
            </div>
          </div>
        ) : hasVerses ? (
          <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-3">
            <div className="flex flex-wrap gap-2">
              <ToolbarButton onClick={() => editor?.chain().focus().toggleBold().run()} active={Boolean(editor?.isActive("bold"))}>
                B
              </ToolbarButton>
              <ToolbarButton onClick={() => editor?.chain().focus().toggleItalic().run()} active={Boolean(editor?.isActive("italic"))}>
                I
              </ToolbarButton>
              <ToolbarButton onClick={() => editor?.chain().focus().toggleStrike().run()} active={Boolean(editor?.isActive("strike"))}>
                S
              </ToolbarButton>
              <ToolbarButton onClick={() => editor?.chain().focus().toggleHighlight().run()} active={Boolean(editor?.isActive("highlight"))}>
                Marca
              </ToolbarButton>
              <ToolbarButton onClick={() => editor?.chain().focus().toggleBulletList().run()} active={Boolean(editor?.isActive("bulletList"))}>
                Lista
              </ToolbarButton>
              <ToolbarButton onClick={() => editor?.chain().focus().toggleBlockquote().run()} active={Boolean(editor?.isActive("blockquote"))}>
                ❝❞
              </ToolbarButton>
              <ToolbarButton onClick={insertMention}>@v</ToolbarButton>
              <ToolbarButton onClick={insertReference}>Ref</ToolbarButton>
            </div>

            <div className="flex flex-wrap gap-2">
              {NOTE_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setDraftColor(color)}
                  className={`rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${
                    draftColor === color ? colorClasses[color] : "border-zinc-300 bg-zinc-50 text-zinc-700"
                  }`}
                >
                  {color}
                </button>
              ))}
            </div>

            <EditorContent editor={editor} />

            {referenceSuggestions.length > 0 ? (
              <div className="rounded-xl border border-sky-200 bg-sky-50 p-2">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-sky-700">
                  Referências sugeridas
                </p>
                <div className="space-y-1">
                  {referenceSuggestions.map((suggestion) => (
                    <button
                      key={`${suggestion.bookId}-${suggestion.chapter}-${suggestion.verse ?? "ch"}`}
                      type="button"
                      onClick={() => applyReferenceSuggestion(suggestion)}
                      className="flex w-full items-center justify-between rounded-lg border border-sky-200 bg-white px-2.5 py-1.5 text-left text-xs text-sky-900 hover:bg-sky-100"
                    >
                      <span className="font-semibold">{suggestion.label}</span>
                      <span className="text-sky-600">Inserir</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {error ? <p className="text-xs font-semibold text-red-700">{error}</p> : null}

            {editingNoteId && saveStateLabel ? (
              <p
                className={`text-xs font-semibold ${
                  saveState === "error"
                    ? "text-red-700"
                    : saveState === "saved"
                      ? "text-emerald-700"
                      : "text-zinc-600"
                }`}
              >
                {saveStateLabel}
              </p>
            ) : null}

            {pendingMutationCount > 0 ? (
              <p className="text-xs font-semibold text-amber-700">
                {pendingMutationCount} alteração(ões) em fila local aguardando sincronização.
              </p>
            ) : null}

            {editingNoteId && hasExternalConflict ? (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900">
                <p className="font-semibold">Conflito detectado: esta nota foi alterada em outra aba.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={reloadEditingFromRemote}
                    className="rounded-md border border-amber-400 bg-white px-2 py-1 font-semibold hover:bg-amber-100"
                  >
                    Usar versão remota
                  </button>
                  <button
                    type="button"
                    onClick={keepLocalDraft}
                    className="rounded-md border border-amber-400 bg-white px-2 py-1 font-semibold hover:bg-amber-100"
                  >
                    Manter meu rascunho
                  </button>
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={submitNote}
                className="rounded-lg bg-sky-700 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {editingNoteId ? "Atualizar nota" : "Criar nota"}
              </button>
              <span className="text-[11px] font-medium text-zinc-500">Atalho: Ctrl/Cmd + Enter</span>
              {editingNoteId ? (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={resetComposer}
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
                >
                  Cancelar edição
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-600">
            O editor será habilitado quando este capítulo tiver versículos disponíveis.
          </div>
        )}

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-zinc-800">
              {noteScope === "selected"
                ? `Notas do versículo ${selectedVerse}`
                : "Notas do capítulo"}
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setNoteScope("selected");
                  setVisibleNoteLimit(20);
                }}
                className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${
                  noteScope === "selected"
                    ? "border-sky-300 bg-sky-100 text-sky-900"
                    : "border-zinc-300 bg-white text-zinc-700"
                }`}
              >
                Versículo ativo
              </button>
              <button
                type="button"
                onClick={() => {
                  setNoteScope("chapter");
                  setVisibleNoteLimit(20);
                }}
                className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${
                  noteScope === "chapter"
                    ? "border-sky-300 bg-sky-100 text-sky-900"
                    : "border-zinc-300 bg-white text-zinc-700"
                }`}
              >
                Todo capítulo
              </button>

              <button
                type="button"
                onClick={() => {
                  setListMode("all");
                  setVisibleNoteLimit(20);
                }}
                className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${
                  listMode === "all"
                    ? "border-sky-300 bg-sky-100 text-sky-900"
                    : "border-zinc-300 bg-white text-zinc-700"
                }`}
              >
                Todas
              </button>
              <button
                type="button"
                onClick={() => {
                  setListMode("pinned");
                  setVisibleNoteLimit(20);
                }}
                className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${
                  listMode === "pinned"
                    ? "border-sky-300 bg-sky-100 text-sky-900"
                    : "border-zinc-300 bg-white text-zinc-700"
                }`}
              >
                Fixadas
              </button>

              <select
                aria-label="Filtrar notas por cor"
                value={listColorFilter}
                onChange={(event) => {
                  setListColorFilter(event.target.value as "all" | NoteColor);
                  setVisibleNoteLimit(20);
                }}
                className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-[11px] font-semibold text-zinc-700"
              >
                <option value="all">Todas as cores</option>
                {NOTE_COLORS.map((color) => (
                  <option key={color} value={color}>
                    Cor: {color}
                  </option>
                ))}
              </select>

              <select
                aria-label="Ordenar notas"
                value={listSortMode}
                onChange={(event) => {
                  setListSortMode(event.target.value as NoteSortMode);
                  setVisibleNoteLimit(20);
                }}
                className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-[11px] font-semibold text-zinc-700"
              >
                <option value="pinned-recent">Fixadas + recentes</option>
                <option value="recent">Mais recentes</option>
                <option value="oldest">Mais antigas</option>
                <option value="verse">Ordem de versículo</option>
              </select>
            </div>
          </div>

          <input
            type="text"
            value={noteQuery}
            onChange={(event) => {
              setNoteQuery(event.target.value);
              setVisibleNoteLimit(20);
            }}
            placeholder="Buscar em notas (texto ou v10)"
            className="w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-2 text-xs text-zinc-800 outline-none focus:border-sky-400"
          />

          {sortedVisibleNotes.length === 0 ? (
            <p className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-600">
              Nenhuma nota encontrada com os filtros aplicados.
            </p>
          ) : (
            paginatedVisibleNotes.map((note) => (
              <article key={note.id} className={`rounded-xl border p-3 ${colorClasses[note.color]}`}>
                <div className="mb-2 flex items-center justify-between gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => goToVerse(note.verse)}
                    className="font-semibold underline"
                  >
                    v{note.verse}
                  </button>
                  <span>{formatRelativeDate(note.updatedAt)}</span>
                </div>

                <div
                  className="prose prose-sm max-w-none text-current [&_a]:font-semibold [&_a]:underline"
                  dangerouslySetInnerHTML={{ __html: note.contentHtml }}
                />

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => loadNoteToEditor(note)}
                    className="rounded-md border border-current/25 px-2 py-1 text-xs font-semibold hover:bg-white/40"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => goToVerse(note.verse)}
                    className="rounded-md border border-current/25 px-2 py-1 text-xs font-semibold hover:bg-white/40"
                  >
                    Ir para versículo
                  </button>
                  <button
                    type="button"
                    onClick={() => togglePin(note)}
                    className="rounded-md border border-current/25 px-2 py-1 text-xs font-semibold hover:bg-white/40"
                  >
                    {note.isPinned ? "Desafixar" : "Fixar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeNote(note.id)}
                    className="rounded-md border border-red-300 bg-red-50 px-2 py-1 text-xs font-semibold text-red-800 hover:bg-red-100"
                  >
                    Excluir
                  </button>
                </div>
              </article>
            ))
          )}

          {paginatedVisibleNotes.length < sortedVisibleNotes.length ? (
            <button
              type="button"
              onClick={() => setVisibleNoteLimit((value) => value + 20)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-100"
            >
              Mostrar mais notas ({sortedVisibleNotes.length - paginatedVisibleNotes.length} restantes)
            </button>
          ) : null}
        </div>
      </div>
    </aside>
  );
}

type ToolbarButtonProps = {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
};

function ToolbarButton({ children, onClick, active = false }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-2 py-1 text-xs font-semibold transition ${
        active
          ? "border-sky-300 bg-sky-100 text-sky-900"
          : "border-zinc-300 bg-zinc-50 text-zinc-700 hover:bg-zinc-100"
      }`}
    >
      {children}
    </button>
  );
}
