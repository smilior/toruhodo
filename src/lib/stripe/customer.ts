import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { stripeCustomers } from "@/lib/db/schema";
import { stripe } from "@/lib/stripe/client";

/**
 * §5.3: Customer を lazy 作成し userId と双方向に紐付ける。
 * 並行 Checkout の重複は DB を調停者にして吸収する。
 */
export async function getOrCreateCustomer(
  userId: string,
  email: string,
): Promise<string> {
  const existing = await db
    .select()
    .from(stripeCustomers)
    .where(eq(stripeCustomers.userId, userId))
    .limit(1);
  if (existing[0]) return existing[0].stripeCustomerId;

  const created = await stripe.customers.create(
    { email, metadata: { userId } },
    { idempotencyKey: `cust-create-${userId}` },
  );

  await db
    .insert(stripeCustomers)
    .values({ userId, stripeCustomerId: created.id })
    .onConflictDoNothing();

  const row = await db
    .select()
    .from(stripeCustomers)
    .where(eq(stripeCustomers.userId, userId))
    .limit(1);

  const winnerId = row[0]?.stripeCustomerId;
  if (!winnerId) {
    throw new Error("stripe_customers の作成に失敗しました");
  }

  if (winnerId !== created.id) {
    // 並行作成で負けた分はベストエフォート削除
    try {
      await stripe.customers.del(created.id);
    } catch (err) {
      console.warn(
        "[stripe] orphan customer cleanup failed",
        created.id,
        err,
      );
    }
  }

  return winnerId;
}
