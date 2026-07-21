/**
 * プロセス内メモリの簡易レート制限。
 * Vercel の複数インスタンスでは厳密ではないが、連打・単純な乱用を抑える。
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult =
  | { ok: true }
  | { ok: false; error: string; retryAfterSec: number };

/**
 * @param key 例: `${userId}:createTask`
 * @param limit ウィンドウ内の最大回数
 * @param windowMs ウィンドウ長
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  let b = buckets.get(key);

  if (!b || now >= b.resetAt) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }

  if (b.count >= limit) {
    const retryAfterSec = Math.max(1, Math.ceil((b.resetAt - now) / 1000));
    return {
      ok: false,
      error: `操作が多すぎます。${retryAfterSec}秒ほど待ってから再度お試しください`,
      retryAfterSec,
    };
  }

  b.count += 1;

  // メモリ肥大防止（キーが増えすぎたら古いものを落とす）
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (now >= v.resetAt) buckets.delete(k);
    }
  }

  return { ok: true };
}

/** ミューテーション用の既定: 60秒あたり 60 回 */
export function limitMutation(userId: string, action: string): RateLimitResult {
  return checkRateLimit(`${userId}:${action}`, 60, 60_000);
}

/** 作成系は少し厳しく: 60秒あたり 20 回 */
export function limitCreate(userId: string, action: string): RateLimitResult {
  return checkRateLimit(`${userId}:${action}`, 20, 60_000);
}
