import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import {
  applyKanjiReadings,
  extractKanjiRuns,
  isValidReading,
} from "@/lib/furigana";

type ReadingJob = {
  index: number;
  text: string;
  runs: string[];
};

/**
 * 本文はそのままに、漢字ランへふりがなを付ける。
 *
 * モデルには HTML を書かせず「読み（ひらがな）配列」だけ返させ、
 * <ruby> の組み立てはコード側で行う（本文破壊・表記ゆれを構造的に防ぐ）。
 */
export async function addFurigana(
  ai: GoogleGenAI,
  model: string,
  texts: string[],
): Promise<string[]> {
  if (texts.length === 0) return [];

  const jobs: ReadingJob[] = texts.map((text, index) => ({
    index,
    text,
    runs: extractKanjiRuns(text),
  }));

  const need = jobs.filter((j) => j.runs.length > 0);
  if (need.length === 0) return texts.map(() => "");

  let readingsMap = await fetchReadingsOnce(ai, model, need);

  // 長さ不一致・無効読みがある job だけ 1 回リトライ
  const retryJobs = need.filter((j) => {
    const r = readingsMap.get(j.index);
    return !isCompleteReadings(j.runs, r);
  });
  if (retryJobs.length > 0) {
    const retried = await fetchReadingsOnce(ai, model, retryJobs);
    for (const j of retryJobs) {
      const r = retried.get(j.index);
      if (r) readingsMap.set(j.index, r);
    }
  }

  return jobs.map((j) => {
    if (j.runs.length === 0) return "";
    const readings = readingsMap.get(j.index) ?? [];
    return applyKanjiReadings(j.text, readings);
  });
}

function isCompleteReadings(
  runs: string[],
  readings: string[] | undefined,
): boolean {
  if (!readings || readings.length !== runs.length) return false;
  return readings.every((r) => isValidReading(r));
}

async function fetchReadingsOnce(
  ai: GoogleGenAI,
  model: string,
  jobs: ReadingJob[],
): Promise<Map<number, string[]>> {
  const map = new Map<number, string[]>();
  if (jobs.length === 0) return map;

  try {
    const payload = jobs.map((j) => ({
      id: j.index,
      text: j.text,
      runs: j.runs,
    }));

    const prompt = `あなたはふりがな係です。各項目の runs（漢字の連続）に、出現順どおりの読みだけを付けてください。

入力は JSON 配列です。各要素:
- id: 番号
- text: 全文（同形異音の文脈用。書き換えない）
- runs: 漢字ランの配列（この文字列を変えない）

出力は入力と同じ順・同じ要素数の JSON 配列。各要素は:
{ "id": number, "readings": string[] }
- readings は runs と同じ長さ
- 各読みはひらがなのみ（漢字・カタカナ・記号・空白を含めない）
- 説明文・マークダウンは付けない

例:
入力: [{"id":0,"text":"はじめての人","runs":["人"]}]
出力: [{"id":0,"readings":["ひと"]}]

入力:
${JSON.stringify(payload)}

出力:`;

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

    return parseReadingsResponse(out, jobs);
  } catch (e) {
    console.error("furigana readings error", e);
    return map;
  }
}

/**
 * モデル応答から id → readings を取り出す。
 * 配列要素が string[] の簡易形式も許容する。
 */
export function parseReadingsResponse(
  raw: string,
  jobs: ReadingJob[],
): Map<number, string[]> {
  const map = new Map<number, string[]>();
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const match = cleaned.match(/\[[\s\S]*\]/);
  if (!match) return map;

  let parsed: unknown;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return map;
  }
  if (!Array.isArray(parsed)) return map;

  // 形式 A: [{ id, readings }]
  const asObjects = parsed.every(
    (x) => x && typeof x === "object" && !Array.isArray(x),
  );
  if (asObjects) {
    for (const item of parsed) {
      const o = item as { id?: unknown; readings?: unknown };
      const id = typeof o.id === "number" ? o.id : Number(o.id);
      if (!Number.isFinite(id)) continue;
      const readings = normalizeReadingList(o.readings);
      if (readings) map.set(id, readings);
    }
    return map;
  }

  // 形式 B: 入力 jobs と同じ順の readings 配列の配列
  jobs.forEach((j, i) => {
    const readings = normalizeReadingList(parsed[i]);
    if (readings) map.set(j.index, readings);
  });
  return map;
}

function normalizeReadingList(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.map((x) => (typeof x === "string" ? x.trim() : ""));
}
