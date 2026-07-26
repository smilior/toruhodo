/**
 * ふりがな（ルビ）HTML のユーティリティ。
 *
 * AI が生成した「<ruby>漢字<rt>かんじ</rt></ruby>」形式の文字列は
 * dangerouslySetInnerHTML で描画するため、ruby / rt / rp 以外は必ず落とす。
 */

const RUBY_TAG = /<\/?(ruby|rt|rp)\s*\/?>/gi;
/** 一時トークン用の制御文字（本文には現れない） */
const PLACEHOLDER = "\u0000";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** ruby / rt / rp のみを許可し、それ以外のタグ・属性はエスケープする */
export function sanitizeRubyHtml(input: string | null | undefined): string {
  if (!input) return "";
  const tokens: string[] = [];
  const tokenized = input
    .replace(new RegExp(PLACEHOLDER, "g"), "")
    .replace(RUBY_TAG, (m, tag: string) => {
      const close = m.startsWith("</");
      tokens.push(`<${close ? "/" : ""}${tag.toLowerCase()}>`);
      return `${PLACEHOLDER}${tokens.length - 1}${PLACEHOLDER}`;
    });

  return escapeHtml(tokenized).replace(
    new RegExp(`${PLACEHOLDER}(\\d+)${PLACEHOLDER}`, "g"),
    (_, i: string) => tokens[Number(i)] ?? "",
  );
}

/** ルビ付き HTML からふりがなとタグを外し、素の本文に戻す */
export function stripRubyHtml(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .replace(/<rp[^>]*>[\s\S]*?<\/rp>/gi, "")
    .replace(/<rt[^>]*>[\s\S]*?<\/rt>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

/** 実際に <ruby> が含まれているか（ふりがなを出す価値があるか） */
export function hasRubyMarkup(input: string | null | undefined): boolean {
  if (!input) return false;
  return /<ruby[\s>]/i.test(input);
}

/**
 * AI 由来のルビ文字列を安全な形に整える。
 * ルビが無い／本文と対応しない場合は空文字を返す（呼び出し側はプレーンを使う）。
 */
export function normalizeRubyHtml(
  ruby: string | null | undefined,
  plain?: string,
): string {
  const safe = sanitizeRubyHtml(ruby).trim();
  if (!hasRubyMarkup(safe)) return "";
  if (plain && plain.trim() && !stripRubyHtml(safe)) return "";
  return safe;
}
