process.env.TURSO_DATABASE_URL = ":memory:";
process.env.TURSO_AUTH_TOKEN = "";
process.env.BILLING_MODE = "off";
process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import Stripe from "stripe";
import { db } from "@/lib/db";
import {
  stripeCustomers,
  stripeWebhookEvents,
  subscriptions,
} from "@/lib/db/schema";
import { applyMigrations, seedUser } from "@/test/helpers";

const retrieveMock = vi.fn();
const constructEventMock = vi.fn();

vi.mock("@/lib/stripe/client", () => ({
  STRIPE_API_VERSION: "2026-06-24.dahlia",
  stripe: {
    subscriptions: {
      retrieve: (...args: unknown[]) => retrieveMock(...args),
    },
    webhooks: {
      constructEvent: (...args: unknown[]) => constructEventMock(...args),
    },
  },
}));

const { POST } = await import("@/app/api/stripe/webhook/route");

const USER_ID = "user_wh_1";
const NOW_S = Math.floor(Date.now() / 1000);

function signedRequest(event: Stripe.Event, sig = "t=1,v1=valid") {
  return new Request("http://localhost/api/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": sig },
    body: JSON.stringify(event),
  });
}

function makeSubEvent(
  id: string,
  type: Stripe.Event.Type = "customer.subscription.updated",
): Stripe.Event {
  return {
    id,
    object: "event",
    api_version: "2026-06-24.dahlia",
    created: NOW_S,
    type,
    livemode: false,
    pending_webhooks: 0,
    request: null,
    data: {
      object: {
        id: "sub_wh",
        object: "subscription",
        customer: "cus_wh",
        status: "active",
      } as Stripe.Subscription,
    },
  } as Stripe.Event;
}

beforeAll(async () => {
  await applyMigrations();
  await seedUser(USER_ID, "wh@example.com");
  await db.insert(stripeCustomers).values({
    userId: USER_ID,
    stripeCustomerId: "cus_wh",
  });
});

beforeEach(async () => {
  await db.delete(subscriptions);
  await db.delete(stripeWebhookEvents);
  retrieveMock.mockReset();
  constructEventMock.mockReset();
  retrieveMock.mockResolvedValue({
    id: "sub_wh",
    customer: "cus_wh",
    metadata: {},
    status: "active",
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
  });
});

describe("POST /api/stripe/webhook", () => {
  it("同一 eventId を 2 回 POST → 2 回とも 200、retrieve は 1 回", async () => {
    const event = makeSubEvent("evt_once");
    constructEventMock.mockReturnValue(event);

    const r1 = await POST(signedRequest(event));
    const r2 = await POST(signedRequest(event));
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(retrieveMock).toHaveBeenCalledTimes(1);
  });

  it("sync が throw → 500 + クレーム解放 → 再 POST で成功", async () => {
    const event = makeSubEvent("evt_crash");
    constructEventMock.mockReturnValue(event);
    retrieveMock
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({
        id: "sub_wh",
        customer: "cus_wh",
        metadata: {},
        status: "active",
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
      });

    const fail = await POST(signedRequest(event));
    expect(fail.status).toBe(500);

    const claim = await db
      .select()
      .from(stripeWebhookEvents)
      .where(eq(stripeWebhookEvents.eventId, "evt_crash"));
    expect(claim).toHaveLength(0);

    const ok = await POST(signedRequest(event));
    expect(ok.status).toBe(200);
    const done = await db
      .select()
      .from(stripeWebhookEvents)
      .where(eq(stripeWebhookEvents.eventId, "evt_crash"));
    expect(done[0]?.processedAt).toBeTruthy();
  });

  it("署名不正 → 400、DB 無書込", async () => {
    constructEventMock.mockImplementation(() => {
      throw new Error("Invalid signature");
    });
    const event = makeSubEvent("evt_bad_sig");
    const res = await POST(signedRequest(event, "bad"));
    expect(res.status).toBe(400);
    expect(await db.select().from(stripeWebhookEvents)).toHaveLength(0);
    expect(retrieveMock).not.toHaveBeenCalled();
  });

  it("customer.deleted → stripe_customers の該当行が消える", async () => {
    const before = await db
      .select()
      .from(stripeCustomers)
      .where(eq(stripeCustomers.stripeCustomerId, "cus_wh"));
    expect(before).toHaveLength(1);

    const event = {
      id: "evt_cust_del",
      object: "event",
      api_version: "2026-06-24.dahlia",
      created: NOW_S,
      type: "customer.deleted",
      livemode: false,
      pending_webhooks: 0,
      request: null,
      data: {
        object: { id: "cus_wh", object: "customer", deleted: true },
      },
    } as unknown as Stripe.Event;
    constructEventMock.mockReturnValue(event);

    const res = await POST(signedRequest(event));
    expect(res.status).toBe(200);
    const rows = await db
      .select()
      .from(stripeCustomers)
      .where(eq(stripeCustomers.stripeCustomerId, "cus_wh"));
    expect(rows).toHaveLength(0);

    // restore for other tests
    await db.insert(stripeCustomers).values({
      userId: USER_ID,
      stripeCustomerId: "cus_wh",
    });
  });
});
