export const NOTE_COLORS = ["amber", "sky", "emerald", "rose", "violet"] as const;

export type NoteColor = (typeof NOTE_COLORS)[number];

export type VerseNoteRecord = {
  id: string;
  userId: string;
  versionId: string;
  bookId: string;
  chapter: number;
  verse: number;
  contentHtml: string;
  color: NoteColor;
  isPinned: boolean;
  createdAt: Date;
  updatedAt: Date;
};
