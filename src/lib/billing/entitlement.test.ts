process.env.TURSO_DATABASE_URL = ":memory:";
process.env.TURSO_AUTH_TOKEN = "";
process.env.BILLING_MODE = "off";

import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { subscriptions, type SubscriptionRow } from "@/lib/db/schema";
import {
  CLOCK_SKEW_MS,
  getEntitlement,
  isEntitled,
  PAST_DUE_GRACE_MS,
  RENEWAL_GRACE_MS,
} from "@/lib/billing/entitlement";
import { applyMigrations, seedUser } from "@/test/helpers";

const USER_ID = "user_entitlement_1";
const NOW = Date.parse("2026-07-15T12:00:00.000Z");

function makeSub(
  overrides: Partial<SubscriptionRow> & Pick<SubscriptionRow, "status">,
): SubscriptionRow {
  return {
    stripeSubscriptionId: overrides.stripeSubscriptionId ?? "sub_test",
    userId: overrides.userId ?? USER_ID,
    status: overrides.status,
    priceId: overrides.priceId ?? "price_test",
    currentPeriodEnd:
      overrides.currentPeriodEnd ?? new Date(NOW + 30 * 24 * 3600_000),
    currentPeriodStart:
      overrides.currentPeriodStart ?? new Date(NOW - 1 * 24 * 3600_000),
    cancelAtPeriodEnd: overrides.cancelAtPeriodEnd ?? false,
    eventCreated: overrides.eventCreated ?? Math.floor(NOW / 1000),
    updatedAt: overrides.updatedAt ?? new Date(NOW),
  };
}

beforeAll(async () => {
  await applyMigrations();
  await seedUser(USER_ID, "entitlement@example.com");
});

beforeEach(async () => {
  await db.delete(subscriptions);
});

describe("isEntitled", () => {
  it("active: periodEnd + 48h + 5min 未満は true、超過は false", () => {
    const end = new Date(NOW);
    const sub = makeSub({ status: "active", currentPeriodEnd: end });
    const grace = RENEWAL_GRACE_MS + CLOCK_SKEW_MS;

    expect(isEntitled(sub, NOW + grace - 1)).toBe(true);
    expect(isEntitled(sub, NOW + grace)).toBe(false);
  });

  it("trialing: active と同判定", () => {
    const end = new Date(NOW + 10 * 24 * 3600_000);
    const sub = makeSub({ status: "trialing", currentPeriodEnd: end });
    expect(isEntitled(sub, NOW)).toBe(true);
    expect(
      isEntitled(sub, end.getTime() + RENEWAL_GRACE_MS + CLOCK_SKEW_MS),
    ).toBe(false);
  });

  it("past_due: currentPeriodStart + 7日 を使う（End ではない）", () => {
    const start = new Date(NOW - 3 * 24 * 3600_000);
    const farEnd = new Date(NOW + 30 * 24 * 3600_000);
    const sub = makeSub({
      status: "past_due",
      currentPeriodStart: start,
      currentPeriodEnd: farEnd,
    });

    expect(isEntitled(sub, start.getTime() + PAST_DUE_GRACE_MS - 1)).toBe(
      true,
    );
    expect(isEntitled(sub, start.getTime() + PAST_DUE_GRACE_MS)).toBe(false);
    expect(isEntitled(sub, NOW + 10 * 24 * 3600_000)).toBe(false);
  });

  it.each([
    "canceled",
    "unpaid",
    "incomplete",
    "incomplete_expired",
    "paused",
  ] as const)("%s は常に false", (status) => {
    const sub = makeSub({ status });
    expect(isEntitled(sub, NOW)).toBe(false);
  });
});

describe("getEntitlement", () => {
  it("行なし → free", async () => {
    expect(await getEntitlement(USER_ID)).toBe("free");
  });

  it("canceled 1 行 → free", async () => {
    await db.insert(subscriptions).values(
      makeSub({
        stripeSubscriptionId: "sub_canceled",
        status: "canceled",
      }),
    );
    expect(await getEntitlement(USER_ID)).toBe("free");
  });

  it("canceled + active の 2 行 → plus", async () => {
    await db.insert(subscriptions).values([
      makeSub({
        stripeSubscriptionId: "sub_old",
        status: "canceled",
      }),
      makeSub({
        stripeSubscriptionId: "sub_new",
        status: "active",
        currentPeriodEnd: new Date(NOW + 20 * 24 * 3600_000),
      }),
    ]);
    expect(await getEntitlement(USER_ID)).toBe("plus");
  });
});
