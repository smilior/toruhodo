"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { listRecordsAction } from "@/actions/records";
import type { RecordDTO } from "@/lib/domain/record";
import { AppShell } from "@/components/app/app-shell";

function formatCardMeta(dto: RecordDTO): string {
  const d = new Date(dto.createdAt);
  const date = `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  if (dto.placeName) return `${date}・${dto.placeName}`;
  return date;
}

export function HomeApp({
  initialRecords = [],
}: {
  initialRecords?: RecordDTO[];
}) {
  const [records, setRecords] = useState<RecordDTO[]>(initialRecords);
  const [loading, setLoading] = useState(initialRecords.length === 0);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await listRecordsAction();
    if (!res.ok) {
      setError(res.error);
      setLoading(false);
      return;
    }
    setRecords(res.data.records);
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    // サーバー初期値が空でもクライアントで再取得（保存直後の復帰など）
    void load();
  }, [load]);

  const recent = records.slice(0, 10);

  return (
    <AppShell>
      <div className="app-scroll">
        <header
          className="flex items-center gap-2.5"
          style={{ padding: "16px 24px 4px" }}
        >
          <div className="logo-seal" aria-hidden>
            撮
          </div>
          <span
            className="font-mincho text-[20px] font-bold tracking-[0.12em]"
            style={{ color: "var(--ink)" }}
          >
            撮るほど
          </span>
        </header>

        <Link
          href="/scan"
          className="block no-underline transition active:scale-[0.98] active:opacity-95"
          style={{
            margin: "14px 20px 0",
            background: "var(--primary)",
            borderRadius: 26,
            padding: "34px 24px 30px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            boxShadow: "var(--shadow)",
            textAlign: "center",
          }}
        >
          <div
            className="flex items-center justify-center"
            style={{
              width: 84,
              height: 84,
              borderRadius: 999,
              background: "rgba(253, 251, 244, 0.16)",
            }}
          >
            <span
              className="material-symbols-rounded"
              style={{
                fontSize: 42,
                color: "var(--card)",
                fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 48",
              }}
              aria-hidden
            >
              photo_camera
            </span>
          </div>
          <div
            className="text-[23px] font-bold tracking-[0.06em]"
            style={{ color: "var(--card)" }}
          >
            かざして解説
          </div>
          <div
            className="text-[14px]"
            style={{ color: "rgba(253, 251, 244, 0.86)" }}
          >
            石碑や案内板にカメラを向けるだけ
          </div>
        </Link>

        <div
          className="flex items-baseline justify-between"
          style={{ padding: "28px 24px 12px" }}
        >
          <h2
            className="font-mincho m-0 text-[18px] font-bold tracking-[0.06em]"
            style={{ color: "var(--ink)" }}
          >
            さいきんの記録
          </h2>
          <Link
            href="/history"
            className="text-[13px] font-bold no-underline"
            style={{ color: "var(--secondary)" }}
          >
            すべて見る
          </Link>
        </div>

        <div
          className="flex flex-col gap-3"
          style={{ padding: "0 20px 24px" }}
        >
          {loading ? (
            <p
              className="m-0 px-1 py-2 text-[14px] leading-relaxed"
              style={{ color: "var(--muted)" }}
            >
              読み込み中…
            </p>
          ) : error ? (
            <p
              className="m-0 px-1 py-2 text-[14px] leading-relaxed"
              style={{ color: "var(--primary-deep)" }}
              role="alert"
            >
              {error}
            </p>
          ) : recent.length === 0 ? (
            <p
              className="m-0 px-1 py-2 text-[14px] leading-[1.8]"
              style={{ color: "var(--muted)" }}
            >
              まだ記録がありません。「かざして解説」から始めてみましょう。
            </p>
          ) : (
            recent.map((rec) => (
              <Link
                key={rec.id}
                href={`/result/${rec.id}`}
                className="card no-underline flex items-center gap-3 p-3 transition active:opacity-90 active:scale-[0.99]"
                style={{ color: "var(--ink)" }}
              >
                <div
                  className="photo-ph shrink-0"
                  style={{
                    width: 74,
                    height: 74,
                    borderRadius: 12,
                    backgroundImage: rec.photoUrl
                      ? `url(${rec.photoUrl})`
                      : undefined,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[16px] font-bold">
                    {rec.title}
                  </div>
                  <div
                    className="mt-1 text-[12.5px]"
                    style={{ color: "var(--muted)" }}
                  >
                    {formatCardMeta(rec)}
                  </div>

                </div>
                <span
                  className="material-symbols-rounded shrink-0"
                  style={{ fontSize: 20, color: "#B4AA94" }}
                  aria-hidden
                >
                  chevron_right
                </span>
              </Link>
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}
