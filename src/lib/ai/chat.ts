import { GoogleGenAI, ThinkingLevel } from "@google/genai";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

/**
 * 石碑・案内板の文脈で質問にやさしく答える。
 */
export async function answerMonumentChat(input: {
  title: string;
  ocrRaw: string;
  easyText: string;
  detailText: string;
  placeName?: string | null;
  history: ChatMessage[];
  question: string;
}): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return mockAnswer(input.question, input.title);
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const model = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";

    const system = `あなたは「撮るほど」のガイドです。石碑・案内板について、やさしい日本語で短く答えます。
ルール:
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

ガイドの回答:`;

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
    const cleaned = text.trim();
    return cleaned || mockAnswer(input.question, input.title);
  } catch (e) {
    console.error("chat error", e);
    return mockAnswer(input.question, input.title);
  }
}

function mockAnswer(question: string, title: string): string {
  return `「${title}」についてのご質問ですね。「${question}」について、この案内の範囲ではくわしいことは分かりませんが、現地の案内や近くの説明板もあわせて見るとヒントがあるかもしれません。`;
}
