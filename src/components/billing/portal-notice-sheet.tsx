"use client";

import { formatJaDate } from "@/lib/billing/ui-copy";

type Props = {
  open: boolean;
  onClose: () => void;
  onProceed: () => void;
  periodEnd: string | null;
  pending?: boolean;
};

/**
 * Portal 直行前の案内シート（§9.4）。引き止めではなく事実の案内のみ。
 */
export function PortalNoticeSheet({
  open,
  onClose,
  onProceed,
  periodEnd,
  pending = false,
}: Props) {
  if (!open) return null;

  const endLabel = formatJaDate(periodEnd);
  const periodSentence =
    periodEnd && endLabel !== "—"
      ? `解約しても、${endLabel}（期間の終わり）まではプラスのまま使えます。`
      : "解約しても、期間の終わりまではプラスのまま使えます。";

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="portal-notice-title"
    >
      <button
        type="button"
        className="absolute inset-0 border-0"
        style={{ background: "rgba(40, 34, 24, 0.45)" }}
        aria-label="閉じる"
        onClick={onClose}
        disabled={pending}
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
          id="portal-notice-title"
          className="m-0 text-[20px] font-bold leading-snug"
          style={{ color: "var(--ink)" }}
        >
          お支払い・解約について
        </h2>
        <p
          className="mt-3 m-0 text-[16px] leading-[1.75]"
          style={{ color: "var(--ink)" }}
        >
          解約は<strong>いつでも</strong>できます。{periodSentence}
          日割りの返金はありません。この先は Stripe 社の管理画面が開きます。
        </p>
        <p
          className="mt-2 m-0 text-[14px] leading-relaxed"
          style={{ color: "var(--muted)" }}
        >
          解約しても、これまでの記録は消えません。
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={onProceed}
            disabled={pending}
            className="rounded-full border-0 text-[16px] font-bold"
            style={{
              minHeight: 52,
              background: "var(--primary)",
              color: "var(--card)",
              cursor: pending ? "not-allowed" : "pointer",
              opacity: pending ? 0.7 : 1,
            }}
          >
            {pending ? "準備中…" : "お支払い・解約の画面を開く"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-full border-0 text-[16px] font-bold"
            style={{
              minHeight: 52,
              background: "transparent",
              color: "var(--label)",
              border: "1.5px solid var(--border)",
              cursor: pending ? "not-allowed" : "pointer",
            }}
          >
            もどる
          </button>
        </div>
      </div>
    </div>
  );
}
