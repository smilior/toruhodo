import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import {
  defaultSuggestedQuestions,
  makeSuggestedQuestion,
  type ScanAiResult,
  type SuggestedQuestion,
} from "@/lib/domain/record";
import { containsKanji } from "@/lib/furigana";
import { addFurigana } from "@/lib/ai/furigana-repair";

const DEFAULT_MODEL = "gemini-3.5-flash-lite";

/** スキャンはプレーン本文のみ。ルビは後段 addFurigana で付ける（二段生成） */
const SCAN_PROMPT = `あなたは日本の石碑・案内板をやさしく解説するアシスタントです。
このアプリは年長〜大人まで使います。読みは後段でルビを付けるので、本文をすべてひらがなにする必要はありません。
画像から文字を読み取り、次の JSON だけを返してください（前後に説明文・マークダウンを付けない）:
{
  "failed": boolean,
  "partial": boolean,
  "partialChars": string | null,
  "ocrRaw": string,
  "title": string,
  "easyText": string,
  "detailText": string,
  "suggestedQuestions": string[]
}

フィールドの役割:
- すべてプレーンテキスト。ルビや HTML は絶対に入れない
- 本文は通常の漢字交じり文で書いてよい（無理にひらがなだけにしない）

ルール:
- failed: 文字がほぼ読めないとき true
- partial: 一部だけ読めたとき true（そのとき partialChars に読めた文字）
- easyText: 子どもにも分かるやさしい言いかえ（プレーン・漢字交じり可）
  - 1文を短く（20〜40文字くらい）。全体で2〜4文。やわらかい「です・ます」で書く
  - 意味が伝わる範囲でふつうの漢字を使ってよい（例:「昔」「場所」「建てた」）
  - むずかしい専門用語・カタカナ語は、やさしい言いかえを添える（例:「距離＝どのくらい歩くか」）
  - 数や大きさは子どもがイメージできるたとえを添える（例:「一里＝歩いて1時間くらい」）
- detailText: 大人向けのくわしい説明（プレーン・漢字交じり）。歴史的な背景も補う
- suggestedQuestions: 読んだ人が次に聞きたくなる質問を3〜5個（短く、話しことば）。例:「なんでここにあるの？」「これはいつできたの？」
- 出力は JSON オブジェクト 1 つのみ`;

/**
 * Gemini（@google/genai）で石碑・案内板を解析する。
 * GEMINI_API_KEY 未設定時はモックを返す（ローカル開発用）。
 */
export async function analyzeMonumentImage(input: {
  imageBase64: string;
  mimeType?: string;
}): Promise<ScanAiResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return mockAnalyze(input.imageBase64);
  }

  try {
    const mime = normalizeMime(input.mimeType || "image/jpeg");
    const base64 = input.imageBase64.replace(/^data:[^;]+;base64,/, "");

    const ai = new GoogleGenAI({ apiKey });
    const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

    const response = await ai.models.generateContentStream({
      model,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
        tools: [{ googleSearch: {} }],
      },
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: mime,
                data: base64,
              },
            },
            { text: SCAN_PROMPT },
          ],
        },
      ],
    });

    let text = "";
    for await (const chunk of response) {
      if (chunk.text) text += chunk.text;
    }

    const parsed = parseScanJson(text);
    if (!parsed) {
      console.error("Gemini: JSON parse failed", text.slice(0, 500));
      return mockAnalyze(input.imageBase64);
    }

    if (parsed.failed) return { status: "failed" };

    const title = parsed.title || "石碑の記録";
    const easyText = parsed.easyText || "";
    const detailText = parsed.detailText || easyText;
    let questions = normalizeQuestions(parsed.suggestedQuestions, title);

    // 二段目: 漢字がある本文・質問へ読み配列方式でルビを付ける
    const furiganaTargets: {
      kind: "easy" | "detail" | "question";
      index: number;
    }[] = [];
    const furiganaTexts: string[] = [];
    if (containsKanji(easyText)) {
      furiganaTargets.push({ kind: "easy", index: 0 });
      furiganaTexts.push(easyText);
    }
    if (containsKanji(detailText)) {
      furiganaTargets.push({ kind: "detail", index: 0 });
      furiganaTexts.push(detailText);
    }
    questions.forEach((q, i) => {
      if (containsKanji(q.text)) {
        furiganaTargets.push({ kind: "question", index: i });
        furiganaTexts.push(q.text);
      }
    });

    let easyRuby = "";
    let detailRuby = "";
    if (furiganaTexts.length > 0) {
      const rubies = await addFurigana(ai, model, furiganaTexts);
      furiganaTargets.forEach((t, i) => {
        const ruby = rubies[i];
        if (!ruby) return;
        if (t.kind === "easy") easyRuby = ruby;
        else if (t.kind === "detail") detailRuby = ruby;
        else questions[t.index] = makeSuggestedQuestion(furiganaTexts[i], ruby);
      });
    }

    return {
      status: parsed.partial ? "partial" : "done",
      title,
      easyText,
      detailText,
      easyRuby: easyRuby || easyText,
      detailRuby: detailRuby || detailText,
      aiNote: "",
      ocrRaw: parsed.ocrRaw || "",
      partialChars: parsed.partialChars ?? null,
      suggestedQuestions: questions,
    };
  } catch (e) {
    console.error("Gemini analyze error", e);
    return mockAnalyze(input.imageBase64);
  }
}

function normalizeMime(mime: string): string {
  if (mime === "image/jpg") return "image/jpeg";
  if (mime.startsWith("image/")) return mime;
  return "image/jpeg";
}

function normalizeQuestions(raw: unknown, title: string): SuggestedQuestion[] {
  const list = Array.isArray(raw)
    ? raw
        .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
        .slice(0, 5)
        .map((s) => makeSuggestedQuestion(s.trim()))
    : [];
  if (list.length >= 2) return list;
  return defaultSuggestedQuestions(title);
}

function parseScanJson(text: string): {
  failed?: boolean;
  partial?: boolean;
  partialChars?: string | null;
  ocrRaw?: string;
  title?: string;
  easyText?: string;
  detailText?: string;
  suggestedQuestions?: unknown;
} | null {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[0]) as {
      failed?: boolean;
      partial?: boolean;
      partialChars?: string | null;
      ocrRaw?: string;
      title?: string;
      easyText?: string;
      detailText?: string;
      suggestedQuestions?: unknown;
    };
  } catch {
    return null;
  }
}

function mockAnalyze(imageBase64: string): ScanAiResult {
  const len = imageBase64.length;
  if (len > 0 && len < 800) {
    return { status: "failed" };
  }
  if (len % 17 === 0) {
    const title = "馬頭觀世音（一部）";
    return {
      status: "partial",
      title,
      easyText:
        "ここでは「馬頭観世音」と「文化八年」という文字が読めました。馬や旅の安全を願う石碑の一部のようです。",
      detailText:
        "判読できた範囲では、馬頭観世音と年号「文化八年」が確認できます。ほかの文言は影や摩耗のため読み取れませんでした。",
      easyRuby:
        "ここでは「<ruby>馬頭觀世音<rt>ばとうかんぜおん</rt></ruby>」と「<ruby>文化<rt>ぶんか</rt></ruby><ruby>八年<rt>はちねん</rt></ruby>」という文字が読めました。",
      detailRuby:
        "判読できた範囲では、<ruby>馬頭觀世音<rt>ばとうかんぜおん</rt></ruby>と年号が確認できます。",
      aiNote: "",
      ocrRaw: "馬頭觀世音 文化八年",
      partialChars: "馬頭觀世音 ／ 文化八年",
      suggestedQuestions: [
        makeSuggestedQuestion(
          "馬頭観世音って何？",
          "<ruby>馬頭観世音<rt>ばとうかんぜおん</rt></ruby>って<ruby>何<rt>なに</rt></ruby>？",
        ),
        makeSuggestedQuestion(
          "文化八年は西暦だと何年？",
          "<ruby>文化<rt>ぶんか</rt></ruby><ruby>八年<rt>はちねん</rt></ruby>は<ruby>西暦<rt>せいれき</rt></ruby>だと<ruby>何年<rt>なんねん</rt></ruby>？",
        ),
        makeSuggestedQuestion(
          "なぜ馬の安全を願うの？",
          "なぜ<ruby>馬<rt>うま</rt></ruby>の<ruby>安全<rt>あんぜん</rt></ruby>を<ruby>願<rt>ねが</rt></ruby>うの？",
        ),
      ],
    };
  }

  const title = "旧東海道 一里塚跡";
  return {
    status: "done",
    title,
    easyText:
      "ここはむかしの街道「東海道」に置かれていた一里塚のあとです。旅人が距離を知る目印になっていました。",
    detailText:
      "旧東海道の一里塚跡を示す案内です。一里（約4キロ）ごとに土を盛り木を植えて目印としたもので、江戸時代の旅の距離感覚を今に伝えています。",
    easyRuby:
      "ここはむかしの<ruby>街道<rt>かいどう</rt></ruby>「<ruby>東海道<rt>とうかいどう</rt></ruby>」に置かれていた<ruby>一里塚<rt>いちりづか</rt></ruby>のあとです。<ruby>旅人<rt>たびびと</rt></ruby>が<ruby>距離<rt>きょり</rt></ruby>を知る<ruby>目印<rt>めじるし</rt></ruby>になっていました。",
    detailRuby:
      "<ruby>旧東海道<rt>きゅうとうかいどう</rt></ruby>の<ruby>一里塚跡<rt>いちりづかあと</rt></ruby>を示す案内です。<ruby>一里<rt>いちり</rt></ruby>（約4キロ）ごとに土を盛り木を植えて目印としたもので、<ruby>江戸時代<rt>えどじだい</rt></ruby>の旅の距離感覚を今に伝えています。",
    aiNote: "",
    ocrRaw: "旧東海道 一里塚跡 ここより江戸日本橋まで 九里",
    suggestedQuestions: [
      makeSuggestedQuestion(
        "一里塚って何のためにあるの？",
        "<ruby>一里塚<rt>いちりづか</rt></ruby>って<ruby>何<rt>なん</rt></ruby>のためにあるの？",
      ),
      makeSuggestedQuestion(
        "東海道はどこからどこまで？",
        "<ruby>東海道<rt>とうかいどう</rt></ruby>はどこからどこまで？",
      ),
      makeSuggestedQuestion(
        "一里は今の距離だとどのくらい？",
        "<ruby>一里<rt>いちり</rt></ruby>は<ruby>今<rt>いま</rt></ruby>の<ruby>距離<rt>きょり</rt></ruby>だとどのくらい？",
      ),
      makeSuggestedQuestion(
        "子どもにどう説明する？",
        "<ruby>子<rt>こ</rt></ruby>どもにどう<ruby>説明<rt>せつめい</rt></ruby>する？",
      ),
    ],
  };
}
