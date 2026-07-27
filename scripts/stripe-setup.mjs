/**
 * Stripe Product/Price の冪等 seed。
 * 使い方: STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-setup.mjs
 *
 * 年額 Price（lookup_key: toruhodo_plus_yearly / unit_amount: 4800）は
 * 第 2 弾用の設計値。初期 seed では作成しない（D-30）。
 */
import Stripe from "stripe";

const LOOKUP_KEY = "toruhodo_plus_monthly";
const PRODUCT_NAME =
  "撮るほどプラス（スキャン回数たっぷり・1か月ごと自動更新）";

async function main() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    console.error(
      "STRIPE_SECRET_KEY が未設定です。\n使い方: STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-setup.mjs",
    );
    process.exit(1);
  }

  const stripe = new Stripe(key, { apiVersion: "2026-06-24.dahlia" });

  const existing = await stripe.prices.list({
    lookup_keys: [LOOKUP_KEY],
    limit: 1,
    expand: ["data.product"],
  });

  let price = existing.data[0];
  if (!price) {
    const product = await stripe.products.create({
      name: PRODUCT_NAME,
      metadata: { app: "toruhodo" },
    });
    // JPY は zero-decimal。unit_amount: 480 = ¥480（×100 しない）
    price = await stripe.prices.create({
      product: product.id,
      unit_amount: 480,
      currency: "jpy",
      recurring: { interval: "month" },
      tax_behavior: "inclusive",
      lookup_key: LOOKUP_KEY,
    });
    console.log("Created Product:", product.id);
    console.log("Created Price:", price.id);
  } else {
    console.log("Existing Price found:", price.id);
  }

  console.log("");
  console.log(`STRIPE_PRICE_ID_PLUS_MONTHLY=${price.id}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
