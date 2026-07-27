"use client";

import Link from "next/link";
import {
  formatResetMonthDay,
  FREE_SCAN_LIMIT,
  PLUS_PRICE_LABEL,
} from "@/lib/billing/ui-copy";

type Props = {
  open: boolean;
  onClose: () => void;
  /** 回復日（ISO）。無ければ翌月1日の文言 */
  resetsAt?: string | null;
  /** スキャン上限 / チャット上限 など */
  kind?: "scan" | "chat";
};

/**
 * 月間上限到達時のボトムシート。責めない・2 択・大きい文字（§9.2）。
 */
export function PaywallSheet({
  open,
  onClose,
  resetsAt,
  kind = "scan",
}: Props) {
  if (!open) return null;

  const resetLabel = formatResetMonthDay(resetsAt);
  const title =
    kind === "chat"
      ? "今月の質問の無料分を使い切りました"
      : `今月の無料分（${FREE_SCAN_LIMIT}回）を使い切りました`;
  const recover =
    kind === "chat"
      ? `${resetLabel}になると、また質問できます。`
      : `${resetLabel}になると、また${FREE_SCAN_LIMIT}回スキャンできます。`;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="paywall-title"
    >
      <button
        type="button"
        className="absolute inset-0 border-0"
        style={{ background: "rgba(40, 34, 24, 0.45)" }}
        aria-label="閉じる"
        onClick={onClose}
      />
      <div
        className="relative w-full max-w-[480px] rounded-t-[28px] px-6 pb-8 pt-5"
        style={{
          background: "var(--card)",
          boxShadow: "0 -8px 32px rgba(58, 53, 44, 0.18)",
        }}
      >
        <div
          className="mx-auto mb-4 h-1 w-10 rounded-full"
          style={{ background: "var(--border)" }}
          aria-hidden
        />
        <h2
          id="paywall-title"
          className="m-0 text-[20px] font-bold leading-snug tracking-[0.02em]"
          style={{ color: "var(--ink)" }}
        >
          {title}
        </h2>
        <p
          className="mt-3 m-0 text-[16px] leading-[1.75]"
          style={{ color: "var(--ink)" }}
        >
          たくさん使っていただき、ありがとうございます。
          <br />
          <strong>{recover}</strong>
          <br />
          これまでの記録は、履歴と地図からいつでも見られます。
        </p>
        <p
          className="mt-3 m-0 text-[15px] leading-[1.7]"
          style={{ color: "var(--muted)" }}
        >
          すぐに続けたい方には、回数を気にせず使える
          撮るほどプラス（{PLUS_PRICE_LABEL}）があります。
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <Link
            href="/settings/plus"
            className="flex items-center justify-center rounded-full no-underline text-[16px] font-bold"
            style={{
              minHeight: 52,
              background: "var(--primary)",
              color: "var(--card)",
            }}
          >
            プラスについて見る
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border-0 text-[16px] font-bold"
            style={{
              minHeight: 52,
              background: "transparent",
              color: "var(--label)",
              border: "1.5px solid var(--border)",
              cursor: "pointer",
            }}
          >
            {kind === "chat" ? "閉じる" : "来月まで待つ"}
          </button>
        </div>
      </div>
    </div>
  );
}
