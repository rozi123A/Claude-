import { eq, and, desc, lt, count, sum, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  InsertUser, users, telegramUsers, transactions, withdrawals,
  adTokens, settings, InsertTelegramUser, InsertTransaction,
  InsertWithdrawal, tasks, userTasks, type Task, type InsertTask, type UserTask,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: Pool | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        max: 10,
      });
      _db = drizzle(_pool);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");

  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }

    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot get user: database not available"); return undefined; }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getTelegramUser(telegramId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(telegramUsers).where(eq(telegramUsers.telegramId, telegramId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function upsertTelegramUser(user: InsertTelegramUser) {
  const db = await getDb();
  if (!db) return undefined;

  try {
    const updateSet: any = { updatedAt: new Date() };

    if (user.username !== undefined) updateSet.username = user.username;
    if (user.firstName !== undefined) updateSet.firstName = user.firstName;
    if (user.lastName !== undefined) updateSet.lastName = user.lastName;
    if (user.photoUrl !== undefined) updateSet.photoUrl = user.photoUrl;

    const safeDate = (val: any): string | null => {
      if (val === null || val === undefined) return null;
      if (val instanceof Date) return val.toISOString().split("T")[0];
      return String(val).substring(0, 10);
    };

    if (user.balance !== undefined) updateSet.balance = user.balance;
    if (user.totalEarned !== undefined) updateSet.totalEarned = user.totalEarned;
    if (user.todayAds !== undefined) updateSet.todayAds = user.todayAds;
    if (user.todayAdsDate !== undefined) updateSet.todayAdsDate = safeDate(user.todayAdsDate);
    if (user.spinsLeft !== undefined) updateSet.spinsLeft = user.spinsLeft;
    if (user.spinsDate !== undefined) updateSet.spinsDate = safeDate(user.spinsDate);
    if (user.lastAdTime !== undefined) updateSet.lastAdTime = user.lastAdTime;
    if (user.completedTasks !== undefined) updateSet.completedTasks = user.completedTasks;
    if (user.referredBy !== undefined) updateSet.referredBy = user.referredBy;
    if (user.referralCode !== undefined) updateSet.referralCode = user.referralCode;
    if (user.isBanned !== undefined) updateSet.isBanned = user.isBanned;

    const safeUser = {
      ...user,
      todayAdsDate: user.todayAdsDate !== undefined ? safeDate(user.todayAdsDate) : undefined,
      spinsDate: user.spinsDate !== undefined ? safeDate(user.spinsDate) : undefined,
    };

    await db.insert(telegramUsers).values(safeUser).onConflictDoUpdate({
      target: telegramUsers.telegramId,
      set: updateSet,
    });
    return await getTelegramUser(user.telegramId!);
  } catch (error) {
    console.error("[Database] Failed to upsert telegram user:", error);
    throw error;
  }
}

export async function createTransaction(transaction: InsertTransaction) {
  const db = await getDb();
  if (!db) return undefined;
  try {
    return await db.insert(transactions).values(transaction);
  } catch (error) {
    console.error("[Database] Failed to create transaction:", error);
    throw error;
  }
}

export async function createWithdrawal(withdrawal: InsertWithdrawal) {
  const db = await getDb();
  if (!db) return undefined;
  try {
    return await db.insert(withdrawals).values(withdrawal);
  } catch (error) {
    console.error("[Database] Failed to create withdrawal:", error);
    throw error;
  }
}

export async function getPendingWithdrawals() {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db.select().from(withdrawals).where(eq(withdrawals.status, "pending"));
  } catch (error) {
    console.error("[Database] Failed to get pending withdrawals:", error);
    return [];
  }
}

export async function updateWithdrawalStatus(id: number, status: "pending" | "approved" | "rejected" | "completed", note?: string) {
  const db = await getDb();
  if (!db) return undefined;
  try {
    const updateData: any = { status, processedAt: new Date(), updatedAt: new Date() };
    if (note) updateData.note = note;
    await db.update(withdrawals).set(updateData).where(eq(withdrawals.id, id));
    return await db.select().from(withdrawals).where(eq(withdrawals.id, id)).limit(1);
  } catch (error) {
    console.error("[Database] Failed to update withdrawal:", error);
    throw error;
  }
}

export async function createAdToken(token: string, telegramId: number) {
  const db = await getDb();
  if (!db) return undefined;
  try {
    await db.insert(adTokens).values({ token, telegramId, used: false, invalid: false });
    return token;
  } catch (error) {
    console.error("[Database] Failed to create ad token:", error);
    throw error;
  }
}

export async function getAdToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;
  try {
    const result = await db.select().from(adTokens).where(eq(adTokens.token, token)).limit(1);
    return result.length > 0 ? result[0] : undefined;
  } catch (error) {
    console.error("[Database] Failed to get ad token:", error);
    return undefined;
  }
}

export async function markAdTokenUsed(token: string) {
  const db = await getDb();
  if (!db) return undefined;
  try {
    await db.update(adTokens).set({ used: true }).where(eq(adTokens.token, token));
  } catch (error) {
    console.error("[Database] Failed to mark ad token as used:", error);
    throw error;
  }
}

export async function getSetting(key: string, defaultValue?: any) {
  const db = await getDb();
  if (!db) return defaultValue;
  try {
    const result = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
    if (result.length > 0) return result[0].value ? JSON.parse(result[0].value) : defaultValue;
    return defaultValue;
  } catch (error) {
    console.error("[Database] Failed to get setting:", error);
    return defaultValue;
  }
}

export async function setSetting(key: string, value: any) {
  const db = await getDb();
  if (!db) return undefined;
  try {
    const valueStr = typeof value === "string" ? value : JSON.stringify(value);
    await db.insert(settings).values({ key, value: valueStr }).onConflictDoUpdate({
      target: settings.key,
      set: { value: valueStr, updatedAt: new Date() },
    });
  } catch (error) {
    console.error("[Database] Failed to set setting:", error);
    throw error;
  }
}

export async function getUserStats() {
  const db = await getDb();
  if (!db) return { totalUsers: 0, totalAds: 0, pendingWithdrawals: 0 };
  try {
    const totalUsers = await db.select().from(telegramUsers);
    const totalAds = await db.select().from(transactions).where(eq(transactions.type, "ad"));
    const pendingWithdrawals = await db.select().from(withdrawals).where(eq(withdrawals.status, "pending"));
    return { totalUsers: totalUsers.length, totalAds: totalAds.length, pendingWithdrawals: pendingWithdrawals.length };
  } catch (error) {
    console.error("[Database] Failed to get user stats:", error);
    return { totalUsers: 0, totalAds: 0, pendingWithdrawals: 0 };
  }
}

export async function getTransactions(telegramId: number, limit: number = 20) {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db.select().from(transactions)
      .where(eq(transactions.telegramId, telegramId))
      .orderBy(desc(transactions.createdAt))
      .limit(limit);
  } catch (error) {
    console.error("[Database] Failed to get transactions:", error);
    return [];
  }
}

export async function getUserWithdrawals(telegramId: number, limit: number = 10) {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db.select().from(withdrawals)
      .where(eq(withdrawals.telegramId, telegramId))
      .orderBy(desc(withdrawals.createdAt))
      .limit(limit);
  } catch (error) {
    console.error("[Database] Failed to get user withdrawals:", error);
    return [];
  }
}

export async function getReferralStats(telegramId: number) {
  const db = await getDb();
  if (!db) return { count: 0, totalEarned: 0 };
  try {
    const referred = await db.select().from(telegramUsers).where(eq(telegramUsers.referredBy, telegramId));
    const referralTxs = await db.select().from(transactions).where(
      and(eq(transactions.telegramId, telegramId), eq(transactions.type, "referral"))
    );
    const totalEarned = referralTxs.reduce((sum: number, tx: any) => sum + Number(tx.points), 0);
    return { count: referred.length, totalEarned };
  } catch (error) {
    console.error("[Database] Failed to get referral stats:", error);
    return { count: 0, totalEarned: 0 };
  }
}

export async function getInactiveUsers(daysSinceLastActivity: number = 3, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysSinceLastActivity);
    return await db.select().from(telegramUsers)
      .where(and(lt(telegramUsers.updatedAt, cutoffDate), eq(telegramUsers.isBanned, false)))
      .limit(limit);
  } catch (error) {
    console.error("[Database] Failed to get inactive users:", error);
    return [];
  }
}

export async function getLeaderboard(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db.select({
      telegramId: telegramUsers.telegramId,
      username: telegramUsers.username,
      firstName: telegramUsers.firstName,
      totalEarned: telegramUsers.totalEarned,
      balance: telegramUsers.balance,
    }).from(telegramUsers).orderBy(desc(telegramUsers.totalEarned)).limit(limit);
  } catch { return []; }
}

export async function getAdminStats() {
  const db = await getDb();
  if (!db) return null;
  try {
    const [
      [{ totalUsers }],
      [{ bannedUsers }],
      [{ pendingWithdrawals }],
      [{ pendingStars }],
      [{ totalTransactions }],
      [{ totalAdViews }],
      [{ totalSpins }],
      [{ totalWithdrawals }],
      [{ totalPointsDistributed }],
    ] = await Promise.all([
      db.select({ totalUsers: count() }).from(telegramUsers),
      db.select({ bannedUsers: count() }).from(telegramUsers).where(eq(telegramUsers.isBanned, true)),
      db.select({ pendingWithdrawals: count() }).from(withdrawals).where(eq(withdrawals.status, "pending")),
      db.select({ pendingStars: sql<number>`coalesce(sum(stars), 0)` }).from(withdrawals).where(eq(withdrawals.status, "pending")),
      db.select({ totalTransactions: count() }).from(transactions),
      db.select({ totalAdViews: count() }).from(transactions).where(eq(transactions.type, "ad")),
      db.select({ totalSpins: count() }).from(transactions).where(eq(transactions.type, "spin")),
      db.select({ totalWithdrawals: count() }).from(transactions).where(eq(transactions.type, "withdraw")),
      db.select({ totalPointsDistributed: sql<number>`coalesce(sum(points) filter (where points > 0), 0)` }).from(transactions),
    ]);
    return {
      totalUsers, bannedUsers, pendingWithdrawals, pendingStars,
      totalTransactions, totalPointsDistributed,
      totalAdViews, totalSpins, totalWithdrawals,
    };
  } catch (err) {
    console.error("[Database] getAdminStats failed:", err);
    return null;
  }
}

export async function getAllTelegramUsersAdmin(limit: number = 50, offset: number = 0) {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db.select().from(telegramUsers).orderBy(desc(telegramUsers.createdAt)).limit(limit).offset(offset);
  } catch (err) {
    console.error("[Database] getAllTelegramUsersAdmin failed:", err);
    return [];
  }
}

export async function getAllUsersForBroadcast(limit: number = 500) {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db.select({
      telegramId: telegramUsers.telegramId,
      firstName: telegramUsers.firstName,
      username: telegramUsers.username,
    }).from(telegramUsers).where(eq(telegramUsers.isBanned, false)).limit(limit);
  } catch (err) {
    console.error("[Database] getAllUsersForBroadcast failed:", err);
    return [];
  }
}

export async function banTelegramUser(telegramId: number, ban: boolean) {
  const db = await getDb();
  if (!db) return;
  try {
    await db.update(telegramUsers).set({ isBanned: ban }).where(eq(telegramUsers.telegramId, telegramId));
  } catch (err) {
    console.error("[Database] banTelegramUser failed:", err);
  }
}

export async function getAllWithdrawals(status?: string) {
  const db = await getDb();
  if (!db) return [];
  try {
    if (status) {
      return await db.select().from(withdrawals)
        .where(eq(withdrawals.status, status as any))
        .orderBy(desc(withdrawals.createdAt)).limit(100);
    }
    return await db.select().from(withdrawals).orderBy(desc(withdrawals.createdAt)).limit(100);
  } catch (err) {
    console.error("[Database] getAllWithdrawals failed:", err);
    return [];
  }
}


export async function initDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('[Database] Cannot initialize: DATABASE_URL is not set');
    return;
  }

  const { Client } = await import('pg');
  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  try {
    await client.connect();
    console.log('[Database] Connected for table initialization');
  } catch (err: any) {
    console.error('[Database] Connection failed during init:', err?.message);
    return;
  }

  const tables = [
    {
      name: 'users',
      sql: `CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        "openId" VARCHAR(64) NOT NULL UNIQUE,
        name TEXT,
        email VARCHAR(320),
        "loginMethod" VARCHAR(64),
        role TEXT DEFAULT 'user' NOT NULL,
        "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL,
        "updatedAt" TIMESTAMP DEFAULT NOW() NOT NULL,
        "lastSignedIn" TIMESTAMP DEFAULT NOW() NOT NULL
      )`
    },
    {
      name: 'telegram_users',
      sql: `CREATE TABLE IF NOT EXISTS telegram_users (
        id SERIAL PRIMARY KEY,
        telegram_id BIGINT NOT NULL UNIQUE,
        username VARCHAR(255),
        first_name VARCHAR(255),
        last_name VARCHAR(255),
        photo_url TEXT,
        balance BIGINT DEFAULT 0 NOT NULL,
        total_earned BIGINT DEFAULT 0 NOT NULL,
        today_ads INTEGER DEFAULT 0 NOT NULL,
        today_ads_date VARCHAR(100),
        spins_left INTEGER DEFAULT 5 NOT NULL,
        spins_date VARCHAR(100),
        last_ad_time VARCHAR(100),
        completed_tasks TEXT,
        referred_by BIGINT,
        referral_code VARCHAR(32) UNIQUE,
        is_banned BOOLEAN DEFAULT FALSE NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )`
    },
    {
      name: 'transactions',
      sql: `CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        telegram_id BIGINT NOT NULL,
        type TEXT NOT NULL,
        points BIGINT NOT NULL,
        metadata TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )`
    },
    {
      name: 'withdrawals',
      sql: `CREATE TABLE IF NOT EXISTS withdrawals (
        id SERIAL PRIMARY KEY,
        telegram_id BIGINT NOT NULL,
        amount BIGINT NOT NULL,
        stars INTEGER NOT NULL,
        method VARCHAR(50) DEFAULT 'telegram_stars',
        status TEXT DEFAULT 'pending' NOT NULL,
        processed_at TIMESTAMP,
        note TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )`
    },
    {
      name: 'ad_tokens',
      sql: `CREATE TABLE IF NOT EXISTS ad_tokens (
        id SERIAL PRIMARY KEY,
        token VARCHAR(255) NOT NULL UNIQUE,
        telegram_id BIGINT NOT NULL,
        used BOOLEAN DEFAULT FALSE NOT NULL,
        invalid BOOLEAN DEFAULT FALSE NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )`
    },
    {
      name: 'settings',
      sql: `CREATE TABLE IF NOT EXISTS settings (
        id SERIAL PRIMARY KEY,
        key VARCHAR(100) NOT NULL UNIQUE,
        value TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )`
      },
      {
        name: 'tasks',
        sql: `CREATE TABLE IF NOT EXISTS tasks (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          channel_username VARCHAR(100) NOT NULL DEFAULT '',
          channel_id VARCHAR(100),
          type VARCHAR(20) NOT NULL DEFAULT 'channel',
          points_min INTEGER NOT NULL DEFAULT 1,
          points_max INTEGER NOT NULL DEFAULT 10,
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT NOW() NOT NULL
        )`
      },
      {
        name: 'user_tasks',
        sql: `CREATE TABLE IF NOT EXISTS user_tasks (
          id SERIAL PRIMARY KEY,
          telegram_id BIGINT NOT NULL,
          task_id INTEGER NOT NULL,
          points_earned INTEGER NOT NULL,
          completed_at TIMESTAMP DEFAULT NOW() NOT NULL,
          UNIQUE(telegram_id, task_id)
        )`
      },
    ];

    for (const table of tables) {
    try {
      await client.query(table.sql);
      console.log(`[Database] ✓ Table ready: ${table.name}`);
    } catch (err: any) {
      console.error(`[Database] ✗ Failed to create ${table.name}:`, err?.message);
    }
  }

  await client.end();
  console.log('[Database] Initialization complete');
  // Seed permanent default tasks
  await seedDefaultTasks();
}

  // ── Seed default permanent tasks ─────────────────────────────────────
    async function seedDefaultTasks() {
      const db = await getDb();
      if (!db) return;
      try {
        const existing = await db.select().from(tasks).limit(1);
        if (existing.length > 0) return;
        const defaults = [
          { name: "قناة المكافآت الرسمية",    description: "قناة التحديثات والأخبار الرسمية",   channelUsername: "@ads_reward123",       channelId: null, type: "channel" as const, pointsMin: 1, pointsMax: 10 },
          { name: "مجتمع الأرباح العربي",     description: "انضم لمجتمعنا واكسب نقاطاً إضافية", channelUsername: "@arab_earn_community",  channelId: null, type: "channel" as const, pointsMin: 1, pointsMax: 10 },
          { name: "بوت المكافآت",             description: "شغّل البوت واحصل على نقاط إضافية",  channelUsername: "@ads_reward123_bot",    channelId: null, type: "bot"     as const, pointsMin: 1, pointsMax: 10 },
          { name: "قناة العروض والجوائز",     description: "تابع أحدث العروض والجوائز اليومية",  channelUsername: "@daily_rewards_ara",    channelId: null, type: "channel" as const, pointsMin: 1, pointsMax: 10 },
        ];
        for (const task of defaults) {
          await db.insert(tasks).values(task).onConflictDoNothing();
        }
        console.log(`[Database] ✓ Seeded ${defaults.length} default tasks`);
      } catch (err: any) {
        console.error("[Database] seedDefaultTasks error:", err?.message);
      }
    }

    // ── Tasks ──────────────────────────────────────────────────────────────
    import { tasks, userTasks, Task, InsertTask, UserTask } from "../drizzle/schema";

  export async function getTasks(): Promise<Task[]> {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(tasks).where(eq(tasks.isActive, true)).orderBy(tasks.id);
  }

  export async function getTaskById(id: number): Promise<Task | null> {
    const db = await getDb();
    if (!db) return null;
    const rows = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
    return rows[0] ?? null;
  }

  export async function createTask(data: InsertTask): Promise<Task> {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const rows = await db.insert(tasks).values(data).returning();
    return rows[0];
  }

  export async function updateTask(id: number, data: Partial<InsertTask>): Promise<void> {
    const db = await getDb();
    if (!db) return;
    await db.update(tasks).set(data).where(eq(tasks.id, id));
  }

  export async function deleteTask(id: number): Promise<void> {
    const db = await getDb();
    if (!db) return;
    await db.update(tasks).set({ isActive: false }).where(eq(tasks.id, id));
  }

  export async function getUserTasks(telegramId: number): Promise<UserTask[]> {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(userTasks).where(eq(userTasks.telegramId, telegramId));
  }

  export async function completeUserTask(telegramId: number, taskId: number, pointsEarned: number): Promise<void> {
    const db = await getDb();
    if (!db) return;
    await db.insert(userTasks).values({ telegramId, taskId, pointsEarned });
  }

  export async function getUserTaskEntry(telegramId: number, taskId: number): Promise<UserTask | null> {
    const db = await getDb();
    if (!db) return null;
    const rows = await db.select().from(userTasks).where(and(eq(userTasks.telegramId, telegramId), eq(userTasks.taskId, taskId))).limit(1);
    return rows[0] ?? null;
  }

  export async function removeUserTask(telegramId: number, taskId: number): Promise<number> {
    const db = await getDb();
    if (!db) return 0;
    const entry = await getUserTaskEntry(telegramId, taskId);
    if (!entry) return 0;
    await db.delete(userTasks).where(and(eq(userTasks.telegramId, telegramId), eq(userTasks.taskId, taskId)));
    return entry.pointsEarned;
  }

  export async function getAllTasks(): Promise<Task[]> {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(tasks).orderBy(tasks.id);
  }
  