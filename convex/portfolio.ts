import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * getPortfolio — reads the single portfolio document.
 * Returns null if the portfolio hasn't been initialized yet.
 */
export const getPortfolio = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("portfolio").collect();
    return rows[0] ?? null;
  },
});

/**
 * getRecentLogs — returns the last `limit` trade log entries, newest first.
 */
export const getRecentLogs = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { limit = 100 }) => {
    const logs = await ctx.db
      .query("tradeLogs")
      .order("desc")
      .take(limit);
    return logs;
  },
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * initPortfolio — creates the portfolio document with default values.
 * Safe to call multiple times — it only creates if no document exists.
 */
export const initPortfolio = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("portfolio").first();
    if (existing) return existing._id;

    const id = await ctx.db.insert("portfolio", {
      availableCash: 10_000_000,
      totalValue: 10_000_000,
      positions: [],
    });

    await ctx.db.insert("tradeLogs", {
      timestamp: new Date().toISOString(),
      logType: "SYSTEM",
      message: "Portfolio initialized. Starting cash: 10,000,000 VND.",
    });

    return id;
  },
});

/**
 * updatePortfolio — called by the Python engine after every scan/trade.
 * Replaces cash, totalValue, and the entire positions array atomically.
 */
export const updatePortfolio = mutation({
  args: {
    availableCash: v.number(),
    totalValue: v.number(),
    positions: v.array(
      v.object({
        ticker: v.string(),
        shares: v.number(),
        avgPrice: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("portfolio").first();
    if (!existing) {
      // Auto-initialize if it doesn't exist yet
      return await ctx.db.insert("portfolio", args);
    }
    await ctx.db.patch(existing._id, args);
    return existing._id;
  },
});

/**
 * resetPortfolio — wipes positions and restores cash to 10,000,000 VND.
 * Also appends a SYSTEM log.
 */
export const resetPortfolio = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("portfolio").first();
    const resetData = {
      availableCash: 10_000_000,
      totalValue: 10_000_000,
      positions: [] as Array<{ ticker: string; shares: number; avgPrice: number }>,
    };

    if (existing) {
      await ctx.db.patch(existing._id, resetData);
    } else {
      await ctx.db.insert("portfolio", resetData);
    }

    await ctx.db.insert("tradeLogs", {
      timestamp: new Date().toISOString(),
      logType: "SYSTEM",
      message: "Portfolio reset. Cash restored to 10,000,000 VND.",
    });
  },
});

/**
 * appendLog — adds a single structured log entry from the Python engine.
 * Called once per BUY/SELL/HOLD/SCAN/SYSTEM event.
 */
export const appendLog = mutation({
  args: {
    timestamp: v.string(),
    logType: v.string(),
    message: v.string(),
    ticker: v.optional(v.string()),
    price: v.optional(v.number()),
    shares: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("tradeLogs", args);
  },
});

/**
 * appendLogs — batch version of appendLog for efficiency.
 * Python engine sends all logs from a single scan in one call.
 */
export const appendLogs = mutation({
  args: {
    logs: v.array(
      v.object({
        timestamp: v.string(),
        logType: v.string(),
        message: v.string(),
        ticker: v.optional(v.string()),
        price: v.optional(v.number()),
        shares: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, { logs }) => {
    for (const log of logs) {
      await ctx.db.insert("tradeLogs", log);
    }
  },
});
