import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import {
  containsKanji,
  hasUncoveredKanji,
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
相手は、ひらがなを覚えたばかりの年長（5〜6歳）や小学生のこともあります。
次の JSON だけを返してください（前後に説明文・マークダウンを付けない）:
{ "answer": string, "answerRuby": string }
ルール:
- answer: 回答本文（プレーンテキスト。ルビや HTML は入れない）
  - 1文を短く。全体で1〜3文。やわらかい「です・ます」で書く
  - むずかしい言葉・カタカナ語をさける。どうしても使うときは「〜のことです」とやさしい言いかえを添える
  - 数や大きさは子どもがイメージできるたとえで補う
- answerRuby: answer とまったく同じ文（文字を足さない・減らさない）に、漢字を1つ残らず <ruby>漢字<rt>かんじ</rt></ruby> 形式で包んだもの（単語単位、読みはひらがな。ひらがな・カタカナ・数字にはルビを付けない）
- 使ってよいタグは ruby / rt のみ。<ruby> と </ruby> は必ず対で書き、<rt> を単独で置かない
- 出力前に確認: answerRuby から <ruby>/<rt> を除いた本文が answer と一致し、かつ answer の漢字がすべて <ruby> で覆われていること
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
    if (!answer) return mockAnswer(input.question, input.title);

    // ルビが無い／付け漏れがあるときだけ、1 回だけ付け直す
    if (
      containsKanji(answer.text) &&
      (!answer.ruby || hasUncoveredKanji(answer.ruby))
    ) {
      const [repaired] = await addFurigana(ai, model, [answer.text]);
      if (repaired) return { text: answer.text, ruby: repaired };
    }
    return answer;
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
