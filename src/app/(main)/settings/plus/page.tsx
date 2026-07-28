"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createCheckoutSessionAction } from "@/actions/billing";
import { AppShell } from "@/components/app/app-shell";
import { PLUS_PLAN_NAME, PLUS_PRICE_LABEL } from "@/lib/billing/ui-copy";

/**
 * 申込内容の確認（特商法 12条の6 の 6 項目集約 §9.3 / §11.2）
 * Checkout 前に必ず挟む。他画面と同様 AppShell（スマホ枠）内に表示する。
 */
export default function PlusConfirmPage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const startCheckout = () => {
    setError(null);
    startTransition(async () => {
      const res = await createCheckoutSessionAction({ plan: "plus_monthly" });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      window.location.href = res.data.url;
    });
  };

  return (
    <AppShell showTabBar={false}>
      <div className="app-scroll flex min-h-0 flex-1 flex-col">
        <header
          className="flex shrink-0 items-center gap-1"
          style={{
            padding:
              "max(10px, env(safe-area-inset-top, 0px)) 12px 8px 8px",
          }}
        >
          <button
            type="button"
            onClick={() => router.back()}
            className="flex shrink-0 items-center justify-center border-0 bg-transparent"
            style={{ width: 48, height: 48, cursor: "pointer" }}
            aria-label="もどる"
          >
            <span
              className="material-symbols-rounded"
              style={{ fontSize: 24, color: "var(--ink)" }}
            >
              arrow_back
            </span>
          </button>
          <h1
            className="font-mincho m-0 min-w-0 flex-1 text-[18px] font-bold leading-snug tracking-[0.04em] sm:text-[20px]"
            style={{ color: "var(--ink)" }}
          >
            お申し込み内容のご確認
          </h1>
        </header>

        <div
          className="flex flex-1 flex-col"
          style={{
            padding:
              "8px 20px calc(24px + env(safe-area-inset-bottom, 0px))",
          }}
        >
          {error ? (
            <p
              className="mb-4 m-0 rounded-2xl px-4 py-3 text-[14px] font-medium"
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

          <div className="card px-[18px] py-5">
            <p
              className="m-0 mb-4 text-[14px] leading-relaxed"
              style={{ color: "var(--muted)" }}
            >
              お支払いの前に、内容をご確認ください。
            </p>
            <dl className="m-0 flex flex-col gap-4">
              <div>
                <dt
                  className="text-[12px] font-bold tracking-[0.08em]"
                  style={{ color: "var(--label)" }}
                >
                  プラン
                </dt>
                <dd
                  className="m-0 mt-1 text-[16px] font-bold leading-snug"
                  style={{ color: "var(--ink)" }}
                >
                  {PLUS_PLAN_NAME}
                  <span
                    className="mt-0.5 block text-[14px] font-medium"
                    style={{ color: "var(--muted)" }}
                  >
                    スキャン回数たっぷり
                  </span>
                </dd>
              </div>
              <div
                className="h-px w-full"
                style={{ background: "var(--border)" }}
                aria-hidden
              />
              <div>
                <dt
                  className="text-[12px] font-bold tracking-[0.08em]"
                  style={{ color: "var(--label)" }}
                >
                  料金
                </dt>
                <dd
                  className="m-0 mt-1 text-[16px] leading-[1.7]"
                  style={{ color: "var(--ink)" }}
                >
                  <strong className="text-[18px]">{PLUS_PRICE_LABEL}</strong>
                  <span className="mt-1 block text-[15px]">
                    1か月ごとに自動更新され、毎月の更新日にクレジットカードへ請求されます。
                  </span>
                </dd>
              </div>
              <div
                className="h-px w-full"
                style={{ background: "var(--border)" }}
                aria-hidden
              />
              <div>
                <dt
                  className="text-[12px] font-bold tracking-[0.08em]"
                  style={{ color: "var(--label)" }}
                >
                  利用開始
                </dt>
                <dd
                  className="m-0 mt-1 text-[15px] leading-[1.7]"
                  style={{ color: "var(--ink)" }}
                >
                  お支払い手続きの完了後、すぐに使えます。
                </dd>
              </div>
              <div
                className="h-px w-full"
                style={{ background: "var(--border)" }}
                aria-hidden
              />
              <div>
                <dt
                  className="text-[12px] font-bold tracking-[0.08em]"
                  style={{ color: "var(--label)" }}
                >
                  解約
                </dt>
                <dd
                  className="m-0 mt-1 text-[15px] leading-[1.7]"
                  style={{ color: "var(--ink)" }}
                >
                  いつでもできます。「設定 → プラン」から手続きすると、期間の終わりで更新が止まります。途中解約の日割り返金はありません。
                </dd>
              </div>
            </dl>

            <p
              className="mt-5 m-0 flex flex-col gap-2 text-[14px] sm:flex-row sm:flex-wrap sm:gap-x-4"
              style={{ color: "var(--muted)" }}
            >
              <Link
                href="/legal/terms"
                className="underline"
                style={{ color: "var(--secondary)" }}
              >
                利用規約
              </Link>
              <Link
                href="/legal/tokushoho"
                className="underline"
                style={{ color: "var(--secondary)" }}
              >
                特定商取引法に基づく表記
              </Link>
            </p>
          </div>

          <div className="mt-auto flex flex-col gap-3 pt-6">
            <button
              type="button"
              onClick={startCheckout}
              disabled={pending}
              className="w-full rounded-full border-0 px-4 text-[16px] font-bold leading-snug"
              style={{
                minHeight: 54,
                background: "var(--primary)",
                color: "var(--card)",
                cursor: pending ? "not-allowed" : "pointer",
                opacity: pending ? 0.7 : 1,
              }}
            >
              {pending ? "準備中…" : "お支払いに進む"}
            </button>
            <p
              className="m-0 text-center text-[12px] leading-relaxed"
              style={{ color: "var(--muted-2)" }}
            >
              Stripe の安全な支払い画面が開きます。
              <br />
              カード情報はこのアプリには保存しません。
            </p>
            <button
              type="button"
              onClick={() => router.back()}
              disabled={pending}
              className="w-full rounded-full border-0 text-[16px] font-bold"
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
    </AppShell>
  );
}
