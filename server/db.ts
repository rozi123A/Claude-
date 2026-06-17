import { eq, and, desc, lt, count, sum, sql, gte, or, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  InsertUser, users, telegramUsers, transactions, withdrawals,
  adTokens, settings, InsertTelegramUser, InsertTransaction,
  InsertWithdrawal, tasks, userTasks, type Task, type InsertTask, type UserTask,
  redeemCodes, redeemCodeUses, type RedeemCode,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: Pool | null = null;

export async function getPool(): Promise<Pool | null> {
  await getDb(); // ensures pool is initialized
  return _pool;
}

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: true } : false,
        max: 10,
      });
      _db = drizzle(_pool);
      // Auto-migration: add country column if missing
      try { await _pool.query(`ALTER TABLE telegram_users ADD COLUMN IF NOT EXISTS country VARCHAR(100)`); } catch (_) {}
      try { await _pool.query(`ALTER TABLE telegram_users ADD COLUMN IF NOT EXISTS last_reminded_at TIMESTAMP`); } catch (_) {}
      try { await _pool.query(`CREATE TABLE IF NOT EXISTS redeem_codes (id serial primary key, code varchar(50) not null unique, reward integer not null, max_uses integer not null default 100, used_count integer not null default 0, expires_at timestamp not null, is_active boolean not null default true, created_at timestamp not null default now())`); } catch (_) {}
      try { await _pool.query(`CREATE TABLE IF NOT EXISTS redeem_code_uses (id serial primary key, code_id integer not null, telegram_id bigint not null, redeemed_at timestamp not null default now(), unique(code_id, telegram_id))`); } catch (_) {}
      try { await _pool.query(`CREATE TABLE IF NOT EXISTS withdrawals (id serial primary key, telegram_id bigint not null, amount bigint not null, stars integer not null, method varchar(50) default 'telegram_stars', status text not null default 'pending', processed_at timestamp, note text, created_at timestamp not null default now(), updated_at timestamp not null default now())`); } catch (_) {}
      try { await _pool.query(`ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW()`); } catch (_) {}
      try { await _pool.query(`ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS method VARCHAR(50) DEFAULT 'telegram_stars'`); } catch (_) {}
      try { await _pool.query(`ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS note TEXT`); } catch (_) {}
      try { await _pool.query(`ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP`); } catch (_) {}
        // Wallet fields for TON/USDT withdrawals
        try { await _pool.query(`ALTER TABLE telegram_users ADD COLUMN IF NOT EXISTS ton_wallet VARCHAR(100)`); } catch (_) {}
        try { await _pool.query(`ALTER TABLE telegram_users ADD COLUMN IF NOT EXISTS usdt_wallet VARCHAR(100)`); } catch (_) {}
        try { await _pool.query(`ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS ton_tx_hash VARCHAR(100)`); } catch (_) {}
        try { await _pool.query(`ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS ton_amount VARCHAR(50)`); } catch (_) {}
        try { await _pool.query(`ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS usdt_tx_hash VARCHAR(200)`); } catch (_) {}
        try { await _pool.query(`ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS usdt_amount VARCHAR(50)`); } catch (_) {}
        try { await _pool.query(`ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS user_wallet VARCHAR(100)`); } catch (_) {}
        // Online tracking
        try { await _pool.query(`ALTER TABLE telegram_users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP`); } catch (_) {}
        // Anti-cheat tracking
        try { await _pool.query(`ALTER TABLE telegram_users ADD COLUMN IF NOT EXISTS cheat_strikes INTEGER NOT NULL DEFAULT 0`); } catch (_) {}
        try { await _pool.query(`ALTER TABLE telegram_users ADD COLUMN IF NOT EXISTS ban_reason TEXT`); } catch (_) {}
        try { await _pool.query(`ALTER TABLE telegram_users ADD COLUMN IF NOT EXISTS last_ip VARCHAR(100)`); } catch (_) {}
        try { await _pool.query(`ALTER TABLE telegram_users ADD COLUMN IF NOT EXISTS device_info TEXT`); } catch (_) {}
        // Streak & Badges
        try { await _pool.query(`ALTER TABLE telegram_users ADD COLUMN IF NOT EXISTS daily_streak INTEGER NOT NULL DEFAULT 0`); } catch (_) {}
        try { await _pool.query(`ALTER TABLE telegram_users ADD COLUMN IF NOT EXISTS last_login_date VARCHAR(10)`); } catch (_) {}
        try { await _pool.query(`ALTER TABLE telegram_users ADD COLUMN IF NOT EXISTS badges TEXT`); } catch (_) {}
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
    if (user.country !== undefined) updateSet.country = user.country;

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
    if (user.tonWallet !== undefined) updateSet.tonWallet = user.tonWallet;
    if (user.usdtWallet !== undefined) updateSet.usdtWallet = user.usdtWallet;
    if (user.dailyStreak !== undefined) updateSet.dailyStreak = user.dailyStreak;
    if (user.lastLoginDate !== undefined) updateSet.lastLoginDate = user.lastLoginDate;
    if (user.badges !== undefined) updateSet.badges = user.badges;
    if (user.lastIp !== undefined) updateSet.lastIp = user.lastIp;
    if (user.deviceInfo !== undefined) updateSet.deviceInfo = user.deviceInfo;
    if (user.banReason !== undefined) updateSet.banReason = user.banReason;
    updateSet.lastSeenAt = new Date();

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

export async function getInactiveUsers(daysSinceLastActivity: number = 3, limit: number = 200) {
  const db = await getDb();
  if (!db) return [];
  try {
    const activityCutoff = new Date();
    activityCutoff.setDate(activityCutoff.getDate() - daysSinceLastActivity);
    const reminderCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return await db.select().from(telegramUsers)
      .where(and(
        lt(telegramUsers.updatedAt, activityCutoff),
        eq(telegramUsers.isBanned, false),
        or(
          isNull(telegramUsers.lastRemindedAt),
          lt(telegramUsers.lastRemindedAt, reminderCutoff)
        )
      ))
      .limit(limit);
  } catch (error) {
    console.error("[Database] Failed to get inactive users:", error);
    return [];
  }
}

export async function updateLastReminded(telegramId: number) {
  const db = await getDb();
  if (!db) return;
  try {
    await db.update(telegramUsers)
      .set({ lastRemindedAt: new Date() })
      .where(eq(telegramUsers.telegramId, telegramId));
  } catch (error) {
    console.error("[Database] Failed to update lastRemindedAt:", error);
  }
}

export async function countAdTransactions(telegramId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  try {
    const result = await db.select({ c: count() }).from(transactions)
      .where(and(eq(transactions.telegramId, telegramId), eq(transactions.type, "ad")));
    return Number(result[0]?.c ?? 0);
  } catch { return 0; }
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
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      [{ totalUsers }],
      [{ bannedUsers }],
      [{ pendingWithdrawals }],
      [{ pendingStars }],
      [{ totalTransactions }],
      [{ totalAdViews }],
      [{ todayAds }],
      [{ totalSpins }],
      [{ totalWithdrawals }],
      [{ totalPoints }],
      [{ newUsersToday }],
      [{ totalStarsWithdrawn }],
      topUsers,
    ] = await Promise.all([
      db.select({ totalUsers: count() }).from(telegramUsers),
      db.select({ bannedUsers: count() }).from(telegramUsers).where(eq(telegramUsers.isBanned, true)),
      db.select({ pendingWithdrawals: count() }).from(withdrawals).where(eq(withdrawals.status, "pending")),
      db.select({ pendingStars: sql<number>`coalesce(sum(stars), 0)` }).from(withdrawals).where(eq(withdrawals.status, "pending")),
      db.select({ totalTransactions: count() }).from(transactions),
      db.select({ totalAdViews: count() }).from(transactions).where(eq(transactions.type, "ad")),
      db.select({ todayAds: count() }).from(transactions).where(
        and(eq(transactions.type, "ad"), gte(transactions.createdAt, todayStart))
      ),
      db.select({ totalSpins: count() }).from(transactions).where(eq(transactions.type, "spin")),
      db.select({ totalWithdrawals: count() }).from(transactions).where(eq(transactions.type, "withdraw")),
      db.select({ totalPoints: sql<number>`coalesce(sum(points) filter (where points > 0), 0)` }).from(transactions),
      db.select({ newUsersToday: count() }).from(telegramUsers).where(gte(telegramUsers.createdAt, todayStart)),
      db.select({ totalStarsWithdrawn: sql<number>`coalesce(sum(stars), 0)` }).from(withdrawals).where(
        sql`status in ('approved', 'completed')`
      ),
      db.select({
        telegramId: telegramUsers.telegramId,
        firstName: telegramUsers.firstName,
        username: telegramUsers.username,
        totalEarned: telegramUsers.totalEarned,
        balance: telegramUsers.balance,
      }).from(telegramUsers).orderBy(desc(telegramUsers.totalEarned)).limit(5),
    ]);
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const [{ onlineNow }] = await db.select({ onlineNow: count() })
      .from(telegramUsers)
      .where(gte(telegramUsers.lastSeenAt, fiveMinutesAgo));

    return {
      totalUsers, bannedUsers, pendingWithdrawals, pendingStars,
      totalTransactions, totalPoints,
      totalAdViews, todayAds, totalSpins, totalWithdrawals,
      newUsersToday, totalStarsWithdrawn,
      topUsers, onlineNow,
    };
  } catch (err) {
    console.error("[Database] getAdminStats failed:", err);
    return null;
  }
}

export async function getOnlineUsers(minutesAgo: number = 5) {
  const db = await getDb();
  if (!db) return [];
  try {
    const since = new Date(Date.now() - minutesAgo * 60 * 1000);
    return await db.select({
      telegramId: telegramUsers.telegramId,
      firstName: telegramUsers.firstName,
      username: telegramUsers.username,
      balance: telegramUsers.balance,
      country: telegramUsers.country,
      lastSeenAt: telegramUsers.lastSeenAt,
    }).from(telegramUsers)
      .where(gte(telegramUsers.lastSeenAt, since))
      .orderBy(desc(telegramUsers.lastSeenAt))
      .limit(100);
  } catch (err) {
    console.error("[Database] getOnlineUsers failed:", err);
    return [];
  }
}

export async function getDailyActiveUsers() {
  const db = await getDb();
  if (!db) return [];
  try {
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    return await db.select({
      telegramId: telegramUsers.telegramId,
      firstName: telegramUsers.firstName,
      username: telegramUsers.username,
      balance: telegramUsers.balance,
      country: telegramUsers.country,
      lastSeenAt: telegramUsers.lastSeenAt,
    }).from(telegramUsers)
      .where(gte(telegramUsers.lastSeenAt, todayMidnight))
      .orderBy(desc(telegramUsers.lastSeenAt))
      .limit(500);
  } catch (err) {
    console.error("[Database] getDailyActiveUsers failed:", err);
    return [];
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

export async function banTelegramUser(telegramId: number, ban: boolean, reason?: string) {
  const db = await getDb();
  if (!db) return;
  try {
    const updateData: any = { isBanned: ban, updatedAt: new Date() };
    if (ban && reason) updateData.banReason = reason;
    if (!ban) updateData.banReason = null;
    await db.update(telegramUsers).set(updateData).where(eq(telegramUsers.telegramId, telegramId));
  } catch (err) {
    console.error("[Database] banTelegramUser failed:", err);
  }
}

export async function addCheatStrike(telegramId: number, reason: string): Promise<{ strikes: number; banned: boolean }> {
  const db = await getDb();
  if (!db) return { strikes: 0, banned: false };
  try {
    const user = await getTelegramUser(telegramId);
    if (!user) return { strikes: 0, banned: false };
    const newStrikes = (Number(user.cheatStrikes) || 0) + 1;
    const shouldBan = newStrikes >= 3;
    const updateData: any = { cheatStrikes: newStrikes, updatedAt: new Date() };
    if (shouldBan) { updateData.isBanned = true; updateData.banReason = reason; }
    await db.update(telegramUsers).set(updateData).where(eq(telegramUsers.telegramId, telegramId));
    return { strikes: newStrikes, banned: shouldBan };
  } catch (err) {
    console.error("[Database] addCheatStrike failed:", err);
    return { strikes: 0, banned: false };
  }
}

export async function getBannedUsers() {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db.select({
      telegramId: telegramUsers.telegramId,
      firstName: telegramUsers.firstName,
      username: telegramUsers.username,
      cheatStrikes: telegramUsers.cheatStrikes,
      banReason: telegramUsers.banReason,
      updatedAt: telegramUsers.updatedAt,
    }).from(telegramUsers)
      .where(eq(telegramUsers.isBanned, true))
      .orderBy(desc(telegramUsers.updatedAt))
      .limit(200);
  } catch (err) {
    console.error("[Database] getBannedUsers failed:", err);
    return [];
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
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: true } : false,
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

// ── Redeem Codes ──────────────────────────────────────────────────────────

export async function createRedeemCode(code: string, reward: number, maxUses: number, expiresAt: Date): Promise<RedeemCode> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const rows = await db.insert(redeemCodes).values({ code: code.toUpperCase(), reward, maxUses, expiresAt }).returning();
  return rows[0];
}

export async function getAllRedeemCodes(): Promise<RedeemCode[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(redeemCodes).orderBy(desc(redeemCodes.createdAt));
}

export async function getRedeemCodeByCode(code: string): Promise<RedeemCode | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(redeemCodes).where(eq(redeemCodes.code, code.toUpperCase())).limit(1);
  return rows[0] ?? null;
}

export async function hasUserRedeemedCode(codeId: number, telegramId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db.select().from(redeemCodeUses).where(and(eq(redeemCodeUses.codeId, codeId), eq(redeemCodeUses.telegramId, telegramId))).limit(1);
  return rows.length > 0;
}

export async function recordRedeemCodeUse(codeId: number, telegramId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await Promise.all([
    db.insert(redeemCodeUses).values({ codeId, telegramId }),
    db.update(redeemCodes).set({ usedCount: sql`${redeemCodes.usedCount} + 1` }).where(eq(redeemCodes.id, codeId)),
  ]);
}

export async function deactivateRedeemCode(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(redeemCodes).set({ isActive: false }).where(eq(redeemCodes.id, id));
}

// ── Wallet Management ──────────────────────────────────────────────────────

export async function getUserWallets(telegramId: number): Promise<{ dgbWallet: string | null }> {
  const db = await getDb();
  if (!db) return { dgbWallet: null };
  const rows = await db.select({ dgbWallet: telegramUsers.tonWallet })
    .from(telegramUsers)
    .where(eq(telegramUsers.telegramId, telegramId))
    .limit(1);
  return rows[0] ?? { dgbWallet: null };
}

export async function updateUserDgbWallet(telegramId: number, wallet: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  // Validate DigiByte address format: starts with D, length 25-50 chars
  const normalized = wallet.trim();
  if (!normalized.startsWith("D") || normalized.length < 25 || normalized.length > 50) {
    throw new Error("عنوان DigiByte غير صالح — يجب أن يبدأ بالحرف D ويكون بين 25 و 50 حرفاً");
  }
  await db.update(telegramUsers).set({ tonWallet: normalized, updatedAt: new Date() }) // dgbWallet stored in ton_wallet column
    .where(eq(telegramUsers.telegramId, telegramId));
}

// updateUserUsdtWallet removed — use updateUserDgbWallet instead

// ── Multi-Account Detection ─────────────────────────────────────────────────

export async function getUsersByIp(ip: string) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(telegramUsers)
    .where(eq(telegramUsers.lastIp, ip));
}

export async function getSuspiciousAccountGroups(): Promise<Array<{
  ip: string;
  count: number;
  accounts: Array<{
    telegramId: number;
    username: string | null;
    firstName: string | null;
    balance: number;
    isBanned: boolean | null;
    createdAt: Date | null;
  }>;
}>> {
  const pool = await getPool();
  if (!pool) return [];
  const result = await pool.query(`
    SELECT
      last_ip,
      COUNT(*)::int AS count,
      array_agg(telegram_id ORDER BY created_at) AS telegram_ids,
      array_agg(username ORDER BY created_at) AS usernames,
      array_agg(first_name ORDER BY created_at) AS first_names,
      array_agg(balance ORDER BY created_at) AS balances,
      array_agg(is_banned ORDER BY created_at) AS banned_list,
      array_agg(created_at ORDER BY created_at) AS created_ats
    FROM telegram_users
    WHERE last_ip IS NOT NULL AND last_ip <> ''
    GROUP BY last_ip
    HAVING COUNT(*) >= 2
    ORDER BY count DESC
    LIMIT 100
  `);
  return result.rows.map((row: any) => ({
    ip: row.last_ip as string,
    count: row.count as number,
    accounts: (row.telegram_ids as any[]).map((id: any, i: number) => ({
      telegramId: Number(id),
      username: row.usernames[i] as string | null,
      firstName: row.first_names[i] as string | null,
      balance: Number(row.balances[i]),
      isBanned: row.banned_list[i] as boolean | null,
      createdAt: row.created_ats[i] as Date | null,
    })),
  }));
}

export async function bulkBanByIp(ip: string, ban: boolean, reason?: string): Promise<number> {
  const pool = await getPool();
  if (!pool) return 0;
  const banReason = ban ? (reason ?? 'حظر تلقائي — حسابات متعددة من نفس IP') : null;
  const res = await pool.query(
    `UPDATE telegram_users SET is_banned = $1, ban_reason = $2, updated_at = NOW() WHERE last_ip = $3`,
    [ban, banReason, ip]
  );
  return (res.rowCount ?? 0) as number;
}

