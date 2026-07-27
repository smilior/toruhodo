import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { subscriptions } from "@/lib/db/schema";
import { stripe } from "@/lib/stripe/client";
import {
  resolveDuplicateSubscriptions,
  syncStripeSubscription,
} from "@/lib/stripe/sync";

export const runtime = "nodejs";

const TERMINAL = new Set(["canceled", "incomplete_expired"]);

function authorize(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export async function GET(req: Request): Promise<Response> {
  if (!authorize(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let checked = 0;
  let backfilled = 0;
  let duplicatesCanceled = 0;
  let errors = 0;

  // 1) 非終端 subscription を再同期
  const rows = await db.select().from(subscriptions);
  const nonTerminal = rows.filter((r) => !TERMINAL.has(r.status));
  const userIds = new Set<string>();

  for (const row of nonTerminal) {
    userIds.add(row.userId);
    try {
      await syncStripeSubscription(row.stripeSubscriptionId);
      checked += 1;
    } catch (err) {
      console.error(
        "[stripe] reconcile sync failed",
        row.stripeSubscriptionId,
        err,
      );
      errors += 1;
    }
  }

  // 2) Stripe 側にあって DB に無い契約を補完
  try {
    for await (const sub of stripe.subscriptions.list({
      status: "all",
      limit: 100,
    })) {
      const metaUserId = sub.metadata?.userId;
      if (!metaUserId) continue;
      const exists = rows.some((r) => r.stripeSubscriptionId === sub.id);
      if (exists) continue;
      try {
        await syncStripeSubscription(sub.id);
        backfilled += 1;
        userIds.add(metaUserId);
      } catch (err) {
        console.error("[stripe] reconcile backfill failed", sub.id, err);
        errors += 1;
      }
    }
  } catch (err) {
    console.error("[stripe] reconcile list failed", err);
    errors += 1;
  }

  // 3) 二重契約の自己修復
  for (const userId of userIds) {
    try {
      const canceled = await resolveDuplicateSubscriptions(userId);
      duplicatesCanceled += canceled.length;
    } catch (err) {
      console.error("[stripe] reconcile dedupe failed", userId, err);
      errors += 1;
    }
  }

  return NextResponse.json({
    checked,
    backfilled,
    duplicatesCanceled,
    errors,
  });
}
