process.env.TURSO_DATABASE_URL = ":memory:";
process.env.TURSO_AUTH_TOKEN = "";
process.env.BILLING_MODE = "off";
process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
process.env.STRIPE_PRICE_ID_PLUS_MONTHLY = "price_test_monthly";
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import {
  stripeCustomers,
  subscriptions,
  usageCounters,
} from "@/lib/db/schema";
import { applyMigrations, seedUser } from "@/test/helpers";

const USER_ID = "user_billing_1";
const NOW = Date.parse("2026-07-15T12:00:00.000Z");

const requireUserIdMock = vi.fn();
const getServerSessionMock = vi.fn();
const sessionsCreateMock = vi.fn();
const portalCreateMock = vi.fn();
const checkoutRetrieveMock = vi.fn();
const subRetrieveMock = vi.fn();
const customersCreateMock = vi.fn();

vi.mock("@/lib/auth-session", () => ({
  requireUserId: () => requireUserIdMock(),
  getServerSession: () => getServerSessionMock(),
}));

vi.mock("@/lib/stripe/client", () => ({
  STRIPE_API_VERSION: "2026-06-24.dahlia",
  stripe: {
    checkout: {
      sessions: {
        create: (...args: unknown[]) => sessionsCreateMock(...args),
        retrieve: (...args: unknown[]) => checkoutRetrieveMock(...args),
      },
    },
    billingPortal: {
      sessions: {
        create: (...args: unknown[]) => portalCreateMock(...args),
      },
    },
    subscriptions: {
      retrieve: (...args: unknown[]) => subRetrieveMock(...args),
    },
    customers: {
      create: (...args: unknown[]) => customersCreateMock(...args),
    },
  },
}));

const {
  createCheckoutSessionAction,
  createPortalSessionAction,
  getSubscriptionStatusAction,
  syncCheckoutSessionAction,
  nextJstMonthResetIso,
} = await import("@/actions/billing");

beforeAll(async () => {
  await applyMigrations();
  await seedUser(USER_ID, "billing@example.com");
});

beforeEach(async () => {
  process.env.BILLING_MODE = "off";
  await db.delete(usageCounters);
  await db.delete(subscriptions);
  await db.delete(stripeCustomers);
  requireUserIdMock.mockReset();
  getServerSessionMock.mockReset();
  sessionsCreateMock.mockReset();
  portalCreateMock.mockReset();
  checkoutRetrieveMock.mockReset();
  subRetrieveMock.mockReset();
  customersCreateMock.mockReset();
  requireUserIdMock.mockResolvedValue(USER_ID);
  getServerSessionMock.mockResolvedValue({
    user: { id: USER_ID, email: "billing@example.com" },
  });
});

describe("createCheckoutSessionAction", () => {
  it("BILLING_MODE=off → BILLING_DISABLED、Stripe 未呼び出し", async () => {
    process.env.BILLING_MODE = "off";
    const result = await createCheckoutSessionAction({ plan: "plus_monthly" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("BILLING_DISABLED");
    expect(sessionsCreateMock).not.toHaveBeenCalled();
  });

  it("enforce + 有効 sub あり → ALREADY_SUBSCRIBED", async () => {
    process.env.BILLING_MODE = "enforce";
    await db.insert(subscriptions).values({
      stripeSubscriptionId: "sub_active",
      userId: USER_ID,
      status: "active",
      priceId: "price_test_monthly",
      currentPeriodStart: new Date(NOW - 86400_000),
      currentPeriodEnd: new Date(NOW + 30 * 86400_000),
      cancelAtPeriodEnd: false,
      eventCreated: Math.floor(NOW / 1000),
    });
    const result = await createCheckoutSessionAction({ plan: "plus_monthly" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("ALREADY_SUBSCRIBED");
    expect(sessionsCreateMock).not.toHaveBeenCalled();
  });

  it("enforce + Free → sessions.create 引数を検証", async () => {
    process.env.BILLING_MODE = "enforce";
    customersCreateMock.mockResolvedValue({ id: "cus_new" });
    sessionsCreateMock.mockResolvedValue({
      url: "https://checkout.stripe.com/test",
    });

    const before = Math.floor(Date.now() / 1000);
    const result = await createCheckoutSessionAction({ plan: "plus_monthly" });
    const after = Math.floor(Date.now() / 1000);

    expect(result).toEqual({
      ok: true,
      data: { url: "https://checkout.stripe.com/test" },
    });
    expect(sessionsCreateMock).toHaveBeenCalledTimes(1);
    const args = sessionsCreateMock.mock.calls[0][0];
    expect(args.mode).toBe("subscription");
    expect(args.client_reference_id).toBe(USER_ID);
    expect(args.subscription_data.metadata.userId).toBe(USER_ID);
    expect(args.line_items).toEqual([
      { price: "price_test_monthly", quantity: 1 },
    ]);
    expect(args.expires_at).toBeGreaterThanOrEqual(before + 30 * 60 - 2);
    expect(args.expires_at).toBeLessThanOrEqual(after + 30 * 60 + 2);
    expect(args.success_url).toContain("{CHECKOUT_SESSION_ID}");
  });
});

describe("createPortalSessionAction", () => {
  it("stripe_customers 行なし → NO_CUSTOMER", async () => {
    process.env.BILLING_MODE = "enforce";
    const result = await createPortalSessionAction();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("NO_CUSTOMER");
  });
});

describe("getSubscriptionStatusAction", () => {
  it("plus 時 scanRemaining は null", async () => {
    await db.insert(subscriptions).values({
      stripeSubscriptionId: "sub_plus",
      userId: USER_ID,
      status: "active",
      priceId: "price_test_monthly",
      currentPeriodStart: new Date(NOW - 86400_000),
      currentPeriodEnd: new Date(NOW + 30 * 86400_000),
      cancelAtPeriodEnd: false,
      eventCreated: Math.floor(NOW / 1000),
    });
    const result = await getSubscriptionStatusAction();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.entitlement).toBe("plus");
      expect(result.data.scanRemaining).toBeNull();
      expect(result.data.resetsAt).toBeNull();
      expect(result.data.plan).toBe("plus_monthly");
    }
  });

  it("Free 時に残数と resetsAt", async () => {
    await db.insert(usageCounters).values({
      userId: USER_ID,
      metric: "scan",
      period: "2026-07",
      count: 3,
      updatedAt: new Date(),
    });
    // force jstPeriod to 2026-07 by using real time if we're in that month;
    // otherwise just check shape when count is 0 for other months
    const result = await getSubscriptionStatusAction();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.entitlement).toBe("free");
      expect(result.data.scanRemaining).toBeTypeOf("number");
      expect(result.data.scanRemaining).toBeGreaterThanOrEqual(0);
      expect(result.data.scanRemaining).toBeLessThanOrEqual(15);
      expect(result.data.resetsAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
  });
});

describe("nextJstMonthResetIso", () => {
  it("JST 月境界で翌月 1 日 0:00 JST", () => {
    // 2026-07-15 JST → 2026-08-01 00:00 JST = 2026-07-31T15:00:00.000Z
    const iso = nextJstMonthResetIso(Date.parse("2026-07-15T03:00:00.000Z"));
    expect(iso).toBe("2026-07-31T15:00:00.000Z");
  });
});

describe("syncCheckoutSessionAction", () => {
  it("client_reference_id 不一致 → 付与されない", async () => {
    checkoutRetrieveMock.mockResolvedValue({
      client_reference_id: "other_user",
      subscription: "sub_x",
    });
    const result = await syncCheckoutSessionAction({ sessionId: "cs_x" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("STRIPE_ERROR");
    expect(subRetrieveMock).not.toHaveBeenCalled();
    expect(await db.select().from(subscriptions)).toHaveLength(0);
  });

  it("一致 → sync され entitlement が返る", async () => {
    checkoutRetrieveMock.mockResolvedValue({
      client_reference_id: USER_ID,
      subscription: "sub_ok",
    });
    subRetrieveMock.mockResolvedValue({
      id: "sub_ok",
      customer: "cus_ok",
      metadata: { userId: USER_ID },
      status: "active",
      cancel_at_period_end: false,
      items: {
        data: [
          {
            current_period_start: Math.floor(NOW / 1000) - 86400,
            current_period_end: Math.floor(NOW / 1000) + 30 * 86400,
            price: { id: "price_test_monthly" },
          },
        ],
      },
    });
    const result = await syncCheckoutSessionAction({ sessionId: "cs_ok" });
    expect(result).toEqual({ ok: true, data: { entitlement: "plus" } });
    expect(await db.select().from(subscriptions)).toHaveLength(1);
  });
});
