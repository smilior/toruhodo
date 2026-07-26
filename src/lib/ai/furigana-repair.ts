import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { needsFuriganaRepair, normalizeRubyHtml } from "@/lib/furigana";

/**
 * 本文はそのままに、漢字へふりがなを付け直す（ルビ壊れ・付け漏れのリペア）。
 * 複数の文を 1 回のコールでまとめて処理する。
 * 検証に通らなかった要素は、最大 1 回だけリトライする。
 * それでもダメな要素は空文字（呼び出し側はプレーンに落とす）。
 */
export async function addFurigana(
  ai: GoogleGenAI,
  model: string,
  texts: string[],
): Promise<string[]> {
  if (texts.length === 0) return [];

  let results = await generateFuriganaOnce(ai, model, texts);

  // 漢字漏れ・棄却で空になった要素だけ、もう 1 回だけ付け直す
  const retryIndexes: number[] = [];
  results.forEach((ruby, i) => {
    if (needsFuriganaRepair(ruby, texts[i])) retryIndexes.push(i);
  });
  if (retryIndexes.length === 0) return results;

  const retryTexts = retryIndexes.map((i) => texts[i]);
  const retried = await generateFuriganaOnce(ai, model, retryTexts);
  retryIndexes.forEach((orig, j) => {
    const ruby = retried[j];
    if (!ruby) return;
    // リトライ結果がまだ漏れでも、空よりはマシなら採用（部分ルビ）
    results[orig] = ruby;
  });

  return results;
}

async function generateFuriganaOnce(
  ai: GoogleGenAI,
  model: string,
  texts: string[],
): Promise<string[]> {
  if (texts.length === 0) return [];

  try {
    const prompt = `次の各文の「漢字だけ」に <ruby>漢字<rt>かんじ</rt></ruby> 形式でふりがなを付けてください。

最重要:
- 本文の文字は 1 文字も変えない・足さない・減らさない（<ruby>/<rt> タグだけを足す）
- ひらがなを漢字に直さない（禁止例: 「はじめて」→「初めて」、「できる」→「出来る」）
- 漢字をひらがなに直さない
- 表記ゆれ・言い換え・句読点の変更も禁止

ルール:
- 読みはひらがな。ひらがな・カタカナ・数字・記号にはルビを付けない
- 使ってよいタグは ruby / rt のみ。<ruby> と </ruby> は必ず対で書く
- 必ず <ruby>漢字<rt>よみ</rt></ruby> の形（<rt> を省略しない・単独で置かない）
- タグを外すと入力と完全一致していること
- 入力と同じ順・同じ要素数の JSON 文字列配列だけを返す（説明文・マークダウンを付けない）

良い例:
入力: "はじめての人"
出力: "はじめての<ruby>人<rt>ひと</rt></ruby>"

悪い例（禁止）:
入力: "はじめての人"
出力: "<ruby>初<rt>はじ</rt></ruby>めての<ruby>人<rt>ひと</rt></ruby>"  ← ひらがなを漢字にしている
出力: "<ruby>人</ruby>"  ← <rt> が無い

入力（JSON 配列）:
${JSON.stringify(texts)}

出力（JSON 配列）:`;

    const response = await ai.models.generateContentStream({
      model,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
      },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    let out = "";
    for await (const chunk of response) {
      if (chunk.text) out += chunk.text;
    }

    return parseFuriganaBatch(out, texts);
  } catch (e) {
    console.error("furigana repair error", e);
    return texts.map(() => "");
  }
}

/**
 * 応答（JSON 配列）を検証し、texts と同じ長さのルビ配列にする。
 * パースできない・本文と一致しない要素は空文字。
 */
export function parseFuriganaBatch(raw: string, texts: string[]): string[] {
  const empty = texts.map(() => "");
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const match = cleaned.match(/\[[\s\S]*\]/);
  if (!match) return empty;

  let parsed: unknown;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return empty;
  }
  if (!Array.isArray(parsed)) return empty;

  // 要素数が足りない・順序がずれた要素は本文比較で落ちて空文字になる
  return texts.map((text, i) => {
    const v = parsed[i];
    return typeof v === "string" ? normalizeRubyHtml(v, text) : "";
  });
}
