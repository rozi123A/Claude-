import { bigint, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
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
  todayAdsDate: varchar("today_ads_date", { length: 100 }),
  spinsLeft: int("spins_left").default(5).notNull(),
  spinsDate: varchar("spins_date", { length: 100 }),
  lastAdTime: varchar("last_ad_time", { length: 100 }),
  lastDailyGift: varchar("last_daily_gift", { length: 100 }),
  completedTasks: text("completed_tasks"),
  referredBy: bigint("referred_by", { mode: "number" }),
  referralCode: varchar("referral_code", { length: 32 }).unique(),
  isBanned: mysqlEnum("is_banned", ["true", "false"]).default("false").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type TelegramUser = typeof telegramUsers.$inferSelect;
export type InsertTelegramUser = typeof telegramUsers.$inferInsert;

export const transactions = mysqlTable("transactions", {
  id: int("id").autoincrement().primaryKey(),
  telegramId: bigint("telegram_id", { mode: "number" }).notNull(),
  type: mysqlEnum("type", ["ad", "spin", "withdraw", "task", "bonus", "referral", "daily_gift"]).notNull(),
  points: bigint("points", { mode: "number" }).notNull(),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;

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

export const settings = mysqlTable("settings", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type Setting = typeof settings.$inferSelect;
export type InsertSetting = typeof settings.$inferInsert;
