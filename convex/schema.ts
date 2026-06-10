import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  /**
   * portfolio — single-row table (we always upsert the same document).
   * Stores cash, total value, and the flat list of active positions.
   */
  portfolio: defineTable({
    availableCash: v.number(),
    totalValue: v.number(),
    positions: v.array(
      v.object({
        ticker: v.string(),
        shares: v.number(),
        avgPrice: v.number(),
      })
    ),
  }),

  /**
   * tradeLogs — append-only log of every BUY / SELL / HOLD / SYSTEM / SCAN
   * event emitted by the Python engine or the frontend.
   */
  tradeLogs: defineTable({
    timestamp: v.string(),   // ISO-8601 string, e.g. "2026-06-10T14:32:00"
    logType: v.string(),     // "BUY" | "SELL" | "HOLD" | "SYSTEM" | "SCAN"
    message: v.string(),
    ticker: v.optional(v.string()),   // populated on trade events
    price: v.optional(v.number()),    // execution price when applicable
    shares: v.optional(v.number()),   // share count when applicable
  }).index("by_timestamp", ["timestamp"]),
});
