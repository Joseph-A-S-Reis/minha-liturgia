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
    isAdmin: boolean("is_admin").default(false).notNull(),
    isCurator: boolean("is_curator").default(false).notNull(),
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

export const libraryResources = pgTable(
  "library_resources",
  {
    id: text("id").primaryKey(),
    slug: varchar("slug", { length: 180 }).notNull(),
    title: varchar("title", { length: 220 }).notNull(),
    summary: text("summary"),
    contentMarkdown: text("content_markdown"),
    resourceType: varchar("resource_type", { length: 24 }).default("article").notNull(),
    status: varchar("status", { length: 24 }).default("draft").notNull(),
    isOfficialChurchSource: boolean("is_official_church_source").default(false).notNull(),
    sourceName: varchar("source_name", { length: 140 }),
    sourceUrl: text("source_url"),
    coverImageUrl: text("cover_image_url"),
    publishedAt: timestamp("published_at", { mode: "date" }),
    createdByUserId: text("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedByUserId: text("reviewed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    slugUnique: uniqueIndex("library_resources_slug_unique").on(table.slug),
    statusTypePublishedIdx: index("library_resources_status_type_published_idx").on(
      table.status,
      table.resourceType,
      table.publishedAt,
    ),
    officialPublishedIdx: index("library_resources_official_published_idx").on(
      table.isOfficialChurchSource,
      table.publishedAt,
    ),
  }),
);

export const libraryCategories = pgTable(
  "library_categories",
  {
    id: text("id").primaryKey(),
    slug: varchar("slug", { length: 120 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description"),
    section: varchar("section", { length: 40 }).default("formacao").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    slugUnique: uniqueIndex("library_categories_slug_unique").on(table.slug),
    sectionSortIdx: index("library_categories_section_sort_idx").on(table.section, table.sortOrder),
  }),
);

export const libraryResourceCategories = pgTable(
  "library_resource_categories",
  {
    id: text("id").primaryKey(),
    resourceId: text("resource_id")
      .notNull()
      .references(() => libraryResources.id, { onDelete: "cascade" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => libraryCategories.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    resourceCategoryUnique: uniqueIndex("library_resource_categories_unique").on(
      table.resourceId,
      table.categoryId,
    ),
    categoryIdx: index("library_resource_categories_category_idx").on(table.categoryId),
  }),
);

export const libraryAssets = pgTable(
  "library_assets",
  {
    id: text("id").primaryKey(),
    resourceId: text("resource_id")
      .notNull()
      .references(() => libraryResources.id, { onDelete: "cascade" }),
    kind: varchar("kind", { length: 24 }).notNull(),
    title: varchar("title", { length: 180 }),
    mimeType: varchar("mime_type", { length: 120 }),
    externalUrl: text("external_url"),
    storageObjectKey: text("storage_object_key"),
    byteSize: integer("byte_size"),
    durationSeconds: integer("duration_seconds"),
    extractedText: text("extracted_text"),
    transcriptionText: text("transcription_text"),
    status: varchar("status", { length: 24 }).default("ready").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    resourceKindIdx: index("library_assets_resource_kind_idx").on(table.resourceId, table.kind),
    statusIdx: index("library_assets_status_idx").on(table.status),
  }),
);

export const libraryResourceChunks = pgTable(
  "library_resource_chunks",
  {
    id: text("id").primaryKey(),
    resourceId: text("resource_id")
      .notNull()
      .references(() => libraryResources.id, { onDelete: "cascade" }),
    sourceAssetId: text("source_asset_id").references(() => libraryAssets.id, {
      onDelete: "set null",
    }),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    tokenEstimate: integer("token_estimate"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    resourceChunkUnique: uniqueIndex("library_resource_chunks_resource_chunk_unique").on(
      table.resourceId,
      table.chunkIndex,
    ),
    resourceIdx: index("library_resource_chunks_resource_idx").on(table.resourceId),
  }),
);

export const libraryIngestionQueue = pgTable(
  "library_ingestion_queue",
  {
    id: text("id").primaryKey(),
    sourceName: varchar("source_name", { length: 140 }).notNull(),
    sourceUrl: text("source_url"),
    section: varchar("section", { length: 40 }).default("santa-igreja").notNull(),
    title: varchar("title", { length: 260 }).notNull(),
    summary: text("summary"),
    contentUrl: text("content_url"),
    contentRaw: text("content_raw"),
    imageUrl: text("image_url"),
    publishedAt: timestamp("published_at", { mode: "date" }),
    status: varchar("status", { length: 24 }).default("pending_review").notNull(),
    linkedResourceId: text("linked_resource_id").references(() => libraryResources.id, {
      onDelete: "set null",
    }),
    reviewedByUserId: text("reviewed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    statusCreatedIdx: index("library_ingestion_queue_status_created_idx").on(
      table.status,
      table.createdAt,
    ),
    sectionStatusIdx: index("library_ingestion_queue_section_status_idx").on(
      table.section,
      table.status,
    ),
  }),
);

export const mariaCitationEvents = pgTable(
  "maria_citation_events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    mode: varchar("mode", { length: 24 }).notNull(),
    queryText: text("query_text").notNull(),
    answerExcerpt: text("answer_excerpt"),
    citationIndex: integer("citation_index").notNull(),
    citationScore: integer("citation_score").notNull(),
    resourceId: text("resource_id").references(() => libraryResources.id, {
      onDelete: "set null",
    }),
    resourceSlug: varchar("resource_slug", { length: 180 }).notNull(),
    resourceTitle: varchar("resource_title", { length: 220 }).notNull(),
    sourceUrl: text("source_url"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    userCreatedIdx: index("maria_citation_events_user_created_idx").on(
      table.userId,
      table.createdAt,
    ),
    resourceCreatedIdx: index("maria_citation_events_resource_created_idx").on(
      table.resourceSlug,
      table.createdAt,
    ),
    modeCreatedIdx: index("maria_citation_events_mode_created_idx").on(
      table.mode,
      table.createdAt,
    ),
  }),
);
