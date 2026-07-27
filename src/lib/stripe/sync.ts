import { and, eq, isNull, sql } from "drizzle-orm";
import type Stripe from "stripe";
import { isEntitled } from "@/lib/billing/entitlement";
import { db } from "@/lib/db";
import {
  stripeCustomers,
  stripeWebhookEvents,
  subscriptions,
} from "@/lib/db/schema";
import { stripe } from "@/lib/stripe/client";

export type SyncResult =
  | { synced: true; userId: string }
  | { synced: false; reason: "NO_USER_MAPPING" };

/**
 * A-3: period は items.data[0] から読む（Subscription 直下には無い）。
 * 1 price × quantity 1 前提。length !== 1 は warn して data[0] を採用。
 */
export function extractPeriod(sub: Stripe.Subscription): {
  start: Date;
  end: Date;
} {
  const items = sub.items?.data ?? [];
  if (items.length !== 1) {
    console.warn(
      "[stripe] subscription items length is not 1; using data[0]",
      { subscriptionId: sub.id, length: items.length },
    );
  }
  const item = items[0];
  if (
    !item ||
    typeof item.current_period_start !== "number" ||
    typeof item.current_period_end !== "number"
  ) {
    throw new Error(
      `subscription ${sub.id} に current_period がありません（items.data[0]）`,
    );
  }
  return {
    start: new Date(item.current_period_start * 1000),
    end: new Date(item.current_period_end * 1000),
  };
}

/** §6.3 手順2 の LWW upsert 単体（テスト対象として export） */
export async function upsertSubscriptionRow(
  row: typeof subscriptions.$inferInsert,
): Promise<void> {
  await db
    .insert(subscriptions)
    .values(row)
    .onConflictDoUpdate({
      target: subscriptions.stripeSubscriptionId,
      set: {
        userId: row.userId,
        status: row.status,
        priceId: row.priceId,
        currentPeriodEnd: row.currentPeriodEnd,
        currentPeriodStart: row.currentPeriodStart,
        cancelAtPeriodEnd: row.cancelAtPeriodEnd,
        eventCreated: row.eventCreated,
        updatedAt: new Date(),
      },
      // 古いイベントの後着は自動破棄（>= は同秒後着の許容）
      setWhere: sql`excluded.event_created >= ${subscriptions.eventCreated}`,
    });
}

async function resolveUserId(
  sub: Stripe.Subscription,
): Promise<string | null> {
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  if (customerId) {
    const mapped = await db
      .select()
      .from(stripeCustomers)
      .where(eq(stripeCustomers.stripeCustomerId, customerId))
      .limit(1);
    if (mapped[0]) return mapped[0].userId;
  }

  const metaUserId = sub.metadata?.userId;
  if (metaUserId) {
    if (customerId) {
      await db
        .insert(stripeCustomers)
        .values({ userId: metaUserId, stripeCustomerId: customerId })
        .onConflictDoNothing();
    }
    return metaUserId;
  }

  return null;
}

/**
 * entitlement を書き込む唯一の経路（D-05）。
 * fetch-fresh: retrieve → userId 解決 → LWW upsert。
 */
export async function syncStripeSubscription(
  stripeSubscriptionId: string,
): Promise<SyncResult> {
  const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
  const userId = await resolveUserId(sub);
  if (!userId) {
    console.warn("[stripe] NO_USER_MAPPING for subscription", {
      subscriptionId: stripeSubscriptionId,
    });
    return { synced: false, reason: "NO_USER_MAPPING" };
  }

  const { start, end } = extractPeriod(sub);
  const priceId = sub.items.data[0]?.price?.id ?? "";
  // 取り直した現在値は定義上どのイベントよりも新しい → 取得時刻を入れる
  const eventCreated = Math.floor(Date.now() / 1000);

  await upsertSubscriptionRow({
    stripeSubscriptionId: sub.id,
    userId,
    status: sub.status,
    priceId,
    currentPeriodStart: start,
    currentPeriodEnd: end,
    cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
    eventCreated,
  });

  // 二重契約の検知のみ（自動 cancel は PR-4 reconcile）
  const all = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId));
  const entitled = all.filter((s) => isEntitled(s));
  if (entitled.length >= 2) {
    console.warn("[stripe] multiple entitled subscriptions for user", {
      userId,
      ids: entitled.map((s) => s.stripeSubscriptionId),
    });
  }

  return { synced: true, userId };
}

/** webhook 冪等クレーム用（route から利用） */
export async function claimWebhookEvent(input: {
  eventId: string;
  type: string;
  eventCreated: number;
}): Promise<"process" | "skip"> {
  const claimed = await db
    .insert(stripeWebhookEvents)
    .values({
      eventId: input.eventId,
      type: input.type,
      eventCreated: input.eventCreated,
    })
    .onConflictDoNothing();

  const rowsAffected = (claimed as { rowsAffected: number }).rowsAffected;

  if (rowsAffected === 0) {
    const prev = await db
      .select()
      .from(stripeWebhookEvents)
      .where(eq(stripeWebhookEvents.eventId, input.eventId))
      .limit(1);
    if (prev[0]?.processedAt) return "skip";
    // processedAt null = 前回クラッシュ → 再処理
  }
  return "process";
}

export async function markWebhookProcessed(eventId: string): Promise<void> {
  await db
    .update(stripeWebhookEvents)
    .set({ processedAt: new Date() })
    .where(eq(stripeWebhookEvents.eventId, eventId));
}

export async function releaseWebhookClaim(eventId: string): Promise<void> {
  await db
    .delete(stripeWebhookEvents)
    .where(
      and(
        eq(stripeWebhookEvents.eventId, eventId),
        isNull(stripeWebhookEvents.processedAt),
      ),
    );
}
