import { eq, and, desc, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, telegramUsers, transactions, withdrawals, adTokens, settings, InsertTelegramUser, InsertTransaction, InsertWithdrawal, InsertAdToken, InsertSetting } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
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

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ===== ADSGRAM DATABASE FUNCTIONS =====

/**
 * Get or create Telegram user
 */
export async function getTelegramUser(telegramId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(telegramUsers).where(eq(telegramUsers.telegramId, telegramId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/**
 * Create or update Telegram user
 */
export async function upsertTelegramUser(user: InsertTelegramUser) {
  const db = await getDb();
  if (!db) return undefined;

  try {
    const updateSet: any = {
      updatedAt: new Date(),
    };

    // Update profile fields
    if (user.username !== undefined) updateSet.username = user.username;
    if (user.firstName !== undefined) updateSet.firstName = user.firstName;
    if (user.lastName !== undefined) updateSet.lastName = user.lastName;
    if (user.photoUrl !== undefined) updateSet.photoUrl = user.photoUrl;

    // Ensure date-only fields never exceed 10 chars (YYYY-MM-DD) for varchar(10) columns
    const safeDate = (val: any): string | null => {
      if (val === null || val === undefined) return null;
      if (val instanceof Date) return val.toISOString().split("T")[0];
      const s = String(val);
      return s.substring(0, 10);
    };

    // Update balance and earnings
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

    await db.insert(telegramUsers).values(safeUser).onDuplicateKeyUpdate({
      set: updateSet,
    });
    return await getTelegramUser(user.telegramId!);
  } catch (error) {
    console.error("[Database] Failed to upsert telegram user:", error);
    throw error;
  }
}

/**
 * Create transaction record
 */
export async function createTransaction(transaction: InsertTransaction) {
  const db = await getDb();
  if (!db) return undefined;

  try {
    const result = await db.insert(transactions).values(transaction);
    return result;
  } catch (error) {
    console.error("[Database] Failed to create transaction:", error);
    throw error;
  }
}

/**
 * Create withdrawal request
 */
export async function createWithdrawal(withdrawal: InsertWithdrawal) {
  const db = await getDb();
  if (!db) return undefined;

  try {
    const result = await db.insert(withdrawals).values(withdrawal);
    return result;
  } catch (error) {
    console.error("[Database] Failed to create withdrawal:", error);
    throw error;
  }
}

/**
 * Get pending withdrawals
 */
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

/**
 * Update withdrawal status
 */
export async function updateWithdrawalStatus(id: number, status: "pending" | "approved" | "rejected" | "completed", note?: string) {
  const db = await getDb();
  if (!db) return undefined;

  try {
    const updateData: any = {
      status,
      processedAt: new Date(),
      updatedAt: new Date(),
    };
    if (note) updateData.note = note;

    await db.update(withdrawals).set(updateData).where(eq(withdrawals.id, id));
    return await db.select().from(withdrawals).where(eq(withdrawals.id, id)).limit(1);
  } catch (error) {
    console.error("[Database] Failed to update withdrawal:", error);
    throw error;
  }
}

/**
 * Create ad token
 */
export async function createAdToken(token: string, telegramId: number) {
  const db = await getDb();
  if (!db) return undefined;

  try {
    await db.insert(adTokens).values({
      token,
      telegramId,
      used: "false",
      invalid: "false",
    });
    return token;
  } catch (error) {
    console.error("[Database] Failed to create ad token:", error);
    throw error;
  }
}

/**
 * Get ad token
 */
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

/**
 * Mark ad token as used
 */
export async function markAdTokenUsed(token: string) {
  const db = await getDb();
  if (!db) return undefined;

  try {
    await db.update(adTokens).set({ used: "true" }).where(eq(adTokens.token, token));
  } catch (error) {
    console.error("[Database] Failed to mark ad token as used:", error);
    throw error;
  }
}

/**
 * Get setting
 */
export async function getSetting(key: string, defaultValue?: any) {
  const db = await getDb();
  if (!db) return defaultValue;

  try {
    const result = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
    if (result.length > 0) {
      return result[0].value ? JSON.parse(result[0].value) : defaultValue;
    }
    return defaultValue;
  } catch (error) {
    console.error("[Database] Failed to get setting:", error);
    return defaultValue;
  }
}

/**
 * Set setting
 */
export async function setSetting(key: string, value: any) {
  const db = await getDb();
  if (!db) return undefined;

  try {
    const valueStr = typeof value === "string" ? value : JSON.stringify(value);
    await db.insert(settings).values({
      key,
      value: valueStr,
    }).onDuplicateKeyUpdate({
      set: {
        value: valueStr,
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error("[Database] Failed to set setting:", error);
    throw error;
  }
}

/**
 * Get user statistics
 */
export async function getUserStats() {
  const db = await getDb();
  if (!db) return { totalUsers: 0, totalAds: 0, pendingWithdrawals: 0 };

  try {
    const totalUsers = await db.select().from(telegramUsers);
    const totalAds = await db.select().from(transactions).where(eq(transactions.type, "ad"));
    const pendingWithdrawals = await db.select().from(withdrawals).where(eq(withdrawals.status, "pending"));

    return {
      totalUsers: totalUsers.length,
      totalAds: totalAds.length,
      pendingWithdrawals: pendingWithdrawals.length,
    };
  } catch (error) {
    console.error("[Database] Failed to get user stats:", error);
    return { totalUsers: 0, totalAds: 0, pendingWithdrawals: 0 };
  }
}

/**
 * Get user transactions
 */
export async function getTransactions(telegramId: number, limit: number = 20) {
  const db = await getDb();
  if (!db) return [];

  try {
    return await db.select()
      .from(transactions)
      .where(eq(transactions.telegramId, telegramId))
      .orderBy(desc(transactions.createdAt))
      .limit(limit);
  } catch (error) {
    console.error("[Database] Failed to get transactions:", error);
    return [];
  }
}

/**
 * Get withdrawals for a specific user
 */
export async function getUserWithdrawals(telegramId: number, limit: number = 10) {
  const db = await getDb();
  if (!db) return [];

  try {
    return await db.select()
      .from(withdrawals)
      .where(eq(withdrawals.telegramId, telegramId))
      .orderBy(desc(withdrawals.createdAt))
      .limit(limit);
  } catch (error) {
    console.error("[Database] Failed to get user withdrawals:", error);
    return [];
  }
}

/**
 * Get referral statistics for a user
 */
export async function getReferralStats(telegramId: number) {
  const db = await getDb();
  if (!db) return { count: 0, totalEarned: 0 };

  try {
    // Count users who were referred by this telegramId
    const referred = await db.select()
      .from(telegramUsers)
      .where(eq(telegramUsers.referredBy, telegramId));

    // Sum all referral transactions earned by this user
    const referralTxs = await db.select()
      .from(transactions)
      .where(
        and(
          eq(transactions.telegramId, telegramId),
          eq(transactions.type, "referral")
        )
      );

    const totalEarned = referralTxs.reduce((sum: number, tx: any) => sum + Number(tx.points), 0);

    return { count: referred.length, totalEarned };
  } catch (error) {
    console.error("[Database] Failed to get referral stats:", error);
    return { count: 0, totalEarned: 0 };
  }
}

  // ===== نظام الإشعارات: جلب المستخدمين الغائبين =====
  export async function getInactiveUsers(daysSinceLastActivity: number = 3, limit: number = 50) {
    const db = await getDb();
    if (!db) return [];
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysSinceLastActivity);
      const inactive = await db
        .select()
        .from(telegramUsers)
        .where(
          and(
            lt(telegramUsers.updatedAt, cutoffDate),
            eq(telegramUsers.isBanned, "false")
          )
        )
        .limit(limit);
      return inactive;
    } catch (error) {
      console.error("[Database] Failed to get inactive users:", error);
      return [];
    }
  }
  