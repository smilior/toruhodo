import type { RecordRow } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/ai/chat";

export type { ChatMessage };

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
  suggestedQuestions: string[];
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
      suggestedQuestions: string[];
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
): string[] {
  return parseJsonArray(raw)
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .map((s) => s.trim())
    .slice(0, 6);
}

export function parseChatMessages(
  raw: string | null | undefined,
): ChatMessage[] {
  return parseJsonArray(raw)
    .map((x) => {
      if (!x || typeof x !== "object") return null;
      const o = x as { role?: string; content?: string };
      if (
        (o.role === "user" || o.role === "assistant") &&
        typeof o.content === "string" &&
        o.content.trim()
      ) {
        return { role: o.role, content: o.content.trim() } as ChatMessage;
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
export function defaultSuggestedQuestions(title: string): string[] {
  const t = title || "この石碑";
  return [
    `${t}は、いつ頃のもの？`,
    "ここに書かれている人は、どんな人？",
    "なぜここに建てられたの？",
    "子どもにどう説明する？",
  ];
}
