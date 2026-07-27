process.env.TURSO_DATABASE_URL = ":memory:";
process.env.TURSO_AUTH_TOKEN = "";
process.env.BILLING_MODE = "off";
process.env.STRIPE_SECRET_KEY = "sk_test_dummy";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { stripeCustomers, subscriptions } from "@/lib/db/schema";
import { applyMigrations, seedUser } from "@/test/helpers";

const retrieveMock = vi.fn();
const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

vi.mock("@/lib/stripe/client", () => ({
  STRIPE_API_VERSION: "2026-06-24.dahlia",
  stripe: {
    subscriptions: {
      retrieve: (...args: unknown[]) => retrieveMock(...args),
    },
  },
}));

const { extractPeriod, syncStripeSubscription, upsertSubscriptionRow } =
  await import("@/lib/stripe/sync");

const USER_ID = "user_sync_1";
const NOW_S = Math.floor(Date.parse("2026-07-15T12:00:00.000Z") / 1000);

function makeStripeSub(overrides: {
  id?: string;
  customer?: string;
  metadata?: Record<string, string>;
  items?: Array<{
    current_period_start: number;
    current_period_end: number;
    price?: { id: string };
  }>;
  status?: string;
} = {}) {
  const items = overrides.items ?? [
    {
      current_period_start: NOW_S - 86400,
      current_period_end: NOW_S + 30 * 86400,
      price: { id: "price_test" },
    },
  ];
  return {
    id: overrides.id ?? "sub_1",
    customer: overrides.customer ?? "cus_1",
    metadata: overrides.metadata ?? {},
    status: overrides.status ?? "active",
    cancel_at_period_end: false,
    items: { data: items },
  };
}

beforeAll(async () => {
  await applyMigrations();
  await seedUser(USER_ID, "sync@example.com");
});

beforeEach(async () => {
  await db.delete(subscriptions);
  await db.delete(stripeCustomers);
  retrieveMock.mockReset();
  warnSpy.mockClear();
});

describe("extractPeriod", () => {
  it("items 1 件 → start/end が unix秒×1000 の Date", () => {
    const start = NOW_S - 100;
    const end = NOW_S + 100;
    const period = extractPeriod(
      makeStripeSub({
        items: [
          {
            current_period_start: start,
            current_period_end: end,
            price: { id: "price_x" },
          },
        ],
      }) as never,
    );
    expect(period.start.getTime()).toBe(start * 1000);
    expect(period.end.getTime()).toBe(end * 1000);
  });

  it("items 2 件 → warn が出て data[0] を採用", () => {
    const period = extractPeriod(
      makeStripeSub({
        items: [
          {
            current_period_start: 1000,
            current_period_end: 2000,
            price: { id: "price_a" },
          },
          {
            current_period_start: 3000,
            current_period_end: 4000,
            price: { id: "price_b" },
          },
        ],
      }) as never,
    );
    expect(period.start.getTime()).toBe(1000 * 1000);
    expect(period.end.getTime()).toBe(2000 * 1000);
    expect(warnSpy).toHaveBeenCalled();
  });
});

describe("upsertSubscriptionRow (LWW)", () => {
  it("古い event_created は破棄、同秒は上書き", async () => {
    await db.insert(stripeCustomers).values({
      userId: USER_ID,
      stripeCustomerId: "cus_1",
    });

    await upsertSubscriptionRow({
      stripeSubscriptionId: "sub_lww",
      userId: USER_ID,
      status: "active",
      priceId: "price_old",
      currentPeriodStart: new Date(NOW_S * 1000),
      currentPeriodEnd: new Date((NOW_S + 1000) * 1000),
      cancelAtPeriodEnd: false,
      eventCreated: 200,
    });

    await upsertSubscriptionRow({
      stripeSubscriptionId: "sub_lww",
      userId: USER_ID,
      status: "canceled",
      priceId: "price_stale",
      currentPeriodStart: new Date(NOW_S * 1000),
      currentPeriodEnd: new Date((NOW_S + 1000) * 1000),
      cancelAtPeriodEnd: false,
      eventCreated: 100,
    });

    let row = (
      await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.stripeSubscriptionId, "sub_lww"))
    )[0];
    expect(row.status).toBe("active");
    expect(row.priceId).toBe("price_old");
    expect(row.eventCreated).toBe(200);

    await upsertSubscriptionRow({
      stripeSubscriptionId: "sub_lww",
      userId: USER_ID,
      status: "past_due",
      priceId: "price_new",
      currentPeriodStart: new Date(NOW_S * 1000),
      currentPeriodEnd: new Date((NOW_S + 1000) * 1000),
      cancelAtPeriodEnd: true,
      eventCreated: 200,
    });

    row = (
      await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.stripeSubscriptionId, "sub_lww"))
    )[0];
    expect(row.status).toBe("past_due");
    expect(row.priceId).toBe("price_new");
    expect(row.cancelAtPeriodEnd).toBe(true);
  });
});

describe("syncStripeSubscription", () => {
  it("stripe_customers 紐付けあり → synced:true", async () => {
    await db.insert(stripeCustomers).values({
      userId: USER_ID,
      stripeCustomerId: "cus_1",
    });
    retrieveMock.mockResolvedValue(
      makeStripeSub({ customer: "cus_1", id: "sub_map" }),
    );

    const result = await syncStripeSubscription("sub_map");
    expect(result).toEqual({ synced: true, userId: USER_ID });
    const rows = await db.select().from(subscriptions);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("active");
  });

  it("紐付けなし・metadata.userId あり → stripe_customers 補完", async () => {
    retrieveMock.mockResolvedValue(
      makeStripeSub({
        customer: "cus_meta",
        id: "sub_meta",
        metadata: { userId: USER_ID },
      }),
    );

    const result = await syncStripeSubscription("sub_meta");
    expect(result).toEqual({ synced: true, userId: USER_ID });
    const customers = await db.select().from(stripeCustomers);
    expect(customers).toHaveLength(1);
    expect(customers[0].stripeCustomerId).toBe("cus_meta");
  });

  it("どちらもなし → NO_USER_MAPPING、subscriptions 無書込", async () => {
    retrieveMock.mockResolvedValue(
      makeStripeSub({
        customer: "cus_unknown",
        id: "sub_orphan",
        metadata: {},
      }),
    );

    const result = await syncStripeSubscription("sub_orphan");
    expect(result).toEqual({ synced: false, reason: "NO_USER_MAPPING" });
    expect(await db.select().from(subscriptions)).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalled();
  });
});
