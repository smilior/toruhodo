import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  primaryKey,
} from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { nanoid } from "nanoid";

// --- Better Auth ---

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .notNull()
    .default(false),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", {
    mode: "timestamp",
  }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", {
    mode: "timestamp",
  }),
  scope: text("scope"),
  idToken: text("id_token"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const verifications = sqliteTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// --- App domain: 撮るほど ---

export const records = sqliteTable(
  "records",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    photoUrl: text("photo_url").notNull(),
    title: text("title").notNull(),
    easyText: text("easy_text").notNull(),
    detailText: text("detail_text").notNull(),
    easyRuby: text("easy_ruby").notNull().default(""),
    detailRuby: text("detail_ruby").notNull().default(""),
    aiNote: text("ai_note").notNull().default(""),
    ocrRaw: text("ocr_raw").notNull().default(""),
    partial: integer("partial", { mode: "boolean" }).notNull().default(false),
    partialChars: text("partial_chars"),
    lat: real("lat"),
    lng: real("lng"),
    placeName: text("place_name"),
    memo: text("memo"),
    /** JSON string[] — 質問候補 */
    suggestedQuestions: text("suggested_questions").notNull().default("[]"),
    /** JSON ChatMessage[] — チャット履歴 */
    chatMessages: text("chat_messages").notNull().default("[]"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    index("records_user_id_idx").on(t.userId),
    index("records_user_created_idx").on(t.userId, t.createdAt),
  ],
);

export const userSettings = sqliteTable("user_settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  furiganaDefault: integer("furigana_default", { mode: "boolean" })
    .notNull()
    .default(true),
  modeDefault: text("mode_default").notNull().default("easy"), // "easy" | "detail"
  geoEnabled: integer("geo_enabled", { mode: "boolean" })
    .notNull()
    .default(true),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// --- Billing: usage（BILLING_MODE が meter / enforce のときのみコードから参照） ---

export const usageCounters = sqliteTable(
  "usage_counters",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    metric: text("metric").notNull(), // "scan" | "chat"
    period: text("period").notNull(), // "YYYY-MM"（JST暦月）
    count: integer("count").notNull().default(0),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.metric, t.period] }),
  ],
);

export const usersRelations = relations(users, ({ many, one }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
  records: many(records),
  settings: one(userSettings),
  usageCounters: many(usageCounters),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const recordsRelations = relations(records, ({ one }) => ({
  user: one(users, { fields: [records.userId], references: [users.id] }),
}));

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
  user: one(users, { fields: [userSettings.userId], references: [users.id] }),
}));

export const usageCountersRelations = relations(usageCounters, ({ one }) => ({
  user: one(users, {
    fields: [usageCounters.userId],
    references: [users.id],
  }),
}));

export type RecordRow = typeof records.$inferSelect;
export type UserSettingsRow = typeof userSettings.$inferSelect;
export type User = typeof users.$inferSelect;
