import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    name: text("name"),
    email: text("email").notNull(),
    passwordHash: text("password_hash"),
    failedLoginAttempts: integer("failed_login_attempts").default(0).notNull(),
    lockedUntil: timestamp("locked_until", { mode: "date" }),
    emailVerified: timestamp("email_verified", { mode: "date" }),
    image: text("image"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    emailUnique: uniqueIndex("users_email_unique").on(table.email),
  }),
);

export const accounts = pgTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (table) => ({
    providerProviderAccountIdPk: uniqueIndex("accounts_provider_provider_account_id_unique").on(
      table.provider,
      table.providerAccountId,
    ),
  }),
);

export const sessions = pgTable(
  "sessions",
  {
    sessionToken: text("session_token").notNull().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (table) => ({
    userIdx: index("sessions_user_id_idx").on(table.userId),
  }),
);

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (table) => ({
    tokenUnique: uniqueIndex("verification_tokens_token_unique").on(table.token),
    identifierTokenUnique: uniqueIndex("verification_tokens_identifier_token_unique").on(
      table.identifier,
      table.token,
    ),
  }),
);

export const journalEntries = pgTable(
  "journal_entries",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 120 }),
    content: text("content").notNull(),
    isPrivate: boolean("is_private").default(true).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    userCreatedIdx: index("journal_entries_user_created_idx").on(
      table.userId,
      table.createdAt,
    ),
  }),
);

export const bibleVersions = pgTable("bible_versions", {
  id: text("id").primaryKey(),
  name: varchar("name", { length: 80 }).notNull(),
  language: varchar("language", { length: 12 }).notNull(),
  isDefault: boolean("is_default").default(false).notNull(),
});

export const bibleBooks = pgTable(
  "bible_books",
  {
    id: text("id").primaryKey(),
    order: integer("order").notNull(),
    testament: varchar("testament", { length: 4 }).notNull(),
    name: varchar("name", { length: 80 }).notNull(),
    abbreviation: varchar("abbreviation", { length: 12 }).notNull(),
  },
  (table) => ({
    orderUnique: uniqueIndex("bible_books_order_unique").on(table.order),
  }),
);

export const bibleVerses = pgTable(
  "bible_verses",
  {
    id: text("id").primaryKey(),
    versionId: text("version_id")
      .notNull()
      .references(() => bibleVersions.id, { onDelete: "cascade" }),
    bookId: text("book_id")
      .notNull()
      .references(() => bibleBooks.id, { onDelete: "cascade" }),
    chapter: integer("chapter").notNull(),
    verse: integer("verse").notNull(),
    text: text("text").notNull(),
  },
  (table) => ({
    verseLookupIdx: index("bible_verses_lookup_idx").on(
      table.versionId,
      table.bookId,
      table.chapter,
      table.verse,
    ),
  }),
);

export const verseNotes = pgTable(
  "verse_notes",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    versionId: text("version_id")
      .notNull()
      .references(() => bibleVersions.id, { onDelete: "cascade" }),
    bookId: text("book_id")
      .notNull()
      .references(() => bibleBooks.id, { onDelete: "cascade" }),
    chapter: integer("chapter").notNull(),
    verse: integer("verse").notNull(),
    contentHtml: text("content_html").notNull(),
    color: varchar("color", { length: 24 }).default("amber").notNull(),
    isPinned: boolean("is_pinned").default(false).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    userChapterIdx: index("verse_notes_user_chapter_idx").on(
      table.userId,
      table.versionId,
      table.bookId,
      table.chapter,
      table.updatedAt,
    ),
    userVerseIdx: index("verse_notes_user_verse_idx").on(
      table.userId,
      table.versionId,
      table.bookId,
      table.chapter,
      table.verse,
      table.updatedAt,
    ),
  }),
);

export const mutationIdempotency = pgTable(
  "mutation_idempotency",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    actionType: varchar("action_type", { length: 80 }).notNull(),
    actionKey: text("action_key").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  },
  (table) => ({
    userActionKeyUnique: uniqueIndex("mutation_idempotency_user_action_key_unique").on(
      table.userId,
      table.actionType,
      table.actionKey,
    ),
    userExpiresIdx: index("mutation_idempotency_user_expires_idx").on(
      table.userId,
      table.expiresAt,
    ),
  }),
);
