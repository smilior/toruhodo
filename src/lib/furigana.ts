/**
 * ふりがな（ルビ）HTML のユーティリティ。
 *
 * AI が生成した「<ruby>漢字<rt>かんじ</rt></ruby>」形式の文字列は
 * dangerouslySetInnerHTML で描画するため、正しい形のルビだけを残す。
 * 本文の書き換えはコード側で行わず、読みは別経路（読み配列）で付ける。
 */

/** 漢字（CJK 統合漢字・互換漢字・々） */
const KANJI_CHAR = /[㐀-鿿豈-﫿々]/;
/** 連続する漢字ラン */
const KANJI_RUN = /[㐀-鿿豈-﫿々]+/g;
/** ruby / rt / rp の開き・閉じタグ（属性付きは対象外＝エスケープされる） */
const RUBY_TAG = /<(\/?)(ruby|rt|rp)\s*\/?>/gi;
/** ひらがな読みとして許す文字（長音・繰り返し記号含む） */
const HIRAGANA_READING = /^[\u3041-\u3096ーゝゞ]+$/;

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

/** ベースが漢字だけか（ひらがな「あ」へのルビなどを拒否） */
export function isKanjiOnly(input: string | null | undefined): boolean {
  if (!input) return false;
  return input.length > 0 && /^[㐀-鿿豈-﫿々]+$/.test(input);
}

/** 読みがひらがなのみか */
export function isValidReading(input: string | null | undefined): boolean {
  if (!input) return false;
  const t = input.trim();
  return t.length > 0 && HIRAGANA_READING.test(t);
}

/** 本文から出現順の漢字ランを抽出する */
export function extractKanjiRuns(text: string | null | undefined): string[] {
  if (!text) return [];
  return text.match(KANJI_RUN) ?? [];
}

/**
 * 本文と読み配列からルビ HTML を組み立てる（本文は 1 文字も変えない）。
 * readings の長さがラン数と合わない／無効な読みは、そのランだけプレーンのまま残す。
 * 有効な <ruby> が 1 つも無ければ空文字。
 */
export function applyKanjiReadings(
  text: string,
  readings: (string | null | undefined)[],
): string {
  const runs = extractKanjiRuns(text);
  if (runs.length === 0) return "";

  let out = "";
  let last = 0;
  let runIdx = 0;
  let rubyCount = 0;
  KANJI_RUN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = KANJI_RUN.exec(text)) !== null) {
    out += escapeHtml(text.slice(last, m.index));
    const base = m[0];
    const reading = (readings[runIdx] ?? "").toString().trim();
    runIdx += 1;
    if (isValidReading(reading)) {
      out += `<ruby>${escapeHtml(base)}<rt>${escapeHtml(reading)}</rt></ruby>`;
      rubyCount += 1;
    } else {
      out += escapeHtml(base);
    }
    last = m.index + base.length;
  }
  out += escapeHtml(text.slice(last));
  return rubyCount > 0 ? out : "";
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
 * 正しい形の `<ruby>漢字<rt>読み</rt></ruby>` だけを残す。
 * - ベースに漢字以外が混ざる／漢字が無い ruby はタグを外す（「あ」ルビ防止）
 * - ruby の外の <rt>/<rp> は中身ごと削除
 * - rt を持たない <ruby> はタグを外す
 */
export function sanitizeRubyHtml(input: string | null | undefined): string {
  if (!input) return "";

  let out = "";
  let inRuby = false;
  let base = "";
  let rt = "";
  let hasRt = false;
  let slot: "base" | "rt" | "drop" = "base";
  let dropping = false;

  const flush = () => {
    const gotRt = hasRt || slot === "rt";
    // ベースは漢字のみ・rt 必須（ひらがな単体へのルビを拒否）
    if (isKanjiOnly(base) && gotRt && isValidReading(rt)) {
      out += `<ruby>${base}<rt>${rt.trim()}</rt></ruby>`;
    } else {
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

    dropping = false;

    if (t.name === "ruby") {
      if (inRuby) flush();
      if (!t.close) inRuby = true;
      continue;
    }

    if (!inRuby) {
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

/** 実際に <ruby> が含まれているか */
export function hasRubyMarkup(input: string | null | undefined): boolean {
  if (!input) return false;
  return /<ruby[\s>]/i.test(input);
}

/** 漢字を含むか */
export function containsKanji(input: string | null | undefined): boolean {
  if (!input) return false;
  return KANJI_CHAR.test(input);
}

/** ルビの付いていない漢字が残っているか */
export function hasUncoveredKanji(ruby: string | null | undefined): boolean {
  if (!ruby) return false;
  const rest = sanitizeRubyHtml(ruby).replace(/<ruby>[\s\S]*?<\/ruby>/gi, "");
  return containsKanji(stripRubyHtml(rest));
}

/** 本文に漢字があるのに、ルビが無い／付け漏れがある */
export function needsFuriganaRepair(
  ruby: string | null | undefined,
  text: string | null | undefined,
): boolean {
  if (!containsKanji(text)) return false;
  return !ruby || hasUncoveredKanji(ruby);
}

/**
 * 既存ルビ HTML を安全な形に整える（DB 由来・チップ由来）。
 * ルビが無い／本文と対応しない場合は空文字。
 */
export function normalizeRubyHtml(
  ruby: string | null | undefined,
  plain?: string,
): string {
  const safe = sanitizeRubyHtml(ruby).trim();
  if (!hasRubyMarkup(safe)) return "";
  const stripped = stripRubyHtml(safe);
  if (!stripped) return "";
  if (plain && plain.trim() && squash(stripped) !== squash(plain)) return "";
  return safe;
}

function squash(s: string): string {
  return s.replace(/\s+/g, "");
}
