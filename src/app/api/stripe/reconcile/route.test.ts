process.env.TURSO_DATABASE_URL = ":memory:";
process.env.TURSO_AUTH_TOKEN = "";
process.env.BILLING_MODE = "off";
process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
process.env.CRON_SECRET = "cron_secret_test";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { stripeCustomers, subscriptions } from "@/lib/db/schema";
import { applyMigrations, seedUser } from "@/test/helpers";

const USER_ID = "user_reconcile_1";
const NOW = Date.parse("2026-07-15T12:00:00.000Z");
const NOW_S = Math.floor(NOW / 1000);

const retrieveMock = vi.fn();
const cancelMock = vi.fn();
const listMock = vi.fn();

vi.mock("@/lib/stripe/client", () => ({
  STRIPE_API_VERSION: "2026-06-24.dahlia",
  stripe: {
    subscriptions: {
      retrieve: (...args: unknown[]) => retrieveMock(...args),
      cancel: (...args: unknown[]) => cancelMock(...args),
      list: (...args: unknown[]) => listMock(...args),
    },
  },
}));

const { GET } = await import("@/app/api/stripe/reconcile/route");

function makeRemote(id: string, created: number, status = "active") {
  return {
    id,
    customer: "cus_r",
    metadata: { userId: USER_ID },
    status,
    created,
    cancel_at_period_end: false,
    items: {
      data: [
        {
          current_period_start: NOW_S - 86400,
          current_period_end: NOW_S + 30 * 86400,
          price: { id: "price_test" },
        },
      ],
    },
  };
}

async function* emptyList() {
  // no yields
}

beforeAll(async () => {
  await applyMigrations();
  await seedUser(USER_ID, "reconcile@example.com");
  await db.insert(stripeCustomers).values({
    userId: USER_ID,
    stripeCustomerId: "cus_r",
  });
});

beforeEach(async () => {
  await db.delete(subscriptions);
  retrieveMock.mockReset();
  cancelMock.mockReset();
  listMock.mockReset();
  listMock.mockReturnValue(emptyList());
});

describe("GET /api/stripe/reconcile", () => {
  it("Bearer 不一致 → 401", async () => {
    const res = await GET(
      new Request("http://localhost/api/stripe/reconcile", {
        headers: { authorization: "Bearer wrong" },
      }),
    );
    expect(res.status).toBe(401);
    expect(retrieveMock).not.toHaveBeenCalled();
  });

  it("非終端は sync、canceled は retrieve されない", async () => {
    await db.insert(subscriptions).values([
      {
        stripeSubscriptionId: "sub_active",
        userId: USER_ID,
        status: "active",
        priceId: "price_test",
        currentPeriodStart: new Date(NOW - 86400_000),
        currentPeriodEnd: new Date(NOW + 30 * 86400_000),
        cancelAtPeriodEnd: false,
        eventCreated: NOW_S,
      },
      {
        stripeSubscriptionId: "sub_canceled",
        userId: USER_ID,
        status: "canceled",
        priceId: "price_test",
        currentPeriodStart: new Date(NOW - 60 * 86400_000),
        currentPeriodEnd: new Date(NOW - 30 * 86400_000),
        cancelAtPeriodEnd: false,
        eventCreated: NOW_S - 1000,
      },
    ]);
    retrieveMock.mockResolvedValue(makeRemote("sub_active", NOW_S));

    const res = await GET(
      new Request("http://localhost/api/stripe/reconcile", {
        headers: { authorization: "Bearer cron_secret_test" },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.checked).toBe(1);
    expect(retrieveMock.mock.calls.map((c) => c[0])).toEqual(["sub_active"]);
  });

  it("entitled 2 件 → 新しい方を cancel", async () => {
    await db.insert(subscriptions).values([
      {
        stripeSubscriptionId: "sub_old",
        userId: USER_ID,
        status: "active",
        priceId: "price_test",
        currentPeriodStart: new Date(NOW - 86400_000),
        currentPeriodEnd: new Date(NOW + 30 * 86400_000),
        cancelAtPeriodEnd: false,
        eventCreated: NOW_S,
      },
      {
        stripeSubscriptionId: "sub_new",
        userId: USER_ID,
        status: "active",
        priceId: "price_test",
        currentPeriodStart: new Date(NOW - 86400_000),
        currentPeriodEnd: new Date(NOW + 30 * 86400_000),
        cancelAtPeriodEnd: false,
        eventCreated: NOW_S,
      },
    ]);

    retrieveMock.mockImplementation(async (id: string) => {
      if (id === "sub_old") return makeRemote("sub_old", 1000);
      if (id === "sub_new") return makeRemote("sub_new", 2000);
      return makeRemote(id, NOW_S);
    });
    cancelMock.mockResolvedValue(makeRemote("sub_new", 2000, "canceled"));

    const res = await GET(
      new Request("http://localhost/api/stripe/reconcile", {
        headers: { authorization: "Bearer cron_secret_test" },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.duplicatesCanceled).toBeGreaterThanOrEqual(1);
    expect(cancelMock).toHaveBeenCalledWith("sub_new");
  });

  it("個別 sync が throw しても 200 で errors カウント", async () => {
    await db.insert(subscriptions).values({
      stripeSubscriptionId: "sub_boom",
      userId: USER_ID,
      status: "active",
      priceId: "price_test",
      currentPeriodStart: new Date(NOW - 86400_000),
      currentPeriodEnd: new Date(NOW + 30 * 86400_000),
      cancelAtPeriodEnd: false,
      eventCreated: NOW_S,
    });
    retrieveMock.mockRejectedValue(new Error("network"));

    const res = await GET(
      new Request("http://localhost/api/stripe/reconcile", {
        headers: { authorization: "Bearer cron_secret_test" },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.errors).toBeGreaterThanOrEqual(1);
  });
});
