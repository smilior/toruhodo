import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { normalizeRubyHtml, stripRubyHtml } from "@/lib/furigana";

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
};

/**
 * 石碑・案内板の文脈で質問にやさしく答える。
 * 回答はプレーンとふりがな付きの 2 種類を返す。
 */
export async function answerMonumentChat(input: {
  title: string;
  ocrRaw: string;
  easyText: string;
  detailText: string;
  placeName?: string | null;
  history: ChatMessage[];
  question: string;
}): Promise<ChatAnswer> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return mockAnswer(input.question, input.title);
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const model = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";

    const system = `あなたは「撮るほど」のガイドです。石碑・案内板について、やさしい日本語で短く答えます。
次の JSON だけを返してください（前後に説明文・マークダウンを付けない）:
{ "answer": string, "answerRuby": string }
ルール:
- answer: 回答本文（プレーンテキスト。ルビや HTML は入れない）
- answerRuby: answer とまったく同じ文に、漢字すべてへ <ruby>漢字<rt>かんじ</rt></ruby> 形式でふりがなを付けたもの（単語単位。ひらがな・カタカナ・数字にはルビを付けない）
- 使ってよいタグは ruby / rt のみ
- 断定しすぎない。分からないことは「この案内だけでははっきり分かりません」と伝える
- 子どもや中高年にも読みやすい文（1〜4文程度）
- マークダウンや見出しは使わない
- 質問と関係ない雑談には乗らない
- 以下の資料だけを根拠にする（必要なら一般知識で補うが推測と分かる言い方にする）

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
${input.question}

ガイドの回答（JSON）:`;

    const response = await ai.models.generateContentStream({
      model,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
        tools: [{ googleSearch: {} }],
      },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    let text = "";
    for await (const chunk of response) {
      if (chunk.text) text += chunk.text;
    }

    const answer = parseChatAnswer(text);
    return answer ?? mockAnswer(input.question, input.title);
  } catch (e) {
    console.error("chat error", e);
    return mockAnswer(input.question, input.title);
  }
}

/**
 * JSON（answer / answerRuby）を取り出す。
 * JSON で返ってこなかった場合は本文そのものをプレーン回答として扱う。
 */
function parseChatAnswer(raw: string): ChatAnswer | null {
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
      const rubyRaw =
        typeof parsed.answerRuby === "string" ? parsed.answerRuby.trim() : "";
      const ruby = normalizeRubyHtml(rubyRaw, plainRaw);
      const text = plainRaw || stripRubyHtml(ruby);
      if (text) return { text, ruby };
    } catch {
      /* JSON ではなかった — 素の本文として扱う */
    }
  }

  // モデルが素のテキストを返した場合のフォールバック
  const ruby = normalizeRubyHtml(cleaned);
  const text = ruby ? stripRubyHtml(ruby) : cleaned;
  return text ? { text, ruby } : null;
}

function mockAnswer(question: string, title: string): ChatAnswer {
  return {
    text: `「${title}」についてのご質問ですね。「${question}」について、この案内の範囲ではくわしいことは分かりませんが、現地の案内や近くの説明板もあわせて見るとヒントがあるかもしれません。`,
    ruby: normalizeRubyHtml(
      `「${title}」についてのご<ruby>質問<rt>しつもん</rt></ruby>ですね。「${question}」について、この<ruby>案内<rt>あんない</rt></ruby>の<ruby>範囲<rt>はんい</rt></ruby>ではくわしいことは<ruby>分<rt>わ</rt></ruby>かりませんが、<ruby>現地<rt>げんち</rt></ruby>の<ruby>案内<rt>あんない</rt></ruby>や<ruby>近<rt>ちか</rt></ruby>くの<ruby>説明板<rt>せつめいばん</rt></ruby>もあわせて<ruby>見<rt>み</rt></ruby>るとヒントがあるかもしれません。`,
    ),
  };
}
