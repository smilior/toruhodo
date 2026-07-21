"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { listRecordsAction } from "@/actions/records";
import type { RecordDTO } from "@/lib/domain/record";
import { AppShell } from "@/components/app/app-shell";

type ViewMode = "list" | "calendar";

/** 履歴カード用: 日付 + 場所名（ある場合のみ） */
function formatHistoryMeta(dto: RecordDTO): string {
  const d = new Date(dto.createdAt);
  const date = `${d.getMonth() + 1}月${d.getDate()}日`;
  if (dto.placeName) return `${date}・${dto.placeName}`;
  return date;
}

function ymdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function RecordCard({ rec }: { rec: RecordDTO }) {
  return (
    <Link
      href={`/result/${rec.id}`}
      className="card flex items-center gap-3 p-3 no-underline transition active:scale-[0.99] active:opacity-90"
      style={{ color: "var(--ink)" }}
    >
      <div
        className="photo-ph shrink-0 overflow-hidden"
        style={{
          width: 74,
          height: 74,
          borderRadius: 12,
        }}
        aria-hidden
      >
        {rec.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={rec.photoUrl}
            alt=""
            className="h-full w-full object-cover object-center"
            draggable={false}
          />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-base font-bold">{rec.title}</div>
        <div className="mt-1 text-[12.5px]" style={{ color: "var(--muted)" }}>
          {formatHistoryMeta(rec)}
        </div>
      </div>
      <span
        className="material-symbols-rounded shrink-0"
        style={{ fontSize: 20, color: "#B4AA94", lineHeight: 1 }}
        aria-hidden
      >
        chevron_right
      </span>
    </Link>
  );
}

function CalendarView({
  records,
  cursor,
  onCursorChange,
}: {
  records: RecordDTO[];
  cursor: Date;
  onCursorChange: (d: Date) => void;
}) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth(); // 0-based

  const byDay = useMemo(() => {
    const map = new Map<string, RecordDTO[]>();
    for (const r of records) {
      const key = ymdLocal(new Date(r.createdAt));
      const list = map.get(key) ?? [];
      list.push(r);
      map.set(key, list);
    }
    return map;
  }, [records]);

  const first = new Date(year, month, 1);
  const startWeekday = first.getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<{ day: number | null; key: string | null }> = [];
  for (let i = 0; i < startWeekday; i++) {
    cells.push({ day: null, key: null });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ day: d, key });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ day: null, key: null });
  }

  const todayKey = ymdLocal(new Date());
  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;

  const pickDefaultKey = useCallback(() => {
    const keys = [...byDay.keys()]
      .filter((k) => k.startsWith(monthPrefix))
      .sort()
      .reverse();
    if (keys[0]) return keys[0];
    if (todayKey.startsWith(monthPrefix)) return todayKey;
    return null;
  }, [byDay, monthPrefix, todayKey]);

  const [selectedKey, setSelectedKey] = useState<string | null>(pickDefaultKey);
  const dayListRef = useRef<HTMLDivElement>(null);

  // 月変更時のみデフォルト日付を選び直す（クリック選択は維持）
  useEffect(() => {
    setSelectedKey(pickDefaultKey());
  }, [year, month, pickDefaultKey]);

  const selectDay = (key: string) => {
    setSelectedKey(key);
    // その日の一覧へスクロール
    requestAnimationFrame(() => {
      dayListRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const selectedRecords = selectedKey
    ? (byDay.get(selectedKey) ?? []).slice().sort((a, b) => {
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      })
    : [];
  const weekLabels = ["日", "月", "火", "水", "木", "金", "土"];

  const goPrev = () => onCursorChange(new Date(year, month - 1, 1));
  const goNext = () => onCursorChange(new Date(year, month + 1, 1));

  const selectedLabel = selectedKey
    ? (() => {
        const [y, m, d] = selectedKey.split("-").map(Number);
        return `${y}年${m}月${d}日`;
      })()
    : null;

  return (
    <div className="flex flex-col gap-3 px-5 pb-6 pt-2">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={goPrev}
          className="flex h-10 w-10 items-center justify-center rounded-full"
          style={{ color: "var(--label)" }}
          aria-label="前の月"
        >
          <span className="material-symbols-rounded" style={{ fontSize: 22 }} aria-hidden>
            chevron_left
          </span>
        </button>
        <div className="font-mincho text-[17px] font-bold tracking-[0.06em]">
          {year}年{month + 1}月
        </div>
        <button
          type="button"
          onClick={goNext}
          className="flex h-10 w-10 items-center justify-center rounded-full"
          style={{ color: "var(--label)" }}
          aria-label="次の月"
        >
          <span className="material-symbols-rounded" style={{ fontSize: 22 }} aria-hidden>
            chevron_right
          </span>
        </button>
      </div>

      <p className="m-0 text-center text-[12px] font-bold" style={{ color: "var(--muted)" }}>
        日付をタップすると、その日の記録一覧が表示されます
      </p>

      <div
        className="rounded-[20px] p-3"
        style={{
          background: "var(--card)",
          border: "1px solid var(--card-border)",
        }}
      >
        <div className="mb-1 grid grid-cols-7 gap-0.5 text-center text-[11px] font-bold">
          {weekLabels.map((w, i) => (
            <div
              key={w}
              style={{
                color: i === 0 ? "#B9502F" : i === 6 ? "#33566E" : "var(--muted)",
                padding: "4px 0",
              }}
            >
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((cell, idx) => {
            if (cell.day == null || !cell.key) {
              return <div key={`e-${idx}`} className="aspect-square" />;
            }
            const count = byDay.get(cell.key)?.length ?? 0;
            const isSelected = selectedKey === cell.key;
            const isToday = cell.key === todayKey;
            const weekday = idx % 7;
            const key = cell.key;

            return (
              <button
                key={key}
                type="button"
                onClick={() => selectDay(key)}
                className="relative flex aspect-square flex-col items-center justify-center rounded-[12px] text-[13px] font-bold transition active:scale-95"
                style={{
                  background: isSelected
                    ? "var(--primary)"
                    : count > 0
                      ? "rgba(185,80,47,0.08)"
                      : isToday
                        ? "rgba(185,80,47,0.06)"
                        : "transparent",
                  color: isSelected
                    ? "var(--card)"
                    : weekday === 0
                      ? "#B9502F"
                      : weekday === 6
                        ? "#33566E"
                        : "var(--ink)",
                  outline: isToday && !isSelected ? "1.5px solid rgba(185,80,47,0.35)" : undefined,
                  outlineOffset: -1,
                }}
                aria-label={`${month + 1}月${cell.day}日${count > 0 ? ` 記録${count}件` : ""}`}
                aria-pressed={isSelected}
              >
                {cell.day}
                {count > 0 && (
                  <span className="mt-0.5 flex gap-0.5" aria-hidden>
                    {Array.from({ length: Math.min(count, 3) }).map((_, i) => (
                      <span
                        key={i}
                        className="h-1 w-1 rounded-full"
                        style={{
                          background: isSelected ? "var(--card)" : "var(--primary)",
                        }}
                      />
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 選択日の記録一覧 */}
      <div
        ref={dayListRef}
        className="rounded-[20px] px-3.5 py-3.5"
        style={{
          background: "var(--card)",
          border: "1px solid var(--card-border)",
        }}
      >
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h2 className="font-mincho m-0 text-[16px] font-bold tracking-[0.04em]">
            {selectedLabel ?? "日付を選択"}
          </h2>
          {selectedKey ? (
            <span className="text-[12.5px] font-bold" style={{ color: "var(--muted)" }}>
              {selectedRecords.length}件
            </span>
          ) : null}
        </div>

        {!selectedKey ? (
          <p className="m-0 text-[13.5px] leading-relaxed" style={{ color: "var(--muted)" }}>
            カレンダーの日付をタップしてください
          </p>
        ) : selectedRecords.length === 0 ? (
          <p className="m-0 text-[13.5px] leading-relaxed" style={{ color: "var(--muted)" }}>
            この日の記録はまだありません
          </p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {selectedRecords.map((rec) => (
              <li key={rec.id}>
                <RecordCard rec={rec} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function HistoryApp({
  initialRecords = [],
  initialError = null,
}: {
  initialRecords?: RecordDTO[];
  initialError?: string | null;
}) {
  const [records, setRecords] = useState<RecordDTO[]>(initialRecords);
  const [error, setError] = useState<string | null>(initialError);
  const [loading, setLoading] = useState(
    initialRecords.length === 0 && !initialError,
  );
  const [view, setView] = useState<ViewMode>("list");
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });

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
    void load();
  }, [load]);

  const empty = !loading && !error && records.length === 0;

  return (
    <AppShell>
      <div className="app-scroll flex min-h-0 flex-1 flex-col">
        <header style={{ padding: "16px 24px 6px" }}>
          <h1
            className="font-mincho m-0 text-[22px] font-bold tracking-[0.08em]"
            style={{ color: "var(--ink)" }}
          >
            旅の記録
          </h1>
          {!empty && !error && !loading ? (
            <p className="m-0 mt-1 text-[13px]" style={{ color: "var(--muted)" }}>
              あるいた分だけ、たまっていきます — {records.length}件
            </p>
          ) : null}

          {!empty && !error && !loading ? (
            <div
              className="mt-3 flex rounded-full p-1"
              style={{ background: "var(--segment)" }}
              role="tablist"
              aria-label="表示切替"
            >
              {(
                [
                  { id: "list" as const, label: "一覧", icon: "view_list" },
                  {
                    id: "calendar" as const,
                    label: "カレンダー",
                    icon: "calendar_month",
                  },
                ] as const
              ).map((tab) => {
                const active = view === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setView(tab.id)}
                    className="flex flex-1 items-center justify-center gap-1 rounded-full py-2.5 text-[13.5px] font-bold transition"
                    style={
                      active
                        ? {
                            background: "var(--card)",
                            color: "var(--ink)",
                            boxShadow: "0 1px 3px rgba(58,53,44,.14)",
                          }
                        : { color: "var(--muted)" }
                    }
                  >
                    <span
                      className="material-symbols-rounded"
                      style={{
                        fontSize: 18,
                        fontVariationSettings: active
                          ? "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24"
                          : "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
                      }}
                      aria-hidden
                    >
                      {tab.icon}
                    </span>
                    {tab.label}
                  </button>
                );
              })}
            </div>
          ) : null}
        </header>

        {loading ? (
          <div
            className="flex flex-1 items-center justify-center px-8 pb-20"
            style={{ color: "var(--muted)" }}
          >
            <p className="m-0 text-[14px]">読み込み中…</p>
          </div>
        ) : error ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 pb-20 text-center">
            <p
              className="m-0 text-[15px] leading-8"
              style={{ color: "var(--label)" }}
              role="alert"
            >
              {error}
            </p>
          </div>
        ) : empty ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 pb-20 text-center">
            <div
              className="flex h-[104px] w-[104px] items-center justify-center rounded-full"
              style={{ background: "#F0E8D3" }}
              aria-hidden
            >
              <span
                className="material-symbols-rounded"
                style={{ fontSize: 46, color: "#A89263", lineHeight: 1 }}
              >
                auto_stories
              </span>
            </div>
            <h2 className="font-mincho m-0 text-[19px] font-bold">
              まだ記録がありません
            </h2>
            <p
              className="m-0 text-[15px] leading-8"
              style={{ color: "var(--label)", textWrap: "pretty" }}
            >
              散歩に出かけて、最初の一枚を撮ってみませんか。石碑や案内板が、きっと何かを教えてくれます。
            </p>
            <Link
              href="/scan"
              className="btn-primary mt-1.5 inline-flex h-[54px] px-[26px] text-base no-underline"
              style={{ width: "auto" }}
            >
              <span
                className="material-symbols-rounded"
                style={{ fontSize: 21, lineHeight: 1 }}
                aria-hidden
              >
                photo_camera
              </span>
              かざして解説をはじめる
            </Link>
          </div>
        ) : view === "list" ? (
          <ul
            className="m-0 flex list-none flex-col gap-3 p-0"
            style={{ padding: "12px 20px 20px" }}
          >
            {records.map((rec) => (
              <li key={rec.id}>
                <RecordCard rec={rec} />
              </li>
            ))}
          </ul>
        ) : (
          <CalendarView
            records={records}
            cursor={cursor}
            onCursorChange={setCursor}
          />
        )}
      </div>
    </AppShell>
  );
}
