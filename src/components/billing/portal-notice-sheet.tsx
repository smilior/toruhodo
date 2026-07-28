"use client";

import { formatJaDate } from "@/lib/billing/ui-copy";
import {
  MobileSheet,
  SheetPrimaryButton,
  SheetSecondaryButton,
} from "@/components/billing/mobile-sheet";

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
  const endLabel = formatJaDate(periodEnd);
  const periodSentence =
    periodEnd && endLabel !== "—"
      ? `解約しても、${endLabel}（期間の終わり）まではプラスのまま使えます。`
      : "解約しても、期間の終わりまではプラスのまま使えます。";

  return (
    <MobileSheet
      open={open}
      onClose={onClose}
      titleId="portal-notice-title"
      title="お支払い・解約について"
      closeDisabled={pending}
    >
      <p
        className="mt-3 m-0 text-[16px] leading-[1.75]"
        style={{ color: "var(--ink)" }}
      >
        解約は<strong>いつでも</strong>できます。{periodSentence}
        日割りの返金はありません。
      </p>
      <p
        className="mt-2 m-0 text-[14px] leading-relaxed"
        style={{ color: "var(--muted)" }}
      >
        この先は Stripe 社の管理画面が開きます。解約しても、これまでの記録は消えません。
      </p>

      <div className="mt-6 flex flex-col gap-3">
        <SheetPrimaryButton onClick={onProceed} disabled={pending}>
          {pending ? "準備中…" : "お支払い・解約の画面を開く"}
        </SheetPrimaryButton>
        <SheetSecondaryButton onClick={onClose} disabled={pending}>
          もどる
        </SheetSecondaryButton>
      </div>
    </MobileSheet>
  );
}
