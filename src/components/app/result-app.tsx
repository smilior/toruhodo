"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  chatAboutRecordAction,
  deleteRecordAction,
  getRecordAction,
  getSettingsAction,
  saveRecordAction,
} from "@/actions/records";
import { getSubscriptionStatusAction } from "@/actions/billing";
import {
  DEFAULT_SETTINGS,
  defaultSuggestedQuestions,
  formatRecordMeta,
  normalizeSuggestedQuestions,
  type ChatMessage,
  type RecordDTO,
} from "@/lib/domain/record";
import {
  PENDING_SCAN_KEY,
  type PendingScanPayload,
} from "@/components/app/scan-app";
import { PaywallSheet } from "@/components/billing/paywall-sheet";
import Link from "next/link";

type Mode = "easy" | "detail";

function pendingToView(p: PendingScanPayload): RecordDTO {
  // 旧バージョンの sessionStorage（文字列配列）も受け付ける
  const stored = normalizeSuggestedQuestions(p.suggestedQuestions);
  const questions =
    stored.length > 0 ? stored : defaultSuggestedQuestions(p.title);
  return {
    id: "pending",
    photoUrl: p.photoUrl,
    title: p.title,
    easyText: p.easyText,
    detailText: p.detailText,
    easyRuby: p.easyRuby,
    detailRuby: p.detailRuby,
    aiNote: "",
    ocrRaw: p.ocrRaw,
    partial: p.partial,
    partialChars: p.partialChars,
    lat: p.lat,
    lng: p.lng,
    placeName: p.placeName,
    memo: null,
    suggestedQuestions: questions,
    chatMessages: [],
    createdAt: p.createdAt,
    saved: false,
  };
}

function loadPending(): PendingScanPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PENDING_SCAN_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PendingScanPayload;
  } catch {
    return null;
  }
}

function looksLikeHtml(s: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(s);
}

export function ResultApp({ id }: { id: string }) {
  const router = useRouter();
  const [record, setRecord] = useState<RecordDTO | null>(null);
  const [mode, setMode] = useState<Mode>(DEFAULT_SETTINGS.modeDefault);
  const [furigana, setFurigana] = useState(DEFAULT_SETTINGS.furiganaDefault);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [usedSuggestions, setUsedSuggestions] = useState<Set<string>>(
    () => new Set(),
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteStep, setDeleteStep] = useState<"idle" | "confirm">("idle");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState(false);
  const [isPlus, setIsPlus] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallKind, setPaywallKind] = useState<"scan" | "chat">("chat");
  const [resetsAt, setResetsAt] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    variant?: "default" | "error";
    leaving?: boolean;
  } | null>(null);
  const toastHideRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastLeaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const skipChatAutoScroll = useRef(true);
  const settingsApplied = useRef(false);

  const showToast = useCallback(
    (message: string, variant: "default" | "error" = "default") => {
      if (toastHideRef.current) clearTimeout(toastHideRef.current);
      if (toastLeaveRef.current) clearTimeout(toastLeaveRef.current);
      setToast({ message, variant, leaving: false });
      toastHideRef.current = setTimeout(() => {
        setToast((t) => (t ? { ...t, leaving: true } : null));
        toastLeaveRef.current = setTimeout(() => setToast(null), 220);
      }, 2200);
    },
    [],
  );

  useEffect(() => {
    return () => {
      if (toastHideRef.current) clearTimeout(toastHideRef.current);
      if (toastLeaveRef.current) clearTimeout(toastLeaveRef.current);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);

      const settingsRes = await getSettingsAction();
      if (!alive) return;
      if (settingsRes.ok && !settingsApplied.current) {
        setMode(settingsRes.data.settings.modeDefault);
        setFurigana(settingsRes.data.settings.furiganaDefault);
        settingsApplied.current = true;
      }

      const billingRes = await getSubscriptionStatusAction();
      if (alive && billingRes.ok) {
        setIsPlus(billingRes.data.entitlement === "plus");
        setResetsAt(billingRes.data.resetsAt);
      }

      if (id === "pending") {
        const pending = loadPending();
        if (!pending) {
          setError("読み取り結果が見つかりません");
          setRecord(null);
          setLoading(false);
          return;
        }
        const view = pendingToView(pending);
        setRecord(view);
        setMessages([]);
        setUsedSuggestions(new Set());
        setLoading(false);
        return;
      }

      const res = await getRecordAction(id);
      if (!alive) return;
      if (!res.ok) {
        setError(res.error);
        setRecord(null);
        setLoading(false);
        return;
      }
      setRecord(res.data.record);
      setMessages(res.data.record.chatMessages ?? []);
      setUsedSuggestions(
        new Set(
          (res.data.record.chatMessages ?? [])
            .filter((m) => m.role === "user")
            .map((m) => m.content),
        ),
      );
      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [id]);

  // 詳細に入った／読み込み中はチャット末尾への自動スクロールを抑止
  useEffect(() => {
    skipChatAutoScroll.current = true;
  }, [id]);

  // 読み込み完了後は先頭を表示
  useEffect(() => {
    if (loading) {
      skipChatAutoScroll.current = true;
      return;
    }
    const el = scrollRef.current;
    const toTop = () => {
      if (el) el.scrollTop = 0;
      window.scrollTo(0, 0);
    };
    toTop();
    requestAnimationFrame(toTop);
    // レイアウト・画像直後にもう一度
    const t = window.setTimeout(() => {
      toTop();
      // この後のチャット更新から末尾スクロールを許可
      skipChatAutoScroll.current = false;
    }, 50);
    return () => window.clearTimeout(t);
  }, [loading, id]);

  // チャット送受信後のみ末尾へ（初回表示では動かさない）
  useEffect(() => {
    if (loading || skipChatAutoScroll.current) return;
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, chatBusy, loading]);

  const metaLine = useMemo(() => {
    if (!record) return "";
    return formatRecordMeta(record);
  }, [record]);

  const bodyRuby = mode === "easy" ? record?.easyRuby : record?.detailRuby;
  const bodyPlain = mode === "easy" ? record?.easyText : record?.detailText;
  const washiHint =
    mode === "easy" ? "原文をやさしく言いかえ" : "原文にそった説明";

  const suggestions = useMemo(() => {
    if (!record) return [];
    const base =
      record.suggestedQuestions?.length > 0
        ? record.suggestedQuestions
        : defaultSuggestedQuestions(record.title);
    return base.filter((q) => !usedSuggestions.has(q.text));
  }, [record, usedSuggestions]);

  const sendQuestion = async (question: string, questionRuby?: string) => {
    if (!record || chatBusy) return;
    const q = question.trim();
    if (!q) return;

    setChatBusy(true);
    setError(null);
    setUsedSuggestions((prev) => new Set(prev).add(q));
    // 楽観的にユーザー吹き出しを出す
    setMessages((prev) => [
      ...prev,
      { role: "user", content: q, ...(questionRuby ? { contentRuby: questionRuby } : {}) },
    ]);
    setChatInput("");

    try {
      const res = await chatAboutRecordAction({
        recordId: record.saved ? record.id : null,
        question: q,
        questionRuby,
        context: record.saved
          ? undefined
          : {
              title: record.title,
              ocrRaw: record.ocrRaw,
              easyText: record.easyText,
              detailText: record.detailText,
              placeName: record.placeName,
              history: messages,
            },
      });

      if (!res.ok) {
        if (
          res.code === "CHAT_LIMIT_REACHED" ||
          res.code === "CHAT_RECORD_LIMIT_REACHED"
        ) {
          // 楽観的に出したユーザー吹き出しを戻す
          setMessages((prev) => prev.slice(0, -1));
          if (res.code === "CHAT_LIMIT_REACHED") {
            const st = await getSubscriptionStatusAction();
            if (st.ok) setResetsAt(st.data.resetsAt);
            setPaywallKind("chat");
            setShowPaywall(true);
          } else {
            setError(res.error);
            showToast(res.error, "error");
          }
          return;
        }
        setError(res.error);
        showToast(res.error || "回答に失敗しました", "error");
        // 失敗したユーザー発話を残すか削除するか — 残してエラー表示
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "うまく答えられませんでした。もう一度ためしてみてください。",
          },
        ]);
        return;
      }

      setMessages(res.data.messages);
      // pending 時は sessionStorage のチャットも更新（記録保存時に含める）
      if (!record.saved) {
        try {
          const pending = loadPending();
          if (pending) {
            sessionStorage.setItem(
              PENDING_SCAN_KEY,
              JSON.stringify({
                ...pending,
                // chat は Record 保存時に messages state から渡す
              }),
            );
          }
        } catch {
          /* ignore */
        }
      }
    } finally {
      setChatBusy(false);
    }
  };

  const onSave = async () => {
    if (!record || saving) return;
    setSaving(true);
    setError(null);
    try {
      if (record.saved && record.id !== "pending") {
        showToast("すでに記録済みです");
        return;
      }

      const res = await saveRecordAction({
        photoUrl: record.photoUrl,
        title: record.title,
        easyText: record.easyText,
        detailText: record.detailText,
        easyRuby: record.easyRuby,
        detailRuby: record.detailRuby,
        ocrRaw: record.ocrRaw,
        partial: record.partial,
        partialChars: record.partialChars,
        lat: record.lat,
        lng: record.lng,
        placeName: record.placeName,
        suggestedQuestions: record.suggestedQuestions,
        chatMessages: messages,
      });

      if (!res.ok) {
        setError(res.error);
        showToast(res.error || "保存に失敗しました", "error");
        return;
      }

      try {
        sessionStorage.removeItem(PENDING_SCAN_KEY);
      } catch {
        /* ignore */
      }

      setRecord(res.data.record);
      setMessages(res.data.record.chatMessages ?? messages);
      showToast("記録に残しました");
      window.setTimeout(() => {
        window.location.assign("/");
      }, 500);
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!record || !record.saved || record.id === "pending" || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await deleteRecordAction({ id: record.id });
      if (!res.ok) {
        setError(res.error);
        showToast(res.error || "削除に失敗しました", "error");
        setDeleteStep("idle");
        return;
      }
      showToast("記録を削除しました");
      window.setTimeout(() => {
        window.location.assign("/");
      }, 450);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--bg)] text-[var(--muted)]">
        <div className="flex flex-col items-center gap-3">
          <div
            className="h-[22px] w-[22px] animate-spin rounded-full"
            style={{
              border: "3px solid #E5DCC4",
              borderTopColor: "var(--primary)",
            }}
          />
          <span className="text-[14px] font-bold">読み込み中…</span>
        </div>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="flex h-full flex-col bg-[var(--bg)]">
        <div className="flex items-center px-3 pt-3 pb-1">
          <button
            type="button"
            aria-label="戻る"
            onClick={() => window.location.assign("/")}
            className="flex h-10 w-10 items-center justify-center text-[var(--label)]"
          >
            <span className="material-symbols-rounded" style={{ fontSize: 22 }} aria-hidden>
              arrow_back_ios_new
            </span>
          </button>
          <div className="flex-1 text-center text-[16px] font-bold">解説</div>
          <div className="w-10" />
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
          <p className="text-[15px] text-[var(--label)]">
            {error ?? "記録が見つかりません"}
          </p>
          <button
            type="button"
            className="btn-primary max-w-xs"
            onClick={() => window.location.assign("/")}
          >
            ホームにもどる
          </button>
        </div>
      </div>
    );
  }

  const isPartial = record.partial;
  const isSaved = record.saved && record.id !== "pending";

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--bg)]">
      <div className="flex shrink-0 items-center px-3 pt-3 pb-1">
        <button
          type="button"
          aria-label="戻る"
          onClick={() => window.location.assign("/")}
          className="flex h-10 w-10 items-center justify-center text-[var(--label)]"
        >
          <span className="material-symbols-rounded" style={{ fontSize: 22 }} aria-hidden>
            arrow_back_ios_new
          </span>
        </button>
        <div className="flex-1 text-center text-[16px] font-bold tracking-wide">
          解説
        </div>
        {isSaved ? (
          <button
            type="button"
            aria-label="この記録を削除"
            disabled={deleting}
            onClick={() => setDeleteStep("confirm")}
            className="flex h-10 w-10 items-center justify-center text-[var(--label)] disabled:opacity-40"
          >
            <span className="material-symbols-rounded" style={{ fontSize: 22 }} aria-hidden>
              delete
            </span>
          </button>
        ) : (
          <div className="w-10" />
        )}
      </div>

      <div className="app-scroll" ref={scrollRef}>
        <div
          className={`flex flex-col gap-4 px-5 pb-8 pt-0.5${furigana ? "" : " furigana-off"}`}
        >
          {isPartial && (
            <div
              className="flex items-start gap-2.5 rounded-[14px] px-3.5 py-3"
              style={{
                background: "var(--warn-bg)",
                border: "1px solid var(--warn-border)",
              }}
            >
              <span
                className="material-symbols-rounded shrink-0"
                style={{ fontSize: 18, color: "#95762A" }}
                aria-hidden
              >
                info
              </span>
              <span
                className="text-[13.5px] font-bold leading-relaxed"
                style={{ color: "var(--warn-ink)" }}
              >
                一部だけ読み取れました。読み取れた部分だけ解説しています。
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={() => setLightbox(true)}
            className="photo-ph relative h-[196px] w-full overflow-hidden rounded-[20px]"
            aria-label="写真を拡大"
          >
            {record.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={record.photoUrl}
                alt=""
                className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center"
                draggable={false}
              />
            ) : null}
            <div
              className="absolute bottom-2.5 right-2.5 z-[1] flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] text-[var(--bg)]"
              style={{ background: "rgba(41,36,29,.72)" }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: 14 }} aria-hidden>
                zoom_in
              </span>
              タップで拡大
            </div>
          </button>

          <div>
            <h1 className="font-mincho text-[21px] font-bold leading-snug">
              {record.title}
            </h1>
            <div className="mt-1.5 text-[13px] text-[var(--muted)]">
              {metaLine}
            </div>
          </div>

          {/* モード・ふりがな */}
          <div className="flex flex-wrap items-center gap-3.5">
            <div
              className="flex flex-1 rounded-full p-1"
              style={{ background: "var(--segment)" }}
            >
              {(["easy", "detail"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className="flex-1 rounded-full py-2 text-[14px] font-bold transition"
                  style={
                    mode === m
                      ? {
                          background: "var(--card)",
                          color: "var(--ink)",
                          boxShadow: "0 1px 3px rgba(58,53,44,.14)",
                        }
                      : { color: "var(--muted)" }
                  }
                >
                  {m === "easy" ? "やさしい" : "くわしい"}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setFurigana((v) => !v)}
              className="flex items-center gap-2"
              aria-pressed={furigana}
            >
              <span
                className="text-[14px] font-bold"
                style={{ color: furigana ? "var(--ink)" : "var(--muted)" }}
              >
                ふりがな
              </span>
              <span
                className="relative h-[31px] w-[52px] rounded-full transition"
                style={{
                  background: furigana ? "var(--primary)" : "var(--toggle-off)",
                }}
              >
                <span
                  className="absolute top-[3px] h-[25px] w-[25px] rounded-full bg-white transition"
                  style={{ left: furigana ? 24 : 3 }}
                />
              </span>
            </button>
          </div>

          {/* 原文の言いかえのみ（AI補足カードは廃止） */}
          <div className="card-washi p-[18px]">
            <div className="mb-2.5 flex items-center gap-1.5">
              <span
                className="material-symbols-rounded"
                style={{
                  fontSize: 18,
                  color: "var(--primary-deep)",
                  fontVariationSettings: "'FILL' 1",
                }}
                aria-hidden
              >
                menu_book
              </span>
              <span
                className="text-[13px] font-bold tracking-[0.1em]"
                style={{ color: "var(--primary-deep)" }}
              >
                ここに書かれていること
              </span>
              <span
                className="ml-auto text-[10.5px]"
                style={{ color: "#A6946C" }}
              >
                {washiHint}
              </span>
            </div>
            <div
              className="font-mincho text-[17px] leading-[2.2] text-[var(--ink)]"
              style={{ lineHeight: furigana ? 2.4 : 2.2, textWrap: "pretty" }}
            >
              {looksLikeHtml(bodyRuby || "") ? (
                <div
                  dangerouslySetInnerHTML={{
                    __html: furigana ? bodyRuby || bodyPlain || "" : bodyPlain || "",
                  }}
                />
              ) : (
                <div>{bodyPlain}</div>
              )}
            </div>
            {isPartial && record.partialChars && (
              <div
                className="mt-3 inline-block rounded-lg px-2.5 py-1 font-mono text-[12px]"
                style={{
                  color: "#8A7A52",
                  background: "#F3ECD6",
                  border: "1px solid #E7DBB8",
                }}
              >
                読めた文字：{record.partialChars}
              </div>
            )}
          </div>

          {/* チャット */}
          <section aria-label="ガイドに聞く">
            <div className="mb-2 flex items-center gap-1.5">
              <span
                className="material-symbols-rounded"
                style={{
                  fontSize: 18,
                  color: "var(--secondary)",
                  fontVariationSettings: "'FILL' 1",
                }}
                aria-hidden
              >
                chat
              </span>
              <span
                className="text-[13px] font-bold tracking-[0.08em]"
                style={{ color: "var(--secondary)" }}
              >
                ガイドに聞いてみる
              </span>
            </div>
            {!isPlus ? (
              <p
                className="mb-2 m-0 text-[13px]"
                style={{ color: "var(--muted)" }}
              >
                {(() => {
                  const used = messages.filter((m) => m.role === "user").length;
                  const left = Math.max(0, 3 - used);
                  if (left === 0) {
                    return (
                      <>
                        この記録の質問回数の上限に達しました。{" "}
                        <Link
                          href="/settings/plus"
                          className="font-bold underline"
                          style={{ color: "var(--secondary)" }}
                        >
                          プラスについて見る
                        </Link>
                      </>
                    );
                  }
                  return `この記録であと${left}回質問できます`;
                })()}
              </p>
            ) : null}

            {suggestions.length > 0 &&
              (isPlus ||
                messages.filter((m) => m.role === "user").length < 3) && (
              <div className="mb-3 flex flex-wrap gap-2">
                {suggestions.map((q) => (
                  <button
                    key={q.text}
                    type="button"
                    disabled={chatBusy}
                    onClick={() => void sendQuestion(q.text, q.ruby || undefined)}
                    className="rounded-full px-3.5 py-2 text-left text-[13px] font-bold transition active:scale-[0.98] disabled:opacity-50"
                    style={{
                      background: "var(--ai-card)",
                      color: "var(--secondary)",
                      border: "1px solid var(--ai-border)",
                      lineHeight: furigana && q.ruby ? 2.1 : 1.35,
                    }}
                  >
                    {furigana && q.ruby ? (
                      <span dangerouslySetInnerHTML={{ __html: q.ruby }} />
                    ) : (
                      q.text
                    )}
                  </button>
                ))}
              </div>
            )}

            <div
              className="flex flex-col gap-2.5 rounded-[20px] p-3.5"
              style={{
                background: "var(--card)",
                border: "1px solid var(--card-border)",
                minHeight: 120,
              }}
            >
              {messages.map((m, i) => (
                <div
                  key={`${m.role}-${i}-${m.content.slice(0, 12)}`}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[92%] rounded-[16px] px-3.5 py-2.5 text-[14.5px] leading-relaxed${
                      m.role === "user" ? " chat-bubble-user" : ""
                    }`}
                    style={{
                      ...(m.role === "user"
                        ? {
                            background: "var(--primary)",
                            color: "var(--card)",
                            borderBottomRightRadius: 6,
                          }
                        : {
                            background: "var(--ai-card)",
                            color: "#453F35",
                            border: "1px solid var(--ai-border)",
                            borderBottomLeftRadius: 6,
                          }),
                      lineHeight: furigana && m.contentRuby ? 2.2 : 1.7,
                    }}
                  >
                    {furigana && m.contentRuby ? (
                      <span dangerouslySetInnerHTML={{ __html: m.contentRuby }} />
                    ) : (
                      m.content
                    )}
                  </div>
                </div>
              ))}

              {chatBusy && (
                <div className="flex justify-start">
                  <div
                    className="rounded-[16px] px-3.5 py-2.5 text-[13px] font-bold"
                    style={{
                      background: "var(--ai-card)",
                      color: "var(--muted)",
                      border: "1px solid var(--ai-border)",
                    }}
                  >
                    考えています…
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {isPlus ||
            messages.filter((m) => m.role === "user").length < 3 ? (
              <form
                className="mt-2.5 flex items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void sendQuestion(chatInput);
                }}
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="聞きたいことを書く…"
                  disabled={chatBusy}
                  size={1}
                  className="min-h-[48px] w-full min-w-0 flex-1 rounded-[16px] border px-3.5 py-3 text-[15px] outline-none disabled:opacity-60"
                  style={{
                    background: "var(--card)",
                    borderColor: "var(--border)",
                    color: "var(--ink)",
                  }}
                  maxLength={500}
                />
                <button
                  type="submit"
                  disabled={chatBusy || !chatInput.trim()}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white disabled:opacity-40"
                  style={{ background: "var(--primary)" }}
                  aria-label="送信"
                >
                  <span
                    className="material-symbols-rounded"
                    style={{ fontSize: 22 }}
                    aria-hidden
                  >
                    send
                  </span>
                </button>
              </form>
            ) : null}
          </section>

          {/* 保存 */}
          {isPartial && !isSaved ? (
            <div className="flex flex-col gap-3">
              <button
                type="button"
                className="btn-outline"
                onClick={() => router.push("/scan")}
              >
                <span className="material-symbols-rounded" style={{ fontSize: 22 }} aria-hidden>
                  photo_camera
                </span>
                もう一度撮る
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={saving}
                onClick={() => void onSave()}
              >
                <span className="material-symbols-rounded" style={{ fontSize: 22 }} aria-hidden>
                  bookmark_add
                </span>
                {saving ? "保存中…" : "このまま記録に残す"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn-primary"
              disabled={saving || isSaved}
              onClick={() => void onSave()}
              style={
                isSaved
                  ? {
                      background: "var(--label)",
                      boxShadow: "none",
                      opacity: 1,
                      cursor: "default",
                    }
                  : undefined
              }
            >
              <span
                className="material-symbols-rounded"
                style={{
                  fontSize: 22,
                  fontVariationSettings: isSaved
                    ? "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24"
                    : "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
                }}
                aria-hidden
              >
                {isSaved ? "bookmark" : "bookmark_add"}
              </span>
              {saving ? "保存中…" : isSaved ? "記録済み" : "記録に残す"}
            </button>
          )}

          {isSaved && (
            <div className="pt-1">
              {deleteStep === "idle" ? (
                <button
                  type="button"
                  className="flex w-full items-center justify-center gap-2 rounded-[16px] py-3.5 text-[14px] font-bold"
                  style={{
                    color: "#4F7A59",
                    background: "rgba(111, 163, 120, 0.08)",
                  }}
                  disabled={deleting}
                  onClick={() => setDeleteStep("confirm")}
                >
                  <span className="material-symbols-rounded" style={{ fontSize: 20 }} aria-hidden>
                    delete
                  </span>
                  この記録を削除
                </button>
              ) : (
                <div
                  className="rounded-[18px] px-4 py-4"
                  style={{
                    background: "var(--warn-bg)",
                    border: "1px solid var(--warn-border)",
                  }}
                >
                  <p
                    className="m-0 text-[14px] font-bold leading-relaxed"
                    style={{ color: "var(--warn-ink)" }}
                  >
                    この記録を削除しますか？写真・解説・チャットは元に戻せません。
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      disabled={deleting}
                      onClick={() => setDeleteStep("idle")}
                      className="flex-1 rounded-[14px] py-3 text-[14px] font-bold"
                      style={{
                        background: "var(--card)",
                        color: "var(--label)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      やめる
                    </button>
                    <button
                      type="button"
                      disabled={deleting}
                      onClick={() => void onDelete()}
                      className="flex-1 rounded-[14px] py-3 text-[14px] font-bold text-white disabled:opacity-60"
                      style={{ background: "#6FA378" }}
                    >
                      {deleting ? "削除中…" : "削除する"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {error && (
            <p className="text-center text-[13px] text-[var(--primary)]">{error}</p>
          )}

          <p className="text-center text-[11px] leading-relaxed text-[var(--muted-2)]">
            AIによる解説です。正確な情報は現地の案内をご確認ください。
          </p>
        </div>
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          role="dialog"
          aria-modal
          aria-label="写真拡大"
          onClick={() => setLightbox(false)}
        >
          <button
            type="button"
            aria-label="閉じる"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white"
            onClick={() => setLightbox(false)}
          >
            <span className="material-symbols-rounded" style={{ fontSize: 22 }} aria-hidden>
              close
            </span>
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={record.photoUrl}
            alt={record.title}
            className="max-h-full max-w-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <PaywallSheet
        open={showPaywall}
        onClose={() => setShowPaywall(false)}
        resetsAt={resetsAt}
        kind={paywallKind}
      />

      {toast && (
        <div
          className={`toruhodo-toast${toast.leaving ? " is-leaving" : ""}${toast.variant === "error" ? " is-error" : ""}`}
          role="status"
          aria-live="polite"
        >
          <span
            className="material-symbols-rounded"
            style={{
              fontSize: 20,
              fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24",
            }}
            aria-hidden
          >
            {toast.variant === "error" ? "error" : "check_circle"}
          </span>
          {toast.message}
        </div>
      )}
    </div>
  );
}
