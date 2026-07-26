import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { normalizeRubyHtml } from "@/lib/furigana";

/**
 * 本文はそのままに、漢字へふりがなを付け直す（ルビ壊れ・付け漏れのリペア）。
 * 複数の文を 1 回のコールでまとめて処理する。
 * 検証に通らなかった要素は空文字（呼び出し側はプレーンに落とす）。
 */
export async function addFurigana(
  ai: GoogleGenAI,
  model: string,
  texts: string[],
): Promise<string[]> {
  if (texts.length === 0) return [];

  try {
    const prompt = `次の各文の漢字すべてに <ruby>漢字<rt>かんじ</rt></ruby> 形式でふりがなを付けて返してください。
ルール:
- 本文の文字は 1 文字も変えない・足さない・減らさない（ルビのタグだけを足す）
- 読みはひらがな。ひらがな・カタカナ・数字・記号にはルビを付けない
- 使ってよいタグは ruby / rt のみ。<ruby> と </ruby> は必ず対で書き、<rt> を単独で置かない
- 入力と同じ順・同じ要素数の JSON 文字列配列だけを返す（説明文・マークダウンを付けない）

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
