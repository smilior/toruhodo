"use server";

import { and, eq } from "drizzle-orm";
import { getServerSession, requireUserId } from "@/lib/auth-session";
import { getEntitlement, isEntitled } from "@/lib/billing/entitlement";
import { db } from "@/lib/db";
import {
  stripeCustomers,
  subscriptions,
  usageCounters,
} from "@/lib/db/schema";
import { stripe } from "@/lib/stripe/client";
import { getOrCreateCustomer } from "@/lib/stripe/customer";
import { syncStripeSubscription } from "@/lib/stripe/sync";
import { billingMode, jstPeriod, LIMITS } from "@/lib/usage";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: BillingErrorCode };

export type BillingPlan = "plus_monthly";

export type BillingErrorCode =
  | "UNAUTHORIZED"
  | "BILLING_DISABLED"
  | "ALREADY_SUBSCRIBED"
  | "NO_CUSTOMER"
  | "STRIPE_ERROR";

export type SubscriptionStatusView = {
  entitlement: "free" | "plus";
  stripeStatus:
    | "trialing"
    | "active"
    | "past_due"
    | "canceled"
    | "unpaid"
    | "incomplete"
    | "incomplete_expired"
    | "paused"
    | null;
  plan: BillingPlan | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  scanRemaining: number | null;
  resetsAt: string | null;
};

function appUrl(): string | null {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || null;
}

function priceIdForPlan(plan: BillingPlan): string | null {
  if (plan === "plus_monthly") {
    return process.env.STRIPE_PRICE_ID_PLUS_MONTHLY || null;
  }
  return null;
}

function fail(
  error: string,
  code: BillingErrorCode,
): { ok: false; error: string; code: BillingErrorCode } {
  return { ok: false, error, code };
}

/** 翌月 1 日 0:00 JST の ISO 8601 */
export function nextJstMonthResetIso(now = Date.now()): string {
  const jst = new Date(now + 9 * 3600_000);
  const y = jst.getUTCFullYear();
  const m = jst.getUTCMonth(); // 0-11 in JST wall
  // 翌月 1 日 00:00 JST = UTC で前月最終日 15:00
  const nextMonthUtc = Date.UTC(y, m + 1, 1, 0, 0, 0) - 9 * 3600_000;
  return new Date(nextMonthUtc).toISOString();
}

async function requireUser(): Promise<
  | { ok: true; userId: string; email: string }
  | { ok: false; error: string; code: "UNAUTHORIZED" }
> {
  try {
    const userId = await requireUserId();
    const session = await getServerSession();
    const email = session?.user?.email ?? "";
    return { ok: true, userId, email };
  } catch {
    return { ok: false, error: "ログインが必要です", code: "UNAUTHORIZED" };
  }
}

export async function createCheckoutSessionAction(input: {
  plan: BillingPlan;
}): Promise<ActionResult<{ url: string }>> {
  try {
    if (billingMode() !== "enforce") {
      return fail("現在お申し込みは受け付けていません", "BILLING_DISABLED");
    }

    const auth = await requireUser();
    if (!auth.ok) return auth;

    if (input.plan !== "plus_monthly") {
      return fail("プランが正しくありません", "STRIPE_ERROR");
    }
    const priceId = priceIdForPlan(input.plan);
    const base = appUrl();
    if (!priceId || !base) {
      return fail(
        "お支払いの準備ができませんでした。しばらくしてからお試しください",
        "STRIPE_ERROR",
      );
    }

    const subs = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, auth.userId));
    if (subs.some((s) => isEntitled(s))) {
      return fail(
        "すでに撮るほどプラスをご利用中です",
        "ALREADY_SUBSCRIBED",
      );
    }

    const customerId = await getOrCreateCustomer(auth.userId, auth.email);
    const expiresAt = Math.floor(Date.now() / 1000) + 30 * 60;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: auth.userId,
      subscription_data: { metadata: { userId: auth.userId } },
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${base}/settings?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/settings?checkout=cancel`,
      locale: "ja",
      allow_promotion_codes: true,
      expires_at: expiresAt,
      custom_text: {
        submit: {
          message:
            "1か月ごとの自動更新です。解約はいつでもアプリの設定→プランから行えます。",
        },
      },
      consent_collection: { terms_of_service: "required" },
      billing_address_collection: "auto",
    });

    if (!session.url) {
      return fail(
        "お支払いページを開けませんでした。しばらくしてからお試しください",
        "STRIPE_ERROR",
      );
    }

    return { ok: true, data: { url: session.url } };
  } catch (err) {
    console.error("[billing] createCheckoutSessionAction", err);
    return fail(
      "お支払いの準備に失敗しました。しばらくしてからお試しください",
      "STRIPE_ERROR",
    );
  }
}

export async function createPortalSessionAction(): Promise<
  ActionResult<{ url: string }>
> {
  try {
    if (billingMode() !== "enforce") {
      return fail("現在お申し込みは受け付けていません", "BILLING_DISABLED");
    }

    const auth = await requireUser();
    if (!auth.ok) return auth;

    const base = appUrl();
    if (!base) {
      return fail(
        "設定を開けませんでした。しばらくしてからお試しください",
        "STRIPE_ERROR",
      );
    }

    const row = await db
      .select()
      .from(stripeCustomers)
      .where(eq(stripeCustomers.userId, auth.userId))
      .limit(1);
    if (!row[0]) {
      return fail(
        "お支払い情報が見つかりません。先にプラスをお申し込みください",
        "NO_CUSTOMER",
      );
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: row[0].stripeCustomerId,
      return_url: `${base}/settings`,
    });

    return { ok: true, data: { url: session.url } };
  } catch (err) {
    console.error("[billing] createPortalSessionAction", err);
    return fail(
      "お支払い設定を開けませんでした。しばらくしてからお試しください",
      "STRIPE_ERROR",
    );
  }
}

export async function getSubscriptionStatusAction(): Promise<
  ActionResult<SubscriptionStatusView>
> {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth;

    const entitlement = await getEntitlement(auth.userId);
    const subs = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, auth.userId));

    const entitled = subs.filter((s) => isEntitled(s));
    const display =
      entitled.length > 0
        ? entitled.reduce((a, b) =>
            a.currentPeriodEnd.getTime() >= b.currentPeriodEnd.getTime()
              ? a
              : b,
          )
        : null;

    const monthlyPrice = process.env.STRIPE_PRICE_ID_PLUS_MONTHLY;
    const plan: BillingPlan | null =
      display && monthlyPrice && display.priceId === monthlyPrice
        ? "plus_monthly"
        : null;

    let scanRemaining: number | null = null;
    let resetsAt: string | null = null;
    if (entitlement === "free") {
      const period = jstPeriod();
      const usage = await db
        .select()
        .from(usageCounters)
        .where(
          and(
            eq(usageCounters.userId, auth.userId),
            eq(usageCounters.metric, "scan"),
            eq(usageCounters.period, period),
          ),
        )
        .limit(1);
      const count = usage[0]?.count ?? 0;
      const limit = LIMITS.free.scan;
      scanRemaining = Math.max(0, limit - Math.min(count, limit));
      resetsAt = nextJstMonthResetIso();
    }

    const stripeStatus = display
      ? (display.status as SubscriptionStatusView["stripeStatus"])
      : null;

    return {
      ok: true,
      data: {
        entitlement,
        stripeStatus,
        plan,
        cancelAtPeriodEnd: display?.cancelAtPeriodEnd ?? false,
        currentPeriodEnd: display?.currentPeriodEnd.toISOString() ?? null,
        scanRemaining,
        resetsAt,
      },
    };
  } catch (err) {
    console.error("[billing] getSubscriptionStatusAction", err);
    return fail(
      "プラン情報を取得できませんでした",
      "STRIPE_ERROR",
    );
  }
}

export async function syncCheckoutSessionAction(input: {
  sessionId: string;
}): Promise<ActionResult<{ entitlement: "free" | "plus" }>> {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth;

    if (!input.sessionId || typeof input.sessionId !== "string") {
      return fail("セッションが正しくありません", "STRIPE_ERROR");
    }

    const session = await stripe.checkout.sessions.retrieve(input.sessionId);
    if (session.client_reference_id !== auth.userId) {
      // 乗っ取り防止: 付与しない・詳細も返さない
      return fail("セッションを確認できませんでした", "STRIPE_ERROR");
    }

    const subId =
      typeof session.subscription === "string"
        ? session.subscription
        : session.subscription?.id;
    if (subId) {
      await syncStripeSubscription(subId);
    }

    const entitlement = await getEntitlement(auth.userId);
    return { ok: true, data: { entitlement } };
  } catch (err) {
    console.error("[billing] syncCheckoutSessionAction", err);
    return fail(
      "お支払い結果の反映に失敗しました。しばらくしてから設定を開いてください",
      "STRIPE_ERROR",
    );
  }
}
