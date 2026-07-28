"use client";

import Link from "next/link";
import {
  formatResetMonthDay,
  FREE_SCAN_LIMIT,
  PLUS_PRICE_LABEL,
} from "@/lib/billing/ui-copy";
import {
  MobileSheet,
  SheetSecondaryButton,
} from "@/components/billing/mobile-sheet";

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
    <MobileSheet
      open={open}
      onClose={onClose}
      titleId="paywall-title"
      title={title}
    >
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
          className="flex w-full items-center justify-center rounded-full px-4 no-underline text-[16px] font-bold leading-snug"
          style={{
            minHeight: 52,
            background: "var(--primary)",
            color: "var(--card)",
          }}
        >
          プラスについて見る
        </Link>
        <SheetSecondaryButton onClick={onClose}>
          {kind === "chat" ? "閉じる" : "来月まで待つ"}
        </SheetSecondaryButton>
      </div>
    </MobileSheet>
  );
}
