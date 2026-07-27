import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { subscriptions, type SubscriptionRow } from "@/lib/db/schema";

export type Entitlement = "free" | "plus";

export const CLOCK_SKEW_MS = 5 * 60_000; // 時計ずれ許容
export const RENEWAL_GRACE_MS = 48 * 3600_000; // 更新 webhook 遅延の猶予
export const PAST_DUE_GRACE_MS = 7 * 24 * 3600_000; // dunning 猶予のバックストップ

export function isEntitled(sub: SubscriptionRow, now = Date.now()): boolean {
  switch (sub.status) {
    case "active":
    case "trialing":
      return (
        now <
        sub.currentPeriodEnd.getTime() + RENEWAL_GRACE_MS + CLOCK_SKEW_MS
      );
    case "past_due":
      // currentPeriodEnd は失敗した請求の「翌期末」を指すため使わない。
      // 猶予の起点は currentPeriodStart（= 失敗した請求の周期開始）
      return now < sub.currentPeriodStart.getTime() + PAST_DUE_GRACE_MS;
    default:
      return false;
  }
}

export async function getEntitlement(userId: string): Promise<Entitlement> {
  const subs = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId));
  return subs.some((s) => isEntitled(s)) ? "plus" : "free";
}
