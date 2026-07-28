"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import {
  createPortalSessionAction,
  getSubscriptionStatusAction,
  type SubscriptionStatusView,
} from "@/actions/billing";
import {
  formatJaDate,
  formatResetMonthDay,
  PLUS_PLAN_NAME,
  PLUS_PRICE_LABEL,
} from "@/lib/billing/ui-copy";
import { PortalNoticeSheet } from "@/components/billing/portal-notice-sheet";

export function PlanSection() {
  const [status, setStatus] = useState<SubscriptionStatusView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [portalNoticeOpen, setPortalNoticeOpen] = useState(false);

  const refresh = useCallback(async () => {
    const res = await getSubscriptionStatusAction();
    if (!res.ok) {
      setError(res.error);
      setLoading(false);
      return;
    }
    setStatus(res.data);
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openPortal = () => {
    setError(null);
    startTransition(async () => {
      const res = await createPortalSessionAction();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      // 同一タブ遷移（PWA 戻り導線）
      window.location.href = res.data.url;
    });
  };

  if (loading) {
    return (
      <>
        <GroupTitle>プラン</GroupTitle>
        <div className="card px-[18px] py-4 text-[14px]" style={{ color: "var(--muted)" }}>
          読み込み中…
        </div>
      </>
    );
  }

  if (!status) {
    return (
      <>
        <GroupTitle>プラン</GroupTitle>
        <div className="card px-[18px] py-4 text-[14px]" style={{ color: "var(--warn-ink)" }}>
          {error ?? "プラン情報を取得できませんでした"}
        </div>
      </>
    );
  }

  const isPlus = status.entitlement === "plus";
  const isPastDue = status.stripeStatus === "past_due";
  const canceling = isPlus && status.cancelAtPeriodEnd;

  return (
    <>
      <GroupTitle>プラン</GroupTitle>
      {error ? (
        <p
          className="m-0 mb-2 rounded-2xl px-4 py-3 text-[13px] font-medium"
          style={{
            background: "var(--warn-bg)",
            color: "var(--warn-ink)",
            border: "1px solid var(--warn-border)",
          }}
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {isPastDue ? (
        <div
          className="mb-2 rounded-2xl px-4 py-3 text-[14px] leading-relaxed"
          style={{
            background: "var(--warn-bg)",
            color: "var(--warn-ink)",
            border: "1px solid var(--warn-border)",
          }}
          role="status"
        >
          お支払いが確認できていません。カードの有効期限などをご確認ください。数日間はこれまでどおりお使いいただけます。
          <button
            type="button"
            onClick={openPortal}
            disabled={pending}
            className="mt-2 block w-full rounded-full border-0 text-[15px] font-bold"
            style={{
              minHeight: 48,
              background: "var(--primary)",
              color: "var(--card)",
              cursor: pending ? "not-allowed" : "pointer",
            }}
          >
            お支払い方法を確認する
          </button>
        </div>
      ) : null}

      <div className="card overflow-hidden">
        <div className="px-[18px] py-4">
          {!isPlus ? (
            <>
              <div className="text-[16px] font-bold" style={{ color: "var(--ink)" }}>
                現在のプラン: 無料プラン
              </div>
              {status.scanRemaining != null ? (
                <p
                  className="mt-2 m-0 text-[15px] leading-relaxed"
                  style={{ color: "var(--ink)" }}
                >
                  今月のスキャン: あと{status.scanRemaining}回
                  {status.resetsAt
                    ? `（${formatResetMonthDay(status.resetsAt)}にリセット）`
                    : null}
                </p>
              ) : null}
              <p
                className="mt-2 m-0 text-[14px] leading-relaxed"
                style={{ color: "var(--muted)" }}
              >
                {PLUS_PLAN_NAME}（{PLUS_PRICE_LABEL}）にすると、回数を気にせず使えます。
              </p>
              <Link
                href="/settings/plus"
                className="mt-4 flex items-center justify-center rounded-full no-underline text-[16px] font-bold"
                style={{
                  minHeight: 52,
                  background: "var(--primary)",
                  color: "var(--card)",
                }}
              >
                プラスについて見る
              </Link>
            </>
          ) : canceling ? (
            <>
              <div className="text-[16px] font-bold" style={{ color: "var(--ink)" }}>
                {PLUS_PLAN_NAME}（{formatJaDate(status.currentPeriodEnd)}まで）
              </div>
              <p
                className="mt-2 m-0 text-[15px] leading-relaxed"
                style={{ color: "var(--ink)" }}
              >
                {formatJaDate(status.currentPeriodEnd)}
                以降は自動的に無料プランになります。それまでは今までどおり使えます。
              </p>
              <p
                className="mt-2 m-0 text-[13px] leading-relaxed"
                style={{ color: "var(--muted)" }}
              >
                解約しても、これまでの記録は消えません。
              </p>
              <button
                type="button"
                onClick={openPortal}
                disabled={pending}
                className="mt-3 border-0 bg-transparent p-0 text-[15px] font-bold underline"
                style={{
                  color: "var(--secondary)",
                  cursor: pending ? "not-allowed" : "pointer",
                }}
              >
                プラスを続ける（解約を取り消す）
              </button>
            </>
          ) : (
            <>
              <div className="text-[16px] font-bold" style={{ color: "var(--ink)" }}>
                現在のプラン: {PLUS_PLAN_NAME}
              </div>
              <p
                className="mt-2 m-0 text-[15px] leading-relaxed"
                style={{ color: "var(--ink)" }}
              >
                次回の更新日: {formatJaDate(status.currentPeriodEnd)}（
                {PLUS_PRICE_LABEL}）
              </p>
              <p
                className="mt-2 m-0 text-[13px] leading-relaxed"
                style={{ color: "var(--muted)" }}
              >
                領収書はお支払い完了メール、または「お支払いの確認」画面から取得できます。
              </p>
              <button
                type="button"
                onClick={() => setPortalNoticeOpen(true)}
                disabled={pending}
                className="mt-3 border-0 bg-transparent p-0 text-[15px] font-bold underline"
                style={{
                  color: "var(--secondary)",
                  cursor: pending ? "not-allowed" : "pointer",
                }}
              >
                お支払いの確認・変更・解約
              </button>
            </>
          )}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 px-1">
        <Link
          href="/legal/tokushoho"
          className="text-[12px] no-underline"
          style={{ color: "var(--muted-2)" }}
        >
          特定商取引法に基づく表記
        </Link>
        <Link
          href="/legal/terms"
          className="text-[12px] no-underline"
          style={{ color: "var(--muted-2)" }}
        >
          利用規約
        </Link>
        <Link
          href="/legal/privacy"
          className="text-[12px] no-underline"
          style={{ color: "var(--muted-2)" }}
        >
          プライバシーポリシー
        </Link>
      </div>

      <PortalNoticeSheet
        open={portalNoticeOpen}
        onClose={() => setPortalNoticeOpen(false)}
        onProceed={() => {
          setPortalNoticeOpen(false);
          openPortal();
        }}
        periodEnd={status.currentPeriodEnd}
        pending={pending}
      />
    </>
  );
}

function GroupTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-[12px] font-bold tracking-[0.1em]"
      style={{ color: "var(--label)", padding: "16px 4px 8px" }}
    >
      {children}
    </div>
  );
}
