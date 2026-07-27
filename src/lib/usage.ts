import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { usageCounters } from "@/lib/db/schema";
import { getEntitlement } from "@/lib/billing/entitlement";

export type UsageMetric = "scan" | "chat";

export const LIMITS = {
  free: { scan: 15, chat: 45 },
  plus: { scan: 300, chat: 900 },
} as const;

/** JST 暦月の "YYYY-MM"。now は ms の unix 時刻。 */
export function jstPeriod(now = Date.now()): string {
  return new Date(now + 9 * 3600_000).toISOString().slice(0, 7);
}

function billingMode(): "off" | "meter" | "enforce" {
  const mode = process.env.BILLING_MODE ?? "off";
  if (mode === "meter" || mode === "enforce" || mode === "off") return mode;
  if (mode) {
    console.warn(
      `[billing] unknown BILLING_MODE="${mode}", treating as "off"`,
    );
  }
  return "off";
}

export async function consumeUsage(
  userId: string,
  metric: UsageMetric,
): Promise<
  { ok: true } | { ok: false; error: string; code: "LIMIT_REACHED" }
> {
  const mode = billingMode();
  if (mode === "off") return { ok: true };

  const [row] = await db
    .insert(usageCounters)
    .values({ userId, metric, period: jstPeriod(), count: 1 })
    .onConflictDoUpdate({
      target: [
        usageCounters.userId,
        usageCounters.metric,
        usageCounters.period,
      ],
      set: {
        count: sql`${usageCounters.count} + 1`,
        updatedAt: new Date(),
      },
    })
    .returning({ count: usageCounters.count });

  if (mode === "enforce") {
    const entitlement = await getEntitlement(userId);
    const limit = LIMITS[entitlement][metric];
    if (row.count > limit) {
      return {
        ok: false,
        error: "今月の利用回数の上限に達しました",
        code: "LIMIT_REACHED",
      };
    }
  }

  return { ok: true };
}

/** Gemini 失敗時の返金。負値は MAX(0, …) で防止。 */
export async function refundUsage(
  userId: string,
  metric: UsageMetric,
): Promise<void> {
  if (billingMode() === "off") return;

  await db
    .update(usageCounters)
    .set({
      count: sql`MAX(0, ${usageCounters.count} - 1)`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(usageCounters.userId, userId),
        eq(usageCounters.metric, metric),
        eq(usageCounters.period, jstPeriod()),
      ),
    );
}
