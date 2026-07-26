import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import {
  defaultSuggestedQuestions,
  makeSuggestedQuestion,
  type ScanAiResult,
  type SuggestedQuestion,
} from "@/lib/domain/record";
import { needsFuriganaRepair, normalizeRubyHtml } from "@/lib/furigana";
import { addFurigana } from "@/lib/ai/furigana-repair";

const DEFAULT_MODEL = "gemini-3.1-flash-lite";

const SCAN_PROMPT = `あなたは日本の石碑・案内板を、小さな子どもにもやさしく解説するアシスタントです。
このアプリは、ひらがなを覚えたばかりの年長（5〜6歳）から小学生、大人までが使います。
画像から文字を読み取り、次の JSON だけを返してください（前後に説明文・マークダウンを付けない）:
{
  "failed": boolean,
  "partial": boolean,
  "partialChars": string | null,
  "ocrRaw": string,
  "title": string,
  "easyText": string,
  "detailText": string,
  "easyRuby": string,
  "detailRuby": string,
  "suggestedQuestions": string[],
  "suggestedQuestionsRuby": string[]
}

フィールドの役割（必ず守る）:
- *Text / suggestedQuestions は本文そのもの（プレーンテキストのみ。ルビや HTML は絶対に入れない）
- *Ruby / suggestedQuestionsRuby は、対応する本文とまったく同じ文にふりがなだけを付けた版（ルビはこちらにだけ書く）

ルール:
- failed: 文字がほぼ読めないとき true
- partial: 一部だけ読めたとき true（そのとき partialChars に読めた文字）
- easyText: ひらがなを覚えたばかりの子ども（5〜6歳）に読み聞かせるつもりの言いかえ（プレーン）
  - 1文を短く（20〜30文字くらい）。全体で2〜4文。やわらかい「です・ます」で書く
  - むずかしい熟語・カタカナ語・抽象的な言い方をさける（例:「距離」→「どのくらい歩くか」）
  - 数や大きさは子どもがイメージできるたとえを添える（例:「一里＝歩いて1時間くらい」）
- detailText: 大人向けのくわしい説明（プレーン）。歴史的な背景も補う
- easyRuby / detailRuby:
  - 対応する本文と文字を 1 つも足さない・減らさない・変えない（タグだけを足す）
  - 漢字を 1 つ残らず <ruby>漢字<rt>かんじ</rt></ruby> 形式で包む（単語単位、読みはひらがな）
  - ひらがな・カタカナ・数字にはルビを付けない
  - 使ってよいタグは ruby / rt のみ。<ruby> と </ruby> は必ず対で書き、<rt> を単独で置かない
- suggestedQuestions: 読んだ子どもが次に聞きたくなる質問を3〜5個（短く、話しことば）。例:「なんでここにあるの？」「これはいつできたの？」
- suggestedQuestionsRuby: suggestedQuestions と同じ順・同じ文に同じ形式でふりがなを付けた配列（要素数も同じ）
- 出力前に確認: 各 *Ruby から <ruby>/<rt> を除いた本文が対応するプレーン文と一致し、かつプレーン文の漢字がすべて <ruby> で覆われていること
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
    const questions = normalizeQuestions(
      parsed.suggestedQuestions,
      parsed.suggestedQuestionsRuby,
      title,
    );

    const easyText = parsed.easyText || "";
    const detailText = parsed.detailText || easyText;
    // 壊れたルビは本文が化けるので、検証に落ちたら捨てる
    let easyRuby = normalizeRubyHtml(parsed.easyRuby, easyText);
    let detailRuby = normalizeRubyHtml(parsed.detailRuby, detailText);

    // ルビが無い／付け漏れがある項目だけ、1 回のコールでまとめて付け直す
    const repairTargets: { kind: "easy" | "detail" | "question"; index: number }[] =
      [];
    const repairTexts: string[] = [];
    if (needsFuriganaRepair(easyRuby, easyText)) {
      repairTargets.push({ kind: "easy", index: 0 });
      repairTexts.push(easyText);
    }
    if (needsFuriganaRepair(detailRuby, detailText)) {
      repairTargets.push({ kind: "detail", index: 0 });
      repairTexts.push(detailText);
    }
    questions.forEach((q, i) => {
      if (needsFuriganaRepair(q.ruby, q.text)) {
        repairTargets.push({ kind: "question", index: i });
        repairTexts.push(q.text);
      }
    });

    if (repairTargets.length > 0) {
      const repaired = await addFurigana(ai, model, repairTexts);
      repairTargets.forEach((t, i) => {
        const ruby = repaired[i];
        if (!ruby) return;
        if (t.kind === "easy") easyRuby = ruby;
        else if (t.kind === "detail") detailRuby = ruby;
        else questions[t.index] = makeSuggestedQuestion(repairTexts[i], ruby);
      });
    }

    return {
      status: parsed.partial ? "partial" : "done",
      title,
      easyText,
      detailText,
      // リペアも失敗したときはプレーン表示に落とす
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

function normalizeQuestions(
  raw: unknown,
  rawRuby: unknown,
  title: string,
): SuggestedQuestion[] {
  const rubyList = Array.isArray(rawRuby) ? rawRuby : [];
  const list = Array.isArray(raw)
    ? raw
        .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
        .slice(0, 5)
        .map((s, i) => {
          const ruby = rubyList[i];
          return makeSuggestedQuestion(
            s,
            typeof ruby === "string" ? ruby : undefined,
          );
        })
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
  easyRuby?: string;
  detailRuby?: string;
  suggestedQuestions?: unknown;
  suggestedQuestionsRuby?: unknown;
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
      easyRuby?: string;
      detailRuby?: string;
      suggestedQuestions?: unknown;
      suggestedQuestionsRuby?: unknown;
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
