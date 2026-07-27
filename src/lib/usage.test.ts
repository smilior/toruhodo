process.env.TURSO_DATABASE_URL = ":memory:";
process.env.TURSO_AUTH_TOKEN = "";
process.env.BILLING_MODE = "off";

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db, dbClient } from "@/lib/db";
import { usageCounters, users } from "@/lib/db/schema";
import { consumeUsage, jstPeriod, refundUsage } from "@/lib/usage";

const USER_ID = "user_test_1";

async function applyMigrations() {
  const drizzleDir = path.join(process.cwd(), "drizzle");
  const files = (await readdir(drizzleDir))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const sql = await readFile(path.join(drizzleDir, file), "utf8");
    const statements = sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const statement of statements) {
      await dbClient.execute(statement);
    }
  }
}

async function seedUser() {
  await db.insert(users).values({
    id: USER_ID,
    name: "Test",
    email: "test@example.com",
    emailVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

async function getCount(metric: "scan" | "chat") {
  const rows = await db
    .select()
    .from(usageCounters)
    .where(
      and(
        eq(usageCounters.userId, USER_ID),
        eq(usageCounters.metric, metric),
        eq(usageCounters.period, jstPeriod()),
      ),
    );
  return rows[0]?.count ?? 0;
}

beforeAll(async () => {
  await applyMigrations();
  await seedUser();
});

beforeEach(async () => {
  process.env.BILLING_MODE = "off";
  await db.delete(usageCounters);
});

describe("jstPeriod", () => {
  it("JST 月境界を正しく跨ぐ", () => {
    // 2026-06-30 15:00:00 UTC = 2026-07-01 00:00:00 JST
    expect(jstPeriod(Date.parse("2026-06-30T15:00:00.000Z"))).toBe("2026-07");
    // 2026-06-30 14:59:59 UTC = 2026-06-30 23:59:59 JST
    expect(jstPeriod(Date.parse("2026-06-30T14:59:59.000Z"))).toBe("2026-06");
  });
});

describe("consumeUsage", () => {
  it("mode=off では ok を返し DB に行を作らない", async () => {
    process.env.BILLING_MODE = "off";
    const result = await consumeUsage(USER_ID, "scan");
    expect(result).toEqual({ ok: true });
    expect(await getCount("scan")).toBe(0);
  });

  it("mode=meter では上限超過でも ok、count は加算される", async () => {
    process.env.BILLING_MODE = "meter";
    for (let i = 0; i < 16; i++) {
      const result = await consumeUsage(USER_ID, "scan");
      expect(result).toEqual({ ok: true });
    }
    expect(await getCount("scan")).toBe(16);
  });

  it("mode=enforce では free 15 回 ok → 16 回目 LIMIT_REACHED", async () => {
    process.env.BILLING_MODE = "enforce";
    for (let i = 0; i < 15; i++) {
      const result = await consumeUsage(USER_ID, "scan");
      expect(result).toEqual({ ok: true });
    }
    const denied = await consumeUsage(USER_ID, "scan");
    expect(denied).toEqual({
      ok: false,
      error: "今月の利用回数の上限に達しました",
      code: "LIMIT_REACHED",
    });
    expect(await getCount("scan")).toBe(16);
  });

  it("並行 20 回 consume で拒否はちょうど 5 回・最終 count 20", async () => {
    process.env.BILLING_MODE = "enforce";
    const results = await Promise.all(
      Array.from({ length: 20 }, () => consumeUsage(USER_ID, "scan")),
    );
    const denied = results.filter((r) => !r.ok);
    const ok = results.filter((r) => r.ok);
    expect(ok).toHaveLength(15);
    expect(denied).toHaveLength(5);
    expect(await getCount("scan")).toBe(20);
  });
});

describe("refundUsage", () => {
  it("count 1→0、0 でもう一度呼んでも 0", async () => {
    process.env.BILLING_MODE = "meter";
    await consumeUsage(USER_ID, "scan");
    expect(await getCount("scan")).toBe(1);

    await refundUsage(USER_ID, "scan");
    expect(await getCount("scan")).toBe(0);

    await refundUsage(USER_ID, "scan");
    expect(await getCount("scan")).toBe(0);
  });
});
