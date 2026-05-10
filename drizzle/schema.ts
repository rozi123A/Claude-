import { bigint, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ===== ADSGRAM TABLES =====

/**
 * Telegram Users table for Adsgram Mini App
 * Stores user information from Telegram
 */
export const telegramUsers = mysqlTable("telegram_users", {
  id: int("id").autoincrement().primaryKey(),
  telegramId: bigint("telegram_id", { mode: "number" }).notNull().unique(),
  username: varchar("username", { length: 255 }),
  firstName: varchar("first_name", { length: 255 }),
  lastName: varchar("last_name", { length: 255 }),
  photoUrl: text("photo_url"),
  balance: bigint("balance", { mode: "number" }).default(0).notNull(),
  totalEarned: bigint("total_earned", { mode: "number" }).default(0).notNull(),
  todayAds: int("today_ads").default(0).notNull(),
  todayAdsDate: varchar("today_ads_date", { length: 64 }).default(""),
  spinsLeft: int("spins_left").default(5).notNull(),
  spinsDate: varchar("spins_date", { length: 64 }).default(""),
  lastAdTime: timestamp("last_ad_time"),
  completedTasks: text("completed_tasks"), // JSON array
  referredBy: bigint("referred_by", { mode: "number" }),
  referralCode: varchar("referral_code", { length: 32 }).unique(),
  isBanned: mysqlEnum("is_banned", ["true", "false"]).default("false").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type TelegramUser = typeof telegramUsers.$inferSelect;
export type InsertTelegramUser = typeof telegramUsers.$inferInsert;

/**
 * Transactions table - tracks all user earnings
 */
export const transactions = mysqlTable("transactions", {
  id: int("id").autoincrement().primaryKey(),
  telegramId: bigint("telegram_id", { mode: "number" }).notNull(),
  type: mysqlEnum("type", ["ad", "spin", "withdraw", "task", "bonus", "referral"]).notNull(),
  points: bigint("points", { mode: "number" }).notNull(),
  metadata: text("metadata"), // JSON
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;

/**
 * Withdrawals table - tracks withdrawal requests
 */
export const withdrawals = mysqlTable("withdrawals", {
  id: int("id").autoincrement().primaryKey(),
  telegramId: bigint("telegram_id", { mode: "number" }).notNull(),
  amount: bigint("amount", { mode: "number" }).notNull(),
  stars: int("stars").notNull(),
  method: varchar("method", { length: 50 }).default("telegram_stars"),
  status: mysqlEnum("status", ["pending", "approved", "rejected", "completed"]).default("pending").notNull(),
  processedAt: timestamp("processed_at"),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type Withdrawal = typeof withdrawals.$inferSelect;
export type InsertWithdrawal = typeof withdrawals.$inferInsert;

/**
 * Ad Tokens table - one-time use tokens for ads
 */
export const adTokens = mysqlTable("ad_tokens", {
  id: int("id").autoincrement().primaryKey(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  telegramId: bigint("telegram_id", { mode: "number" }).notNull(),
  used: mysqlEnum("used", ["true", "false"]).default("false").notNull(),
  invalid: mysqlEnum("invalid", ["true", "false"]).default("false").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AdToken = typeof adTokens.$inferSelect;
export type InsertAdToken = typeof adTokens.$inferInsert;

/**
 * Settings table - app configuration
 */
export const settings = mysqlTable("settings", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value"), // JSON
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type Setting = typeof settings.$inferSelect;
export type InsertSetting = typeof settings.$inferInsert;
