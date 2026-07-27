process.env.TURSO_DATABASE_URL = ":memory:";
process.env.TURSO_AUTH_TOKEN = "";
process.env.BILLING_MODE = "off";
process.env.STRIPE_SECRET_KEY = "sk_test_dummy";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { stripeCustomers } from "@/lib/db/schema";
import { applyMigrations, seedUser } from "@/test/helpers";

const createMock = vi.fn();
const delMock = vi.fn();

vi.mock("@/lib/stripe/client", () => ({
  STRIPE_API_VERSION: "2026-06-24.dahlia",
  stripe: {
    customers: {
      create: (...args: unknown[]) => createMock(...args),
      del: (...args: unknown[]) => delMock(...args),
    },
  },
}));

const { getOrCreateCustomer } = await import("@/lib/stripe/customer");

const USER_ID = "user_cust_1";

beforeAll(async () => {
  await applyMigrations();
  await seedUser(USER_ID, "cust@example.com");
});

beforeEach(async () => {
  await db.delete(stripeCustomers);
  createMock.mockReset();
  delMock.mockReset();
});

describe("getOrCreateCustomer", () => {
  it("既存行あり → stripe.customers.create が呼ばれない", async () => {
    await db.insert(stripeCustomers).values({
      userId: USER_ID,
      stripeCustomerId: "cus_existing",
    });

    const id = await getOrCreateCustomer(USER_ID, "cust@example.com");
    expect(id).toBe("cus_existing");
    expect(createMock).not.toHaveBeenCalled();
  });

  it("新規 → create → INSERT → id 返却", async () => {
    createMock.mockResolvedValue({ id: "cus_new" });
    const id = await getOrCreateCustomer(USER_ID, "cust@example.com");
    expect(id).toBe("cus_new");
    expect(createMock).toHaveBeenCalledWith(
      { email: "cust@example.com", metadata: { userId: USER_ID } },
      { idempotencyKey: `cust-create-${USER_ID}` },
    );
    const rows = await db.select().from(stripeCustomers);
    expect(rows[0].stripeCustomerId).toBe("cus_new");
  });

  it("INSERT 競合 → 自分の Customer を del し勝者 id を返す", async () => {
    // 勝者が先に行を持つ状況を、create 後の INSERT 前に仕込むのは難しいので
    // create モック内で勝者行を INSERT する
    createMock.mockImplementation(async () => {
      await db.insert(stripeCustomers).values({
        userId: USER_ID,
        stripeCustomerId: "cus_winner",
      });
      return { id: "cus_loser" };
    });
    delMock.mockResolvedValue({});

    const id = await getOrCreateCustomer(USER_ID, "cust@example.com");
    expect(id).toBe("cus_winner");
    expect(delMock).toHaveBeenCalledWith("cus_loser");
  });
});
