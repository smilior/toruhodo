/** 課金 UI 共通の文言・日付整形 */

/** Free プランの月間スキャン上限（LIMITS.free.scan と揃える） */
export const FREE_SCAN_LIMIT = 3;

/** 翌月 1 日 0:00 JST の ISO 8601 */
export function nextJstMonthResetIso(now = Date.now()): string {
  const jst = new Date(now + 9 * 3600_000);
  const y = jst.getUTCFullYear();
  const m = jst.getUTCMonth(); // 0-11 in JST wall
  // 翌月 1 日 00:00 JST = UTC で前月最終日 15:00
  const nextMonthUtc = Date.UTC(y, m + 1, 1, 0, 0, 0) - 9 * 3600_000;
  return new Date(nextMonthUtc).toISOString();
}

export function formatJaDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

/** resetsAt（ISO）から「◯月1日」表記 */
export function formatResetMonthDay(iso: string | null | undefined): string {
  if (!iso) {
    // フォールバック: 翌月 1 日 JST
    const now = Date.now();
    const jst = new Date(now + 9 * 3600_000);
    const m = jst.getUTCMonth() + 2; // 翌月（1-12 に正規化）
    const month = ((m - 1) % 12) + 1;
    return `${month}月1日`;
  }
  const d = new Date(iso);
  // resetsAt は翌月1日 0:00 JST の瞬間 → 表示は JST の月日
  const jst = new Date(d.getTime() + 9 * 3600_000);
  return `${jst.getUTCMonth() + 1}月1日`;
}

export const PLUS_PRICE_LABEL = "月額480円（税込）";
export const PLUS_PLAN_NAME = "撮るほどプラス";
