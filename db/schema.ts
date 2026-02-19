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

export const userEvents = pgTable(
  "user_events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 160 }).notNull(),
    message: text("message"),
    startAt: timestamp("start_at", { mode: "date" }).notNull(),
    endAt: timestamp("end_at", { mode: "date" }),
    allDay: boolean("all_day").default(true).notNull(),
    timezone: varchar("timezone", { length: 80 }).default("America/Sao_Paulo").notNull(),
    recurrence: varchar("recurrence", { length: 16 }).default("none").notNull(),
    recurrenceInterval: integer("recurrence_interval").default(1).notNull(),
    recurrenceUntil: timestamp("recurrence_until", { mode: "date" }),
    source: varchar("source", { length: 16 }).default("custom").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    userStartIdx: index("user_events_user_start_idx").on(table.userId, table.startAt),
    userUpdatedIdx: index("user_events_user_updated_idx").on(table.userId, table.updatedAt),
  }),
);

export const eventReminders = pgTable(
  "event_reminders",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id")
      .notNull()
      .references(() => userEvents.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    remindBeforeMinutes: integer("remind_before_minutes").notNull(),
    channel: varchar("channel", { length: 16 }).default("push").notNull(),
    isEnabled: boolean("is_enabled").default(true).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    eventReminderUnique: uniqueIndex("event_reminders_event_channel_before_unique").on(
      table.eventId,
      table.channel,
      table.remindBeforeMinutes,
    ),
    userEnabledIdx: index("event_reminders_user_enabled_idx").on(
      table.userId,
      table.isEnabled,
    ),
  }),
);

export const notificationPreferences = pgTable("notification_preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  timezone: varchar("timezone", { length: 80 }).default("America/Sao_Paulo").notNull(),
  emailEnabled: boolean("email_enabled").default(true).notNull(),
  pushEnabled: boolean("push_enabled").default(true).notNull(),
  quietHoursStart: integer("quiet_hours_start"),
  quietHoursEnd: integer("quiet_hours_end"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    contentEncoding: varchar("content_encoding", { length: 24 }).default("aes128gcm").notNull(),
    userAgent: text("user_agent"),
    lastSeenAt: timestamp("last_seen_at", { mode: "date" }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    endpointUnique: uniqueIndex("push_subscriptions_endpoint_unique").on(table.endpoint),
    userUpdatedIdx: index("push_subscriptions_user_updated_idx").on(
      table.userId,
      table.updatedAt,
    ),
  }),
);

export const icsTokens = pgTable(
  "ics_tokens",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    description: varchar("description", { length: 140 }),
    lastUsedAt: timestamp("last_used_at", { mode: "date" }),
    revokedAt: timestamp("revoked_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { mode: "date" }),
  },
  (table) => ({
    tokenHashUnique: uniqueIndex("ics_tokens_token_hash_unique").on(table.tokenHash),
    userRevokedIdx: index("ics_tokens_user_revoked_idx").on(table.userId, table.revokedAt),
  }),
);

export const notificationDeliveries = pgTable(
  "notification_deliveries",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eventId: text("event_id").references(() => userEvents.id, { onDelete: "set null" }),
    reminderId: text("reminder_id").references(() => eventReminders.id, {
      onDelete: "set null",
    }),
    channel: varchar("channel", { length: 16 }).notNull(),
    status: varchar("status", { length: 24 }).default("pending").notNull(),
    scheduledFor: timestamp("scheduled_for", { mode: "date" }).notNull(),
    sentAt: timestamp("sent_at", { mode: "date" }),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    deliveryScheduleIdx: index("notification_deliveries_schedule_idx").on(
      table.status,
      table.scheduledFor,
    ),
    userSentIdx: index("notification_deliveries_user_sent_idx").on(table.userId, table.sentAt),
  }),
);
