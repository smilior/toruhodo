/**
 * ふりがな（ルビ）HTML のユーティリティ。
 *
 * AI が生成した「<ruby>漢字<rt>かんじ</rt></ruby>」形式の文字列は
 * dangerouslySetInnerHTML で描画するため、正しい形のルビだけを残し、
 * 壊れたルビ（孤立した <rt> など）やそれ以外のタグは必ず落とす。
 */

/** 漢字（CJK 統合漢字・互換漢字・々） */
const KANJI = /[㐀-鿿豈-﫿々]/;
/** ruby / rt / rp の開き・閉じタグ（属性付きは対象外＝エスケープされる） */
const RUBY_TAG = /<(\/?)(ruby|rt|rp)\s*\/?>/gi;

type RubyTagName = "ruby" | "rt" | "rp";
type RubyToken =
  | { kind: "tag"; name: RubyTagName; close: boolean }
  | { kind: "text"; value: string };

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** ruby / rt / rp タグと、それ以外のテキストに分割する */
function tokenizeRuby(input: string): RubyToken[] {
  const tokens: RubyToken[] = [];
  let last = 0;
  RUBY_TAG.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = RUBY_TAG.exec(input)) !== null) {
    if (m.index > last) {
      tokens.push({ kind: "text", value: input.slice(last, m.index) });
    }
    tokens.push({
      kind: "tag",
      name: m[2].toLowerCase() as RubyTagName,
      close: m[1] === "/",
    });
    last = m.index + m[0].length;
  }
  if (last < input.length) {
    tokens.push({ kind: "text", value: input.slice(last) });
  }
  return tokens;
}

/**
 * 正しい形の `<ruby>ベース<rt>読み</rt></ruby>` だけを残す。
 * - ruby の外の <rt>/<rp> は中身（読み）ごと削除（インラインに読みが残るのを防ぐ）
 * - rt を持たない <ruby> はタグを外して中身のテキストだけ残す
 * - ruby / rt / rp 以外のタグ・属性付きタグはエスケープする
 */
export function sanitizeRubyHtml(input: string | null | undefined): string {
  if (!input) return "";

  let out = "";
  let inRuby = false;
  let base = "";
  let rt = "";
  let hasRt = false;
  /** ruby 内でテキストを溜める先（drop = rp や 2 つ目以降の rt） */
  let slot: "base" | "rt" | "drop" = "base";
  /** ruby の外の孤立 <rt> の中身を、次のタグまで捨てる */
  let dropping = false;

  const flush = () => {
    const gotRt = hasRt || slot === "rt";
    if (base.trim() && gotRt && rt.trim()) {
      out += `<ruby>${base}<rt>${rt}</rt></ruby>`;
    } else {
      // rt が無い／ベースが空（＝読みだけ）のときはルビにしない
      out += base;
    }
    inRuby = false;
    base = "";
    rt = "";
    hasRt = false;
    slot = "base";
  };

  for (const t of tokenizeRuby(input)) {
    if (t.kind === "text") {
      if (dropping) continue;
      const esc = escapeHtml(t.value);
      if (!inRuby) out += esc;
      else if (slot === "rt") rt += esc;
      else if (slot === "base") base += esc;
      continue;
    }

    // タグ境界に来たら孤立 <rt> の読み捨ては終わり
    dropping = false;

    if (t.name === "ruby") {
      if (inRuby) flush(); // 閉じ忘れ・入れ子はそこで区切る
      if (!t.close) inRuby = true;
      continue;
    }

    if (!inRuby) {
      // ruby の外の <rt>/<rp> は中身ごと捨てる
      if (!t.close) dropping = true;
      continue;
    }

    if (t.name === "rt") {
      if (t.close) {
        if (slot === "rt") hasRt = true;
        slot = "base";
      } else {
        slot = hasRt ? "drop" : "rt";
      }
    } else {
      // rp は読みの補助なので中身ごと落とす
      slot = t.close ? "base" : "drop";
    }
  }
  if (inRuby) flush();

  return out;
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

/** 漢字を含むか */
export function containsKanji(input: string | null | undefined): boolean {
  if (!input) return false;
  return KANJI.test(input);
}

/** ルビの付いていない漢字が残っているか（ふりがな漏れの検出用） */
export function hasUncoveredKanji(ruby: string | null | undefined): boolean {
  if (!ruby) return false;
  const rest = sanitizeRubyHtml(ruby).replace(/<ruby>[\s\S]*?<\/ruby>/gi, "");
  return containsKanji(stripRubyHtml(rest));
}

/** 本文に漢字があるのに、ルビが無い／付け漏れがある（リペア対象） */
export function needsFuriganaRepair(
  ruby: string | null | undefined,
  text: string | null | undefined,
): boolean {
  if (!containsKanji(text)) return false;
  return !ruby || hasUncoveredKanji(ruby);
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
  const stripped = stripRubyHtml(safe);
  if (!stripped) return "";
  // ルビから本文を復元して一致しなければ、化けるよりプレーン表示に落とす
  if (plain && plain.trim() && squash(stripped) !== squash(plain)) return "";
  return safe;
}

function squash(s: string): string {
  return s.replace(/\s+/g, "");
}
