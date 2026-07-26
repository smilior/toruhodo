"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { records, userSettings } from "@/lib/db/schema";
import { requireUserId } from "@/lib/auth-session";
import {
  DEFAULT_SETTINGS,
  defaultSuggestedQuestions,
  makeSuggestedQuestion,
  normalizeChatMessages,
  normalizeSuggestedQuestions,
  toRecordDTO,
  type ChatMessage,
  type RecordDTO,
  type ScanAiResult,
  type SettingsDTO,
  type SuggestedQuestion,
} from "@/lib/domain/record";
import { normalizeRubyHtml } from "@/lib/furigana";
import { analyzeMonumentImage } from "@/lib/ai/scan";
import { answerMonumentChat } from "@/lib/ai/chat";
import { storePhoto } from "@/lib/blob";
import { limitCreate, limitMutation } from "@/lib/rate-limit";
import { parseModeDefault } from "@/lib/validation";
import {
  isCoordinateLikePlaceName,
  resolvePlaceName,
} from "@/lib/geocode";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function revalidateApp() {
  revalidatePath("/");
  revalidatePath("/history");
  revalidatePath("/map");
  revalidatePath("/settings");
}

export async function listRecordsAction(): Promise<
  ActionResult<{ records: RecordDTO[] }>
> {
  try {
    const userId = await requireUserId();
    const rows = await db
      .select()
      .from(records)
      .where(eq(records.userId, userId))
      .orderBy(desc(records.createdAt));

    // 座標だけで地名が空／数値の古い記録を、最大3件まで地名補完
    let backfilled = 0;
    for (const row of rows) {
      if (backfilled >= 3) break;
      if (
        row.lat == null ||
        row.lng == null ||
        !isCoordinateLikePlaceName(row.placeName)
      ) {
        continue;
      }
      const name = await resolvePlaceName({
        lat: row.lat,
        lng: row.lng,
        placeName: row.placeName,
      });
      if (name && name !== row.placeName && !isCoordinateLikePlaceName(name)) {
        await db
          .update(records)
          .set({ placeName: name })
          .where(and(eq(records.id, row.id), eq(records.userId, userId)));
        row.placeName = name;
        backfilled += 1;
      }
    }

    return {
      ok: true,
      data: { records: rows.map((r) => toRecordDTO(r, { forList: true })) },
    };
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return { ok: false, error: "ログインが必要です" };
    }
    console.error(e);
    return { ok: false, error: "記録の取得に失敗しました" };
  }
}

export async function getRecordAction(
  id: string,
): Promise<ActionResult<{ record: RecordDTO }>> {
  try {
    const userId = await requireUserId();
    const row = await db.query.records.findFirst({
      where: and(eq(records.id, id), eq(records.userId, userId)),
    });
    if (!row) return { ok: false, error: "記録が見つかりません" };
    return { ok: true, data: { record: toRecordDTO(row) } };
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return { ok: false, error: "ログインが必要です" };
    }
    console.error(e);
    return { ok: false, error: "記録の取得に失敗しました" };
  }
}

export async function createScanAction(input: {
  imageBase64: string;
  mimeType?: string;
  lat?: number | null;
  lng?: number | null;
  placeName?: string | null;
  /** デモ: "failed" | "partial" | "done" を強制 */
  forceStatus?: "failed" | "partial" | "done";
}): Promise<
  ActionResult<{
    scan: ScanAiResult;
    photoUrl: string;
    lat: number | null;
    lng: number | null;
    placeName: string | null;
  }>
> {
  try {
    const userId = await requireUserId();
    const rl = limitCreate(userId, "createScan");
    if (!rl.ok) return { ok: false, error: rl.error };

    if (!input.imageBase64 || input.imageBase64.length < 32) {
      return { ok: false, error: "画像が取得できませんでした" };
    }

    const photoUrl = await storePhoto({
      imageBase64: input.imageBase64,
      mimeType: input.mimeType,
      userId,
    });

    let scan: ScanAiResult;
    if (input.forceStatus === "failed") {
      scan = { status: "failed" };
    } else if (input.forceStatus === "partial") {
      scan = await analyzeMonumentImage({
        imageBase64: "x".repeat(17), // mock partial path uses len % 17
        mimeType: input.mimeType,
      });
      if (scan.status === "failed" || scan.status === "done") {
        scan = {
          status: "partial",
          title: "馬頭觀世音（一部）",
          easyText:
            "ここでは「馬頭觀世音」と「文化八年」という文字が読めました。",
          detailText:
            "判読できた範囲では、馬頭観世音と年号が確認できます。",
          easyRuby:
            "ここでは「<ruby>馬頭觀世音<rt>ばとうかんぜおん</rt></ruby>」が読めました。",
          detailRuby:
            "<ruby>馬頭觀世音<rt>ばとうかんぜおん</rt></ruby>と年号が確認できます。",
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
    } else {
      scan = await analyzeMonumentImage({
        imageBase64: input.imageBase64,
        mimeType: input.mimeType,
      });
      if (input.forceStatus === "done" && scan.status === "failed") {
        scan = await analyzeMonumentImage({
          imageBase64: "x".repeat(1000),
          mimeType: input.mimeType,
        });
      }
    }

    const lat = input.lat ?? null;
    const lng = input.lng ?? null;
    const placeName = await resolvePlaceName({
      lat,
      lng,
      placeName: input.placeName,
    });

    return {
      ok: true,
      data: {
        scan,
        photoUrl,
        lat,
        lng,
        placeName,
      },
    };
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return { ok: false, error: "ログインが必要です" };
    }
    console.error(e);
    return { ok: false, error: "読み取りに失敗しました" };
  }
}

export async function saveRecordAction(input: {
  photoUrl: string;
  title: string;
  easyText: string;
  detailText: string;
  easyRuby: string;
  detailRuby: string;
  aiNote?: string;
  ocrRaw: string;
  partial?: boolean;
  partialChars?: string | null;
  lat?: number | null;
  lng?: number | null;
  placeName?: string | null;
  suggestedQuestions?: SuggestedQuestion[];
  chatMessages?: ChatMessage[];
}): Promise<ActionResult<{ record: RecordDTO }>> {
  try {
    const userId = await requireUserId();
    const rl = limitMutation(userId, "saveRecord");
    if (!rl.ok) return { ok: false, error: rl.error };

    const lat = input.lat ?? null;
    const lng = input.lng ?? null;
    const placeName = await resolvePlaceName({
      lat,
      lng,
      placeName: input.placeName,
    });

    const normalizedQuestions = normalizeSuggestedQuestions(
      input.suggestedQuestions,
    );
    const questions =
      normalizedQuestions.length > 0
        ? normalizedQuestions
        : defaultSuggestedQuestions(input.title);
    const chat = normalizeChatMessages(input.chatMessages).slice(-40);

    const [row] = await db
      .insert(records)
      .values({
        userId,
        photoUrl: input.photoUrl,
        title: input.title.slice(0, 120),
        easyText: input.easyText,
        detailText: input.detailText,
        easyRuby: input.easyRuby,
        detailRuby: input.detailRuby,
        aiNote: input.aiNote ?? "",
        ocrRaw: input.ocrRaw,
        partial: Boolean(input.partial),
        partialChars: input.partialChars ?? null,
        lat,
        lng,
        placeName,
        memo: null,
        suggestedQuestions: JSON.stringify(questions),
        chatMessages: JSON.stringify(chat),
        createdAt: new Date(),
      })
      .returning();

    revalidateApp();
    return { ok: true, data: { record: toRecordDTO(row) } };
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return { ok: false, error: "ログインが必要です" };
    }
    console.error(e);
    return { ok: false, error: "記録の保存に失敗しました" };
  }
}

/** 記録について質問する（候補クリック／自由入力） */
export async function chatAboutRecordAction(input: {
  /** pending のときは null で文脈を直渡し */
  recordId?: string | null;
  question: string;
  /** 候補チップから送るときの、ふりがな付き質問文 */
  questionRuby?: string;
  /** pending 用コンテキスト */
  context?: {
    title: string;
    ocrRaw: string;
    easyText: string;
    detailText: string;
    placeName?: string | null;
    history?: ChatMessage[];
  };
}): Promise<
  ActionResult<{
    answer: string;
    answerRuby: string;
    messages: ChatMessage[];
    recordId?: string;
  }>
> {
  try {
    const userId = await requireUserId();
    const rl = limitMutation(userId, "chat");
    if (!rl.ok) return { ok: false, error: rl.error };

    const question = input.question.trim();
    if (!question) return { ok: false, error: "質問を入力してください" };
    if (question.length > 500) {
      return { ok: false, error: "質問が長すぎます" };
    }

    let title = input.context?.title ?? "";
    let ocrRaw = input.context?.ocrRaw ?? "";
    let easyText = input.context?.easyText ?? "";
    let detailText = input.context?.detailText ?? "";
    let placeName = input.context?.placeName ?? null;
    let history: ChatMessage[] = normalizeChatMessages(input.context?.history);
    let persistId: string | null =
      input.recordId && input.recordId !== "pending" ? input.recordId : null;

    if (persistId) {
      const row = await db.query.records.findFirst({
        where: and(eq(records.id, persistId), eq(records.userId, userId)),
      });
      if (!row) return { ok: false, error: "記録が見つかりません" };
      title = row.title;
      ocrRaw = row.ocrRaw;
      easyText = row.easyText;
      detailText = row.detailText;
      placeName = row.placeName;
      const { parseChatMessages } = await import("@/lib/domain/record");
      history = parseChatMessages(row.chatMessages);
    }

    if (!title && !easyText) {
      return { ok: false, error: "解説データがありません" };
    }

    const answer = await answerMonumentChat({
      title,
      ocrRaw,
      easyText,
      detailText,
      placeName,
      history,
      question,
    });

    const questionRuby = normalizeRubyHtml(input.questionRuby, question);
    const userMsg: ChatMessage = {
      role: "user",
      content: question,
      ...(questionRuby ? { contentRuby: questionRuby } : {}),
    };
    const assistantMsg: ChatMessage = {
      role: "assistant",
      content: answer.text,
      ...(answer.ruby ? { contentRuby: answer.ruby } : {}),
    };
    const nextMessages: ChatMessage[] = [
      ...history,
      userMsg,
      assistantMsg,
    ].slice(-40);

    if (persistId) {
      await db
        .update(records)
        .set({ chatMessages: JSON.stringify(nextMessages) })
        .where(and(eq(records.id, persistId), eq(records.userId, userId)));
      revalidateApp();
    }

    return {
      ok: true,
      data: {
        answer: answer.text,
        answerRuby: answer.ruby,
        messages: nextMessages,
        recordId: persistId ?? undefined,
      },
    };
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return { ok: false, error: "ログインが必要です" };
    }
    console.error(e);
    return { ok: false, error: "回答の取得に失敗しました" };
  }
}

export async function deleteRecordAction(input: {
  id: string;
}): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    const rl = limitMutation(userId, "deleteRecord");
    if (!rl.ok) return { ok: false, error: rl.error };

    const deleted = await db
      .delete(records)
      .where(and(eq(records.id, input.id), eq(records.userId, userId)))
      .returning({ id: records.id, photoUrl: records.photoUrl });

    if (!deleted.length) return { ok: false, error: "記録が見つかりません" };

    // ローカル uploads の写真があれば削除（失敗しても DB 削除は成功扱い）
    const photoUrl = deleted[0].photoUrl;
    if (photoUrl?.startsWith("/uploads/")) {
      try {
        const { unlink } = await import("node:fs/promises");
        const path = await import("node:path");
        const filePath = path.join(process.cwd(), "public", photoUrl);
        await unlink(filePath);
      } catch {
        /* ファイルが無い・権限など — 無視 */
      }
    }

    revalidateApp();
    return { ok: true, data: undefined };
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return { ok: false, error: "ログインが必要です" };
    }
    console.error(e);
    return { ok: false, error: "削除に失敗しました" };
  }
}

export async function getSettingsAction(): Promise<
  ActionResult<{ settings: SettingsDTO }>
> {
  try {
    const userId = await requireUserId();
    const row = await db.query.userSettings.findFirst({
      where: eq(userSettings.userId, userId),
    });
    if (!row) {
      return { ok: true, data: { settings: { ...DEFAULT_SETTINGS } } };
    }
    return {
      ok: true,
      data: {
        settings: {
          furiganaDefault: Boolean(row.furiganaDefault),
          modeDefault: parseModeDefault(row.modeDefault),
          geoEnabled: Boolean(row.geoEnabled),
        },
      },
    };
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return { ok: false, error: "ログインが必要です" };
    }
    console.error(e);
    return { ok: false, error: "設定の取得に失敗しました" };
  }
}

export async function updateSettingsAction(input: {
  furiganaDefault?: boolean;
  modeDefault?: "easy" | "detail";
  geoEnabled?: boolean;
}): Promise<ActionResult<{ settings: SettingsDTO }>> {
  try {
    const userId = await requireUserId();
    const rl = limitMutation(userId, "updateSettings");
    if (!rl.ok) return { ok: false, error: rl.error };

    const current = await getSettingsAction();
    if (!current.ok) return current;
    const next: SettingsDTO = {
      furiganaDefault:
        input.furiganaDefault ?? current.data.settings.furiganaDefault,
      modeDefault: input.modeDefault ?? current.data.settings.modeDefault,
      geoEnabled: input.geoEnabled ?? current.data.settings.geoEnabled,
    };

    await db
      .insert(userSettings)
      .values({
        userId,
        furiganaDefault: next.furiganaDefault,
        modeDefault: next.modeDefault,
        geoEnabled: next.geoEnabled,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userSettings.userId,
        set: {
          furiganaDefault: next.furiganaDefault,
          modeDefault: next.modeDefault,
          geoEnabled: next.geoEnabled,
          updatedAt: new Date(),
        },
      });

    revalidatePath("/settings");
    return { ok: true, data: { settings: next } };
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return { ok: false, error: "ログインが必要です" };
    }
    console.error(e);
    return { ok: false, error: "設定の保存に失敗しました" };
  }
}

export async function deleteAllUserDataAction(): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    const rl = limitMutation(userId, "deleteAll");
    if (!rl.ok) return { ok: false, error: rl.error };

    await db.delete(records).where(eq(records.userId, userId));
    await db.delete(userSettings).where(eq(userSettings.userId, userId));
    revalidateApp();
    return { ok: true, data: undefined };
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return { ok: false, error: "ログインが必要です" };
    }
    console.error(e);
    return { ok: false, error: "データの削除に失敗しました" };
  }
}
