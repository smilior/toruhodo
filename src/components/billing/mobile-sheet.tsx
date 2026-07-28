"use client";

import type { ReactNode } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  titleId: string;
  title: string;
  children: ReactNode;
  /** 背景タップで閉じるのを止める（処理中など） */
  closeDisabled?: boolean;
};

/**
 * アプリ枠（最大 430px）に合わせたモバイル向けボトムシート。
 * fixed でも phone frame 中央に寄せ、フル幅デスクトップ感を出さない。
 */
export function MobileSheet({
  open,
  onClose,
  titleId,
  title,
  children,
  closeDisabled = false,
}: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex justify-center"
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
      {/* app-frame と同じ幅に揃える */}
      <div
        className="pointer-events-none relative flex h-full w-full max-w-[430px] flex-col justify-end"
      >
        <div
          className="pointer-events-auto relative w-full rounded-t-[28px] px-5 pt-4"
          style={{
            background: "var(--card)",
            boxShadow: "0 -8px 32px rgba(58, 53, 44, 0.18)",
            paddingBottom: "calc(20px + env(safe-area-inset-bottom, 0px))",
            maxHeight: "min(92dvh, 100%)",
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <div
            className="mx-auto mb-3 h-1 w-10 shrink-0 rounded-full"
            style={{ background: "var(--border)" }}
            aria-hidden
          />
          <h2
            id={titleId}
            className="m-0 text-[19px] font-bold leading-snug tracking-[0.02em]"
            style={{ color: "var(--ink)" }}
          >
            {title}
          </h2>
          {children}
        </div>
      </div>
    </div>
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
