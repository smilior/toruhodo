"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  onClose: () => void;
  titleId: string;
  title: string;
  children: ReactNode;
  /** 本文下の固定フッター（ボタン列）。常に見える。 */
  footer?: ReactNode;
  /** 背景タップで閉じるのを止める（処理中など） */
  closeDisabled?: boolean;
};

/**
 * アプリ枠（最大 430px）に合わせたモバイル向けボトムシート。
 * - body へ portal（app-shell の overflow:hidden で切れない）
 * - 本文スクロール + フッター固定で CTA が必ず見える
 */
export function MobileSheet({
  open,
  onClose,
  titleId,
  title,
  children,
  footer,
  closeDisabled = false,
}: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        className="absolute inset-0 border-0"
        style={{ background: "rgba(40, 34, 24, 0.45)" }}
        aria-label="閉じる"
        onClick={onClose}
        disabled={closeDisabled}
      />
      <div className="pointer-events-none relative flex h-full w-full max-w-[430px] flex-col justify-end">
        <div
          className="pointer-events-auto relative flex w-full flex-col overflow-hidden rounded-t-[28px]"
          style={{
            background: "var(--card)",
            boxShadow: "0 -8px 32px rgba(58, 53, 44, 0.18)",
            // 内容に合わせて縮み、画面の約 85% を超えたら本文だけスクロール
            maxHeight: "min(85svh, 85dvh)",
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
          }}
        >
          <div
            className="mx-auto mt-3 mb-1 h-1 w-10 shrink-0 rounded-full"
            style={{ background: "var(--border)" }}
            aria-hidden
          />
          <h2
            id={titleId}
            className="m-0 shrink-0 px-5 pt-2 text-[19px] font-bold leading-snug tracking-[0.02em]"
            style={{ color: "var(--ink)" }}
          >
            {title}
          </h2>
          <div
            className="min-h-0 overflow-x-hidden overflow-y-auto px-5 pt-3"
            style={{
              flex: "1 1 auto",
              WebkitOverflowScrolling: "touch",
              overscrollBehavior: "contain",
            }}
          >
            {children}
          </div>
          {footer ? (
            <div className="shrink-0 px-5 pb-5 pt-4">{footer}</div>
          ) : (
            <div className="shrink-0 pb-5" />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function SheetPrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-full border-0 px-4 text-[16px] font-bold leading-snug"
      style={{
        minHeight: 52,
        background: "var(--primary)",
        color: "var(--card)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.7 : 1,
      }}
    >
      {children}
    </button>
  );
}

export function SheetSecondaryButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-full border-0 text-[16px] font-bold"
      style={{
        minHeight: 52,
        background: "transparent",
        color: "var(--label)",
        border: "1.5px solid var(--border)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.7 : 1,
      }}
    >
      {children}
    </button>
  );
}
