import type { RecordRow } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/ai/chat";
import { normalizeRubyHtml, stripRubyHtml } from "@/lib/furigana";

export type { ChatMessage };

/** 深掘りの質問候補（ふりがな付き） */
export type SuggestedQuestion = {
  text: string;
  /** <ruby> 版。生成できていないときは空文字 */
  ruby: string;
};

export type RecordDTO = {
  id: string;
  photoUrl: string;
  title: string;
  easyText: string;
  detailText: string;
  easyRuby: string;
  detailRuby: string;
  /** @deprecated UI では未使用。互換のため残す */
  aiNote: string;
  ocrRaw: string;
  partial: boolean;
  partialChars: string | null;
  lat: number | null;
  lng: number | null;
  placeName: string | null;
  /** @deprecated メモ機能は廃止 */
  memo: string | null;
  suggestedQuestions: SuggestedQuestion[];
  chatMessages: ChatMessage[];
  createdAt: string;
  saved: boolean;
};

export type SettingsDTO = {
  furiganaDefault: boolean;
  modeDefault: "easy" | "detail";
  geoEnabled: boolean;
};

export type ScanAiResult =
  | { status: "failed" }
  | {
      status: "done" | "partial";
      title: string;
      easyText: string;
      detailText: string;
      easyRuby: string;
      detailRuby: string;
      aiNote: string;
      ocrRaw: string;
      partialChars?: string | null;
      suggestedQuestions: SuggestedQuestion[];
    };

/** data URL 等の巨大 photo は一覧の RSC 転送でスタックオーバーフローするため縮退する */
export function sanitizePhotoUrlForList(url: string): string {
  if (!url) return "";
  if (url.startsWith("data:") && url.length > 8_000) {
    return "";
  }
  return url;
}

function parseJsonArray(raw: string | null | undefined): unknown[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function parseSuggestedQuestions(
  raw: string | null | undefined,
): SuggestedQuestion[] {
  return normalizeSuggestedQuestions(parseJsonArray(raw));
}

/**
 * 質問候補を { text, ruby } に正規化する。
 * 旧データ（文字列の配列）や sessionStorage の古いペイロードも受け付ける。
 */
export function normalizeSuggestedQuestions(
  raw: unknown,
): SuggestedQuestion[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(toSuggestedQuestion)
    .filter((x): x is SuggestedQuestion => x != null)
    .slice(0, 6);
}

function toSuggestedQuestion(raw: unknown): SuggestedQuestion | null {
  if (typeof raw === "string") {
    const text = raw.trim();
    return text ? { text, ruby: "" } : null;
  }
  if (!raw || typeof raw !== "object") return null;

  const o = raw as { text?: unknown; ruby?: unknown };
  const ruby = normalizeRubyHtml(
    typeof o.ruby === "string" ? o.ruby : "",
  );
  const text =
    typeof o.text === "string" && o.text.trim()
      ? o.text.trim()
      : stripRubyHtml(ruby);
  return text ? { text, ruby } : null;
}

/**
 * ふりがな付きの質問候補を作る。
 * ルビ版があるときは表示と送信内容がずれないよう、本文もルビ版から起こす。
 */
export function makeSuggestedQuestion(
  text: string,
  ruby?: string,
): SuggestedQuestion {
  const safeRuby = normalizeRubyHtml(ruby, text);
  const plain = safeRuby ? stripRubyHtml(safeRuby) : text.trim();
  return { text: plain || text.trim(), ruby: safeRuby };
}

export function parseChatMessages(
  raw: string | null | undefined,
): ChatMessage[] {
  return normalizeChatMessages(parseJsonArray(raw));
}

/** クライアント／DB 由来のチャットを正規化する（ルビは ruby/rt のみ許可） */
export function normalizeChatMessages(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => {
      if (!x || typeof x !== "object") return null;
      const o = x as { role?: string; content?: string; contentRuby?: unknown };
      if (
        (o.role === "user" || o.role === "assistant") &&
        typeof o.content === "string" &&
        o.content.trim()
      ) {
        const content = o.content.trim();
        const contentRuby = normalizeRubyHtml(
          typeof o.contentRuby === "string" ? o.contentRuby : "",
          content,
        );
        return {
          role: o.role,
          content,
          ...(contentRuby ? { contentRuby } : {}),
        } as ChatMessage;
      }
      return null;
    })
    .filter((x): x is ChatMessage => x != null)
    .slice(-40);
}

export function toRecordDTO(
  row: RecordRow,
  opts?: { forList?: boolean },
): RecordDTO {
  const photoUrl = opts?.forList
    ? sanitizePhotoUrlForList(row.photoUrl)
    : row.photoUrl;

  return {
    id: row.id,
    photoUrl,
    title: row.title,
    easyText: row.easyText,
    detailText: row.detailText,
    easyRuby: row.easyRuby ?? "",
    detailRuby: row.detailRuby ?? "",
    aiNote: row.aiNote ?? "",
    ocrRaw: row.ocrRaw ?? "",
    partial: Boolean(row.partial),
    partialChars: row.partialChars ?? null,
    lat: row.lat ?? null,
    lng: row.lng ?? null,
    placeName: row.placeName ?? null,
    memo: row.memo ?? null,
    suggestedQuestions: parseSuggestedQuestions(row.suggestedQuestions),
    chatMessages: opts?.forList ? [] : parseChatMessages(row.chatMessages),
    createdAt:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : new Date(row.createdAt as unknown as number).toISOString(),
    saved: true,
  };
}

export function formatRecordMeta(dto: RecordDTO): string {
  const d = new Date(dto.createdAt);
  const date = `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  if (dto.placeName) return `${date}・${dto.placeName}`;
  return `${date}・場所は記録されていません`;
}

export const DEFAULT_SETTINGS: SettingsDTO = {
  furiganaDefault: true,
  modeDefault: "easy",
  geoEnabled: true,
};

/** 候補が無いときのフォールバック */
export function defaultSuggestedQuestions(title: string): SuggestedQuestion[] {
  const t = title || "この石碑";
  return [
    makeSuggestedQuestion(
      `${t}は、いつ頃のもの？`,
      `${t}は、いつ<ruby>頃<rt>ころ</rt></ruby>のもの？`,
    ),
    makeSuggestedQuestion(
      "ここに書かれている人は、どんな人？",
      "ここに<ruby>書<rt>か</rt></ruby>かれている<ruby>人<rt>ひと</rt></ruby>は、どんな<ruby>人<rt>ひと</rt></ruby>？",
    ),
    makeSuggestedQuestion(
      "なぜここに建てられたの？",
      "なぜここに<ruby>建<rt>た</rt></ruby>てられたの？",
    ),
    makeSuggestedQuestion(
      "子どもにどう説明する？",
      "<ruby>子<rt>こ</rt></ruby>どもにどう<ruby>説明<rt>せつめい</rt></ruby>する？",
    ),
  ];
}
