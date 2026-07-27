import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import {
  containsKanji,
  needsFuriganaRepair,
  normalizeRubyHtml,
  stripRubyHtml,
} from "@/lib/furigana";
import { addFurigana } from "@/lib/ai/furigana-repair";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  /** <ruby>漢字<rt>かんじ</rt></ruby> 版（無いときは undefined） */
  contentRuby?: string;
};

export type ChatAnswer = {
  /** プレーンな回答本文 */
  text: string;
  /** ふりがな付き本文（生成できなかったときは空文字） */
  ruby: string;
  /** ユーザー質問のふりがな（チップ由来 or リペア後。無いときは空文字） */
  questionRuby: string;
};

/**
 * 石碑・案内板の文脈で質問にやさしく答える。
 *
 * 本文生成とふりがな付与は分離する:
 * 1) ガイドはプレーンの answer だけを返す
 * 2) 漢字がある文は addFurigana 専用コールでルビを付ける（1件目の <rt> 抜け・表記ゆれを避ける）
 */
export async function answerMonumentChat(input: {
  title: string;
  ocrRaw: string;
  easyText: string;
  detailText: string;
  placeName?: string | null;
  history: ChatMessage[];
  question: string;
  /** 候補チップから送るときの、ふりがな付き質問文 */
  questionRuby?: string;
}): Promise<ChatAnswer> {
  const question = input.question.trim();
  let questionRuby = normalizeRubyHtml(input.questionRuby, question);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return mockAnswer(question, input.title, questionRuby);
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

    const system = `あなたは「撮るほど」のガイドです。石碑・案内板について、やさしい日本語で短く答えます。
相手に年長〜小学生もいますが、読みはふりがなで助けるので、本文をすべてひらがなにする必要はありません。
次の JSON だけを返してください（前後に説明文・マークダウンを付けない）:
{ "answer": string }

フィールドの役割:
- answer は、画面に出す回答の本文そのもの（プレーンテキストのみ。ルビや HTML は絶対に入れない）
- ふりがなは別処理で付けるので、answer には書かない
- 通常の漢字交じり文で書いてよい（無理にひらがなだけにしない）

ルール:
- answer:
  - 1文を短く。全体で1〜3文。やわらかい「です・ます」で書く
  - 意味が伝わる範囲でふつうの漢字を使ってよい
  - むずかしい専門用語・カタカナ語は、やさしい言いかえを添える
  - 数や大きさは子どもがイメージできるたとえで補う
- 断定しすぎない。分からないことは「この案内だけでは、はっきり分かりません」と伝える
- マークダウンや見出しは使わない
- 質問と関係ない雑談には乗らない
- 以下の資料だけを根拠にする（必要なら一般知識で補うが、推測だと分かる言い方にする）

【題名】${input.title}
【場所】${input.placeName || "不明"}
【読めた文字】${input.ocrRaw || "（なし）"}
【やさしい説明】${input.easyText}
【くわしい説明】${input.detailText}`;

    const historyText = input.history
      .slice(-8)
      .map((m) => `${m.role === "user" ? "ユーザー" : "ガイド"}: ${m.content}`)
      .join("\n");

    const prompt = `${system}

これまでの会話:
${historyText || "（なし）"}

ユーザーの質問:
${question}

ガイドの回答（JSON）:`;

    // Google Search grounding はスキャン（analyzeMonumentImage）のみ。
    // チャットは OCR・既存解説・履歴を根拠にし、原価の支配項（grounding）を避ける（課金設計 D-24）。
    const response = await ai.models.generateContentStream({
      model,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
      },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    let text = "";
    for await (const chunk of response) {
      if (chunk.text) text += chunk.text;
    }

    const answer = parseChatAnswer(text);
    if (!answer) return mockAnswer(question, input.title, questionRuby);

    // 本文確定後に、ふりがな専用コールで付与（回答は常に／質問は漏れ時）
    const repairKinds: ("answer" | "question")[] = [];
    const repairTexts: string[] = [];
    if (containsKanji(answer.text)) {
      repairKinds.push("answer");
      repairTexts.push(answer.text);
    }
    if (needsFuriganaRepair(questionRuby, question)) {
      repairKinds.push("question");
      repairTexts.push(question);
    }

    let answerRuby = "";
    if (repairTexts.length > 0) {
      const repaired = await addFurigana(ai, model, repairTexts);
      repairKinds.forEach((kind, i) => {
        const ruby = repaired[i];
        if (!ruby) return;
        if (kind === "answer") answerRuby = ruby;
        else questionRuby = ruby;
      });
    }

    return { text: answer.text, ruby: answerRuby, questionRuby };
  } catch (e) {
    console.error("chat error", e);
    return mockAnswer(question, input.title, questionRuby);
  }
}

/**
 * JSON（answer）を取り出す。
 * 旧形式（answerRuby 付き）や素テキストも許容する。
 */
function parseChatAnswer(raw: string): { text: string } | null {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  if (!cleaned) return null;

  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as {
        answer?: unknown;
        answerRuby?: unknown;
      };
      const plainRaw =
        typeof parsed.answer === "string" ? parsed.answer.trim() : "";
      // 旧プロンプト互換: answer が空で answerRuby だけある場合
      const rubyRaw =
        typeof parsed.answerRuby === "string" ? parsed.answerRuby.trim() : "";
      const text = plainRaw || stripRubyHtml(normalizeRubyHtml(rubyRaw));
      if (text) return { text };
    } catch {
      /* JSON ではなかった — 素の本文として扱う */
    }
  }

  // モデルが素のテキストを返した場合
  const asRuby = normalizeRubyHtml(cleaned);
  const text = asRuby ? stripRubyHtml(asRuby) : cleaned;
  return text ? { text } : null;
}

function mockAnswer(
  question: string,
  title: string,
  questionRuby: string,
): ChatAnswer {
  const text = `「${title}」についてのご質問ですね。「${question}」について、この案内の範囲ではくわしいことは分かりませんが、現地の案内や近くの説明板もあわせて見るとヒントがあるかもしれません。`;
  const ruby = normalizeRubyHtml(
    `「${title}」についてのご<ruby>質問<rt>しつもん</rt></ruby>ですね。「${question}」について、この<ruby>案内<rt>あんない</rt></ruby>の<ruby>範囲<rt>はんい</rt></ruby>ではくわしいことは<ruby>分<rt>わ</rt></ruby>かりませんが、<ruby>現地<rt>げんち</rt></ruby>の<ruby>案内<rt>あんない</rt></ruby>や<ruby>近<rt>ちか</rt></ruby>くの<ruby>説明板<rt>せつめいばん</rt></ruby>もあわせて<ruby>見<rt>み</rt></ruby>るとヒントがあるかもしれません。`,
    text,
  );
  return { text, ruby, questionRuby };
}
