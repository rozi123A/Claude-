import { bigint, boolean, integer, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: text("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const telegramUsers = pgTable("telegram_users", {
  id: serial("id").primaryKey(),
  telegramId: bigint("telegram_id", { mode: "number" }).notNull().unique(),
  username: varchar("username", { length: 255 }),
  firstName: varchar("first_name", { length: 255 }),
  lastName: varchar("last_name", { length: 255 }),
  photoUrl: text("photo_url"),
  balance: bigint("balance", { mode: "number" }).default(0).notNull(),
  totalEarned: bigint("total_earned", { mode: "number" }).default(0).notNull(),
  todayAds: integer("today_ads").default(0).notNull(),
  todayAdsDate: varchar("today_ads_date", { length: 100 }),
  spinsLeft: integer("spins_left").default(5).notNull(),
  spinsDate: varchar("spins_date", { length: 100 }),
  lastAdTime: varchar("last_ad_time", { length: 100 }),
  completedTasks: text("completed_tasks"),
  referredBy: bigint("referred_by", { mode: "number" }),
  referralCode: varchar("referral_code", { length: 32 }).unique(),
  isBanned: boolean("is_banned").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type TelegramUser = typeof telegramUsers.$inferSelect;
export type InsertTelegramUser = typeof telegramUsers.$inferInsert;

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  telegramId: bigint("telegram_id", { mode: "number" }).notNull(),
  type: text("type").notNull(),
  points: bigint("points", { mode: "number" }).notNull(),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;

export const withdrawals = pgTable("withdrawals", {
  id: serial("id").primaryKey(),
  telegramId: bigint("telegram_id", { mode: "number" }).notNull(),
  amount: bigint("amount", { mode: "number" }).notNull(),
  stars: integer("stars").notNull(),
  method: varchar("method", { length: 50 }).default("telegram_stars"),
  status: text("status").default("pending").notNull(),
  processedAt: timestamp("processed_at"),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Withdrawal = typeof withdrawals.$inferSelect;
export type InsertWithdrawal = typeof withdrawals.$inferInsert;

export const adTokens = pgTable("ad_tokens", {
  id: serial("id").primaryKey(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  telegramId: bigint("telegram_id", { mode: "number" }).notNull(),
  used: boolean("used").default(false).notNull(),
  invalid: boolean("invalid").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AdToken = typeof adTokens.$inferSelect;
export type InsertAdToken = typeof adTokens.$inferInsert;

export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Setting = typeof settings.$inferSelect;
export type InsertSetting = typeof settings.$inferInsert;

  export const tasks = pgTable("tasks", {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    channelUsername: varchar("channel_username", { length: 255 }).notNull(),
    channelId: varchar("channel_id", { length: 100 }),
    type: varchar("type", { length: 20 }).default("channel").notNull(),
    pointsMin: integer("points_min").default(1).notNull(),
    pointsMax: integer("points_max").default(10).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  });

  export type Task = typeof tasks.$inferSelect;
  export type InsertTask = typeof tasks.$inferInsert;

  export const userTasks = pgTable("user_tasks", {
    id: serial("id").primaryKey(),
    telegramId: bigint("telegram_id", { mode: "number" }).notNull(),
    taskId: integer("task_id").notNull(),
    pointsEarned: integer("points_earned").notNull(),
    completedAt: timestamp("completed_at").defaultNow().notNull(),
  });

  export type UserTask = typeof userTasks.$inferSelect;
  export type InsertUserTask = typeof userTasks.$inferInsert;
  