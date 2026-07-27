import Stripe from "stripe";

/** §5.7 / A-2: SDK major 更新と API バージョン変更を意図的な同時作業にする */
export const STRIPE_API_VERSION = "2026-06-24.dahlia" as const;

let _stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY が未設定です。.env.local または Vercel の環境変数を確認してください。",
    );
  }
  _stripe = new Stripe(key, { apiVersion: STRIPE_API_VERSION });
  return _stripe;
}

/** 遅延初期化: ビルド時の静的解析で env 未設定でも落ちないようにする */
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop, receiver) {
    const real = getStripe();
    const value = Reflect.get(real, prop, receiver);
    return typeof value === "function" ? value.bind(real) : value;
  },
});
